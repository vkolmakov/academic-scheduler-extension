var dateText, datePickerDate, details, scheduledAppointments, isScheduled, tutorList;
var popupData = [];
var scheduledAppointmentRegex = /(.*\s.*)\s\((.*)\)\W{0,3}?\w{0,3}?\W{0,3}?\sw\/(\w*\s?\w{1}?)\W{0,3}?\w{0,3}?\W{0,3}?(\sNOTE:(.*))?/;
var calendarUrlRegex = /https:\/\/www\.google\.com\/calendar.*/;
var settings;

//test requestUrl: 'https://api.myjson.com/bins/28euu';

updateSettings();

var END_OF_THE_SEMETER = '20150830T000000Z';

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if(calendarUrlRegex.exec(tab.url))
        chrome.tabs.executeScript(tabId, {file: "content_script.js"}); // every time url is updated run content script again in order to get a new date
    else
        return true;
    });

chrome.storage.onChanged.addListener(function(changes, namespace) {
    updateSettings();
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
    var startDate, endDate;
    if(message.method == 'getDate') {
        dateText = message.dateText;
        return true;
    }
    else if(message.method == 'popupClick') {
        datePickerDate = convertToDatepickerDate(dateText);
        // Set startDate and endDate + 1 day after set date in order to get relevant list of scheduled appointments
        startDate = addDaysToDateString(datePickerDate, 0);
        endDate = addDaysToDateString(datePickerDate, 1);
        getScheduledAppointments(startDate, endDate);
        response = {
                     'date': datePickerDate,
                     'areSettingsPresent': areSettingsPresent(),
                   };
        sendResponse(response);
    }
    else if(message.method == 'onDateUpdate') {
        datePickerDate = message.details;

        startDate = addDaysToDateString(datePickerDate, 0);
        endDate = addDaysToDateString(datePickerDate, 1);
        getScheduledAppointments(startDate, endDate);
    }
    else if(message.method == 'schedule') {
        scheduleAppointment(message.details);
        return true;
    }
    else if(message.method == 'getTutorList') {
        tutorList = [];
        tutorList = getAvailableTutors(message.popupDate, message.popupTime, message.popupCourse);
        sendResponse(tutorList);
    }
    else if(message.method == 'getStatus') {
        sendResponse(isScheduled);
    }
});

function updateSettings() {
    chrome.storage.sync.get(function(items){
        var requestUrl = items.settingsUrl;
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function(){
            if(this.readyState == 4 && this.status == 200){
                var settings = JSON.parse(this.responseText);
                setSettings(settings);
            }
            else {
                setSettings(null);
            }
        };
        xhr.open('GET', requestUrl, true);
        xhr.send();
    });
}

function setSettings(new_settings){
    settings = new_settings;
}

function getScheduledAppointments(startTime, endTime) {
    var scheduledAppointments = [];
    chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
        var xhr = new XMLHttpRequest();
        var requestUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=' + startTime + '&timeMax=' + endTime;
        xhr.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                var resp = JSON.parse(this.responseText);
                scheduledAppointments = resp.items;
                setScheduledAppointmentsList(scheduledAppointments);
            }
        };
        xhr.open('GET', requestUrl , true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.send();
    });
}

function setScheduledAppointmentsList(array){
    scheduledAppointments = array;
}

function scheduleAppointment(details) {
    // details = [date, time,  course, tutorName, studentName, phoneNumber, isStudyGroup]
    if(details[3] == 'I\'m feeling lucky!')
        details[3] = selectRandomTutor();
    var appointmentText;
    var YearMonthDay = getYearMonthDay(details[0]);
    var startHour = timeEntries[details[1]];
    var endHour = (parseInt(startHour) + 1).toString();
    var startTime = getDateTimeString(new Date(YearMonthDay[0], YearMonthDay[1]-1, YearMonthDay[2]), startHour);
    var endTime = getDateTimeString(new Date(YearMonthDay[0], YearMonthDay[1]-1, YearMonthDay[2]), endHour);


    if(details[6] === true) {
        courseCode = settings.courseNames[details[2]];
        appointmentText = 'Study group (' + courseCode + ') ' + 'w/' + details[3];
        recurrenceText = "RRULE:FREQ=WEEKLY;UNTIL=" + END_OF_THE_SEMETER;
        descriptionText = rewritePhoneNumber(details[5]) + ' Students: ' + details[4];
    }
    else {
        appointmentText = getAppointmentText(details[2], details[4], details[3]);
        recurrenceText = null;
        descriptionText = rewritePhoneNumber(details[5]);
    }


    var eventData = {
                    "summary": appointmentText,
                    "start": {
                        "dateTime": startTime,
                        'timeZone': 'America/Chicago'
                    },
                    "end": {
                        "dateTime": endTime,
                        'timeZone': 'America/Chicago'
                    },
                    "recurrence": [
                        recurrenceText
                    ],
                    "colorId": courseColorID[settings.courseNames[details[2]]],
                    "description" : descriptionText
                };


    chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
        var xhr = new XMLHttpRequest();
        var requestUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events/';
        xhr.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                setStatus(true);
                return true;
            }
            else setStatus(false);
        };
        xhr.open('POST', requestUrl , true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(eventData));
    });
}
function setStatus(status){
    isScheduled = status;
}

function areSettingsPresent(){
    if(settings === null)
        return false;
    else
        return true;
}

/* Helper functions */
function selectRandomTutor(){
    tutorList.splice(tutorList.indexOf('I\'m feeling lucky!'), 1);
    var randomTutor = tutorList[Math.floor(Math.random() * tutorList.length)];
    return randomTutor;
}

function addDaysToDateString(dateString, days){
    var YearMonthDay = getYearMonthDay(dateString);
    var dateObject = new Date(YearMonthDay[0], YearMonthDay[1]-1, YearMonthDay[2]);

    dateObject.setDate(dateObject.getDate() + days);
    return dateObject.toISOString().substring(0,10) + 'T00:00:00-05:00';
}

function getAvailableTutors(popupDate, popupTime, popupCourse){
    var tutorList = [];

    var time = timeEntries[popupTime];
    var YearMonthDay = getYearMonthDay(popupDate);
    var dateObject = new Date(YearMonthDay[0], YearMonthDay[1]-1, YearMonthDay[2]);

    var weekDay = dayNames[dateObject.getDay()];
    tutorList = filterTutorList(settings.schedule[weekDay][time], popupCourse, dateObject, time);

    return tutorList;
}

function filterTutorList(tempTutorList, popupCourse, dateObject, time){
    var tutorList = [];
    for(var i = 0; i < tempTutorList.length; i++){
        if(isAbleToTuror(tempTutorList[i], popupCourse)) tutorList.push(tempTutorList[i]);
    }

    // Get appointments that are only at a certain day + time and extract busy tutors from them
    var startTime = getDateTimeString(dateObject, time);
    var summaries = getAppointmentSummaries(startTime);
    var busyTutors = getTutorsFromSummaries(summaries);

    tutorList = tutorList.filter(function(tutor){
        return busyTutors.indexOf(tutor) < 0;
    });

    // Add I'm feeling lucky option
    if(tutorList.length > 0)
        tutorList.unshift('I\'m feeling lucky!');

    return tutorList;
}

function getDateTimeString(dateObject, time){
    var date = dateObject.toISOString().substring(0,10);
    var timeString = time.toString();
    return date + 'T' + (timeString[1]?timeString:"0"+timeString[0]) + ':00:00-05:00';
}

function getAppointmentSummaries(startTime){
    var summaries = [];
    for(i = 0; i < scheduledAppointments.length; i++){
        if(scheduledAppointments[i].start.dateTime == startTime)
            summaries.push(scheduledAppointments[i].summary);
        }
    return summaries;
}

function getTutorsFromSummaries(summaries){
    var tutors = [];
    for(i = 0; i < summaries.length; i++){
        var mo = scheduledAppointmentRegex.exec(summaries[i]);
        if(mo)
            tutors.push(mo[3]);
    }
    return tutors;
}

function isAbleToTuror(tutorName, course){
    courseCode = settings.courseNames[course];
    if(tutorName == '0')
        return false;
    try{
        if(contains(settings.tutorCourse[tutorName], courseCode) || contains(settings.tutorCourse.Everyone, courseCode))
            return true;
    }
    catch (error){
        //In case that tutor name is not in the settings.js file
        console.log(error);
        return false;
    }
    return false;
}

function contains(array, element){
  for(var i = 0; i < array.length; i++){
    if(array[i] === element) return true;
  }
  return false;
}

function getYearMonthDay(popupDate){
    var year = parseInt(popupDate.substring(0,4));
    var month = parseInt(popupDate.substring(5,7));
    var day = parseInt(popupDate.substring(8,10));

    return [year, month, day];
}
function getAppointmentText(courseName, studentName, tutorName) {
    // Takes appointment details and returns appointment text
    var courseNumber = settings.courseNames[courseName];
    var appointmentText = studentName + " (" + courseNumber + ") " + "w/" + tutorName;
    return appointmentText;
}

function convertToDatepickerDate(dateText) {
    // Converts date text from google calendar page into form for datepicker
    var dateRegex = /.*,\s(\w{3})\s(\d{1,2}),\s(\d{4})/;
    var mo = dateRegex.exec(dateText);
    month = getMonth(mo[1]);
    day = ("0" + (mo[2])).slice(-2);
    year = mo[3];
    var datePickerDate = year + '-' + month + '-' + day;
    return datePickerDate;
}

function rewritePhoneNumber(phoneNumber){
    // Returns given phoneNumber in format (XXX)-XXX-XXXX
    phoneNumberRegex = /^\(?(\d{3})\)?[-\.\s]?(\d{3})[-\.\s]?(\d{4})$/;

    updatedPhoneNumber = phoneNumber.replace(phoneNumberRegex, '($1)-$2-$3');
    return updatedPhoneNumber;
}

function getMonth(month) {
    // Converts month name into number
    var months = {
        'Jan': '01',
        'Feb': '02',
        'Mar': '03',
        'Apr': '04',
        'May': '05',
        'Jun': '06',
        'Jul': '07',
        'Aug': '08',
        'Sep': '09',
        'Oct': '10',
        'Nov': '11',
        'Dec': '12'
    };
    return months[month];
}

var dayNames = new Array(
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
);

var courseColorID = {'99': '10',
                '143': '10',
                '204': '10',
                '207': '10',
                '118': '8',
                '125': '9',
                '144': '4',
                '146': '2',
                '208': '5',
                '209': '6',
                '210': '3',
                '212': '7'};

var timeEntries = {'9:00am': '9',
               '10:00am': '10',
               '11:00am': '11',
               '12:00pm': '12',
               '1:00pm': '13',
               '2:00pm': '14',
               '3:00pm': '15',
               '4:00pm': '16',
               '5:00pm': '17',
               '6:00pm': '18',
               '7:00pm': '19'};
