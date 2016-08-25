app
    .service('locationService', [function () {
        // Get settings url from settings
        // and provide it for settings service
        this.getLocations = function (setLocations) {
            chrome.storage.sync.get(null, function (items) {
                setLocations(items.locations);
            });
        };

        this.isValidLocation = function (locations) {
            var reqs = ['location', 'semesterEndDate', 'url', 'calendarID'];
            return _.all(locations, function (location) {
                return _.all(reqs, function (req) {
                    return _.contains(_.keys(location), req);
                });
            });
        };
    }])

    .service('settingsService', ['$http', 'locationService', '$q', function ($http, locationService, $q) {
        var self = this;
        this.getAuthToken = function() {
            return $q(function (resolve, reject) {
                chrome.storage.sync.get(null, function(values) {
                    resolve(values.authToken);
                });
            });
        };

        this.tryGetCachedSettings = function(location) {
            return $q(function (resolve, reject) {
                chrome.storage.local.get(null, function (value) {
                    resolve(value[location.location]);
                });
            })
        };

        this.getSettings = function (location, setSettings) {
            var promises = $q.all([self.getAuthToken(), self.tryGetCachedSettings(location)]);
            promises.then(function (results) {
                var [authToken, cachedSettings] = results;
                if (cachedSettings) {
                    return cachedSettings;
                } else {
                    return $http({
                        method: 'GET',
                        url: location.url,
                        headers: {
                            'Authorization': authToken
                        }
                    })
                }
            }).then(function (possibleSettings) {
                if (possibleSettings.status) {
                    // this was an http request
                    var settings = possibleSettings.data;
                    chrome.storage.local.set({ [location.location]: settings });
                    // ain't no payin' no technical debt here
                    setSettings(settings);
                } else {
                    // this was cache hit
                    setSettings(possibleSettings);
                }
            });
        };

        this.refreshSettings = function (date, respond) {
            var dateStr = moment(date).format('YYYY/MM/DD');
            chrome.storage.local.clear(function () {
                chrome.storage.local.set({
                    'webpageDate': dateStr
                });
                respond();
            });
        };
    }])

    .service('initialSetupService', ['settingsService', function (settingsService) {
        this.getWebpageDate = function (setInitialDate) {
            chrome.storage.local.get('webpageDate', function (value) {
                setInitialDate(value.webpageDate);
            });
        };

        this.getTime = function(date, settings, setTime) {
            var weekday = moment(date).format('dddd');
            var timeEntries = settings.schedule[weekday];
            var timeResult = {};

            // TODO: utilize _ instead
            for (hour in timeEntries) {
                timeResult[hour] = {
                    value: parseInt(hour)
                };

                timeResult[hour].display = moment([
                    date.getYear(),
                    date.getMonth(),
                    date.getDay(),
                    parseInt(hour),
                    (parseInt(hour) % 1) * 60 // Number of minutes
                ]).format('hh:mm a');
            }

            setTime(timeResult);
        };
    }])

    .service('tutorService', ['calendarService', function (calendarService) {
        var self = this;
        self.randomTutorOption = 'I\'m feeling lucky';

        this.getAvailableTutors = function (settings, data, setTutors) {
            if (!data.date || !data.course) {
                // No work can be done, returning an empty array of tutors,
                setTutors({});
                return;
            }

            var course = data.course,
                weekday = moment(data.date).format('dddd'),
                dateStr = moment(data.date).format('MM-DD-YYYY'), // Will be used for days off
                tutors = settings.schedule[weekday];

            // Filtering tutors, by first getting busy tutors
            self.getBusyTutorsForDay(data, tutors, function(busyTutors) {
                // Then by filtering out tutors by their ability to tutor the course and business
                self.filterTutors(tutors, busyTutors, course, dateStr, settings, function (tutors) {
                    _.mapObject(tutors, function (tutorsList, hour) {
                        // Then prepend random tutor option if there are more than one tutors left, itherwise return
                        return tutorsList.length > 1 ? tutorsList.unshift(self.randomTutorOption) : tutorsList;
                    });
                    // At the end we're calling back with our final, filtered tutor list
                    setTutors(tutors);
                });
            });
        };

        this.filterTutors = function (tutors, busyTutors, course, dateStr, settings, appendRandomTutor) {
            // First of all, go over every hour in original tutor list
            var filteredTutors = _.mapObject(tutors, function (tutorsList, hour) {
                // Inside of this hour go over every tutor in the list
                return _.filter(tutorsList, function (tutor) {
                    // Define an object that will hold criterias that we use to filter out tutors
                    var criteria = {
                        notBusy: !_.contains(busyTutors[hour], tutor.toLowerCase()),
                        canTutorCourse: _.contains(settings.tutors[tutor], course.code) || _.contains(settings.tutors['Everyone'] ,course.code),
                        notRequestedOff: _.has(settings.daysOff, dateStr) ? !_.contains(settings.daysOff[dateStr], tutor) : true
                    };
                    // Finally, keeing selected tutor if all criterions are satisfied
                    return _.all(criteria, function (criterion) { return criterion; });
                });
            });
            // After all hard work is done, call back with filtered tutor list
            appendRandomTutor(filteredTutors);
        };

        this.getBusyTutorsForDay = function (data, tutors, setBusyTutors) {
            calendarService.getAppointmentsForDay(data, function (events) {
                // Go over every event, extract starting hour and tutor names and create a map
                // with keys as hours and lists of busy tutors as values
                var busyTutors = {};
                _.each(events, function (event) {
                    if (event && event.status === 'confirmed') {
                        var startDateTime = moment(event.start.dateTime);
                        var hour = startDateTime.format('H');
                        var minute = startDateTime.format('m');
                        // Turning hour and minute into a string with decimal hour representation
                        var time = (parseInt(hour) + parseInt(minute) / 60).toString();
                        if (!_.has(busyTutors, time))
                            busyTutors[time] = [];
                        var tutorList = tutors[time];
                        busyTutors[time].push(self.extractTutorName(event, tutorList));
                    }
                });
                setBusyTutors(busyTutors);
            });
        };

        this.extractTutorName = function (event, tutorList) {
            // given a google calendar event extracts name of tutor
            var mo = calendarService.appointmentRegex.exec(event.summary),
                // strip any punctuation
                rawName = mo ? mo[1].replace(/\W/g, '').toLowerCase() : null,
                tutorName,
                // set a min number of chars to match
                accuracy = 2;
            var normalizedTutorList = _.map(_.map(tutorList, _.clone), function (t) { return t.replace(/\W/g, '').toLowerCase(); });
            if (!rawName || _.contains(normalizedTutorList, rawName)) {
                // direct match or no match based on regex
                tutorName = rawName;
            } else {
                // check if at least two first letter match any tutor
                tutorName = _.find(normalizedTutorList, function (tutor) {
                    return tutor.substring(0, accuracy) === rawName.substring(0, accuracy);
                });
            }
            return tutorName || null;
        };
    }])

    .service('calendarService', ['$http', function($http) {
        var self = this;
        self.appointmentRegex = /(\w.+?)\(.+?\).+/;
        self.calendarAPIBaseUrl = 'https://www.googleapis.com/calendar/v3/calendars/';
        self.recurrenceText = "RRULE:FREQ=WEEKLY;UNTIL=";
        self.timezone = 'America/Chicago';
        self.randomTutorOption = 'I\'m feeling lucky';

        this.getAuthToken = function (setToken) {
            chrome.identity.getAuthToken({
                'interactive': true
            }, function (token) {
                setToken(token);
            });
        };

        this.schedule = function (data, tutors, setFeedback) {
            // TODO: Remove when appointment length added on the location object
            data.selectedLocation.appointmentLength = 60;

            if (data.tutor === self.randomTutorOption) {
                data.tutor = _.sample(_.without(tutors[data.time.toString()], self.randomTutorOption));
                data.isSpecificTutorRequested = false;
            } else if (tutors[data.time.toString()].length != 1) {
                data.isSpecificTutorRequested = true;
            } // otherwise use checkbox value to determine if specific tutor was required

            var requestUrl = self.calendarAPIBaseUrl + data.selectedLocation.calendarID + '/events';
            // summary text has format as follows: tutorName (studentFirstName) courseCode
            var summary = [data.tutor, data.isSpecificTutorRequested ? ' ##' : '',
                           ' (', data.isStudyGroup ? 'Group' : data.student.split(' ')[0].capitalize(), ') ',
                           data.course.code].join('');
            // description includes student full name, contact and timestamp
            var description = [(data.isStudyGroup ? 'Students: ' : 'Student: ') + data.student.capitalize(),
                               'Contact: ' + data.contact.rewriteContact(),
                               'Course: ' + data.course.name,
                               data.note ? 'Note: ' + data.note : null,
                               'Created on: ' + moment().format('ddd, MMM Do [at] h:mm a'),
                               'Created by: ' + data.initials.toUpperCase()].join('\n');

            var startDateTime = moment(data.date)
                .add(Math.floor(parseInt(data.time)), 'hours') // Adding hours --- whole number part
                .add((parseInt(data.time) % 1) * 60, 'minutes'); // Adding minutes --- decimal part * 60

            var endDateTime = moment(startDateTime)
                .add(data.selectedLocation.appointmentLength, 'minutes');

            var event = {
                'summary': summary,
                'description': description,
                'colorId': data.course.color,
                'recurrence': [
                    data.isStudyGroup ? self.recurrenceText + moment(data.selectedLocation.semesterEndDate).format('YYYYMMDD[T]HHmmss[Z]') : null
                ],

                'start': {
                    'dateTime': startDateTime.toISOString(),
                    'timeZone': self.timezone
                },

                'end': {
                    'dateTime': endDateTime.toISOString(),
                    'timeZone': self.timezone
                }
            };

            self.getAuthToken(function (token) {
                $http({
                    method: 'POST',
                    url: requestUrl,
                    headers: {
                        'Authorization': 'Bearer ' + token
                    },
                    data: event
                }).then(function (response) {
                    setFeedback(true);
                },
                        function (error) {
                            setFeedback(false);
                        });
            });
        };

        this.getAppointmentsForDay = function (data, setEvents) {
            var requestUrl = self.calendarAPIBaseUrl + data.selectedLocation.calendarID + '/events';
            var startDateStr = moment(data.date).toISOString();
            var endDateStr = moment(data.date).add(1, 'days').toISOString();

            self.getAuthToken(function (token) {
                $http({
                    method: 'GET',
                    url: requestUrl,
                    headers: {
                        'Authorization': 'Bearer ' + token
                    },
                    params: {
                        'timeMin': startDateStr,
                        'timeMax': endDateStr
                    }
                }).then(function (response) {
                    var events = response.data.items;
                    setEvents(events);
                }, function (error) {
                    console.log(error);
                });
            });
        };
    }])

    .service('formStatusService', [function () {
        var self = this;

        self.messages = {
            updatingSettings: 'Trying to update settings...',
            noLocations: 'No locations are specified. You can set them up in the options menu.',
            invalidLocations: 'Make sure every location has semester end date and calendar specified',
            cantSetTutorEx: "Not enough data: can't set a tutor yet"
        };

        self.resetForm = function () {
            self.scheduled =  false,
            self.scheduling = false;
            self.hasError = true;
            self.schedulingErrorOcurred = false;
            self.blurForm = false;
            self.errorMessage = '';
            self.sendingFeedback = false;
        };

        self.onScheduled = function (status) {
            self.scheduling = false;
            self.scheduled = status;
            self.schedulingErrorOcurred = !status;
        };

        self.onError = function (errorMessage) {
            self.errorMessage = errorMessage;
            self.blurForm = true;
        };

        self.setScheduling = function (status) {
            self.scheduling = status;
        };

        self.setBlurForm = function (status) {
            self.blurForm = status;
        };
    }]);
