app.controller('MainController', ['$scope', 'locationService','calendarService', 'tutorService', 'settingsService', 'initialSetupService', 'formStatusService', function ($scope, locationService, calendarService, tutorService, settingsService, initialSetupService, formStatusService) {

    $scope.DEBUG = false;
    $scope.formData = {};
    $scope.formStatus = formStatusService;
    $scope.locations = {};
    $scope.tutors = {};

    $scope.onSubmit = function() {
        $scope.formStatus.setScheduling(true);

        calendarService.schedule($scope.formData, $scope.tutors, function(isScheduled) {
            $scope.tutors = {};
            $scope.formStatus.onScheduled(isScheduled);
        });
    };

    $scope.onClearForm = function () {
        $scope.resetForm();
        $scope.form.$setPristine();
    };

    $scope.onLocationUpdate = function () {
        $scope.formStatus.setBlurForm(true);
        $scope.formStatus.setErrorMessage($scope.formStatus.messages.updatingSettings);
        settingsService.refreshSettings($scope.formData.date, function () {
            $scope.onLocationSelect();
        });
    };

    // OK, but should be refactored
    // event listeners
    $scope.onLocationSelect = function () {
        $scope.initialSetup(false);
    };

    $scope.onDateSelect = function () {
        $scope.getTutors();
        initialSetupService.getTime($scope.formData.date, $scope.settings, function (time) {
            $scope.time = time;
        });
    };

    $scope.onCourseSelect = function () {
        $scope.getTutors();
        $scope.professors = $scope.settings.professors[$scope.formData.course.code];
    };

    $scope.onError = function (errorMessage) {
        $scope.formStatus.setErrorMessage(errorMessage);
        $scope.formStatus.setBlurForm(true);
        $scope.$apply();
    };

    $scope.setTutors = function () {
        // Selects first tutor in the list if possible, called on time change
        try {
            $scope.formData.tutor = $scope.tutors[$scope.formData.time][0];
        } catch (e) {
            console.log($scope.formStatus.messages.cantSetTutorEx);
        }
    };

    $scope.getTutors = function () {
        // event listener for time-select and course-select
        tutorService.getAvailableTutors($scope.settings, $scope.formData, function (tutors) {
            $scope.tutors = tutors;
            $scope.setTutors();
        });
    };

    $scope.resetForm = function () {
        $scope.formData = {
            selectedLocation: $scope.formData.selectedLocation,
            date: $scope.formData.date,
            isSpecificTutorRequested: false
        };

        $scope.tutors = {};
        $scope.formStatus.resetForm();
    };

    $scope.sendFeedback = function () {
        console.log('Sending feedback!');
        // TODO: implement
    };

    // BAD-BAD-BAD-BADDDDD, needs refactioring
    $scope.initialSetup = function (onStartup) {
        $scope.settings = {};
        $scope.resetForm();
        locationService.getLocations(function (locations) {
            // grabbing locations from chrome sync storage
            var isValidLocationObject = locationService.isValidLocation(locations);

            if (_.isEmpty(locations)) {
                $scope.onError($scope.formStatus.messages.noLocations);
                return;
            } else if (!isValidLocationObject) {
                $scope.onError($scope.formStatus.messages.invalidLocations);
                return;
            }

            $scope.locations = locations;
            if (onStartup) {
                // If ran for the first time select 1st (default) location
                $scope.formData.selectedLocation = $scope.locations[Object.keys($scope.locations)[0]];
            }

            settingsService.getSettings($scope.formData.selectedLocation, function (settings) {
                // TODO: check settings validity
                if (settings.error) {
                    $scope.onError(settings.error);
                    return;
                }
                // grabbing settings from from async api call and immediately setting courses
                $scope.settings = settings;
                $scope.courses = settings.courses;

                $scope.formStatus.setBlurForm(false);
                $scope.formStatus.setErrorMessage('');

                initialSetupService.getWebpageDate (function (initialDate) {
                    // grabbing data from currently open google calendar page which is stored in chrome local cache
                    // Since date is stored as a string 'YYYY/MM/DD', convert it to a date object
                    var ymd = initialDate ? initialDate.split('/') : moment().format('YYYY/MM/DD').split('/');

                    $scope.formData.date = new Date(parseInt(ymd[0]), parseInt(ymd[1])-1, parseInt(ymd[2]));
                    // update time entries based on this date
                    $scope.onDateSelect();
                    $scope.$apply();
                });
            });
        });
    };

    $scope.initialSetup(true); // startup
}]);
