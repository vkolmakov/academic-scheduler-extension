var dateText, datePickerDate, details, scheduledAppointments, isScheduled, tutorList;
var popupData = [];
var scheduledAppointmentRegex = /(.*?)\s+?\((.*?)\s*?\W?\s*?(.*?)\)\s.*?[w](?:[\/\\\s]|(?:ith))+(\w*.*?)\s*?(\sNOTE:(.*))?/i;
var calendarUrlRegex = /(https:\/\/www\.google\.com\/calendar.*)|(https:\/\/calendar\.google\.com\/calendar\/*)/;
var settings, END_OF_THE_SEMETER;

//test requestUrl: 'https://api.myjson.com/bins/28euu';

updateSettings();

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
        console.log("From event listener: ", startDate, endDate, datePickerDate);
        try {
            getScheduledAppointments(startDate, endDate);
        }
        catch(error) {
            console.log(error);
        }

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

        if(!startDate)
            return true;

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
    else if(message.method == 'getProfessorsList') {
        sendResponse(getProfessorsList(message.course));
    }
    else if(message.method == 'getSlotsList') {
        sendResponse(getAvailableSlots(message.date, message.course));
    }
});

function updateSettings() {
    chrome.storage.sync.get(function(items){
        var requestUrl = items.settingsUrl;
        var endSemesterDate = items.endSemesterDate;
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function(){
            if(this.readyState == 4 && this.status == 200){
                var settings = JSON.parse(this.responseText);
                setSettings(settings, endSemesterDate);
            }
            else {
                setSettings(null, endSemesterDate);
            }
        };
        xhr.open('GET', requestUrl, true);
        xhr.send();
    });
}

function setSettings(newSettings, newEndSemesterDate){
    settings = newSettings;
    END_OF_THE_SEMETER = rewriteRecurrenceDate(newEndSemesterDate);
}

function rewriteRecurrenceDate(date){
    return date.replace(/-/g, '') + 'T000000Z';
}

function getScheduledAppointments(startTime, endTime) {
    console.log(startTime, endTime);
    var scheduledAppointments = [];
    var request_parameters = 'timeMin=' + startTime + '&timeMax=' + endTime + '&singleEvents=true';
    chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
        var xhr = new XMLHttpRequest();
        var requestUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
        xhr.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                var resp = JSON.parse(this.responseText);
                console.log("From getScheduledAppointments", resp);
                scheduledAppointments = resp.items;
                setScheduledAppointmentsList(scheduledAppointments);
            }
        };
        xhr.open('GET', requestUrl + '?' + request_parameters, true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.send();
    });
}

function setScheduledAppointmentsList(array){
    scheduledAppointments = array;
}

function scheduleAppointment(details) {
    if(details.tutorName == 'I\'m feeling lucky!')
        details.tutorName = selectRandomTutor();
    var appointmentText;
    var YearMonthDay = getYearMonthDay(details.date);
    var startHour = timeEntries[details.time];
    var endHour = (parseInt(startHour) + 1).toString();
    var startTime = getDateTimeString(new Date(YearMonthDay[0], YearMonthDay[1]-1, YearMonthDay[2]), startHour);
    var endTime = getDateTimeString(new Date(YearMonthDay[0], YearMonthDay[1]-1, YearMonthDay[2]), endHour);


    if(details.isStudyGroup === true) {
        courseCode = settings.courses[details.course].code; // TEST
        appointmentText = 'Study group (' + courseCode + '; ' + details.professorName + ') w/' + details.tutorName;
        recurrenceText = "RRULE:FREQ=WEEKLY;UNTIL=" + END_OF_THE_SEMETER;
        descriptionText = rewritePhoneNumber(details.phoneNumber) + ' Students: ' + details.studentName;
    }
    else {
        appointmentText = getAppointmentText(details.course, details.studentName, details.tutorName, details.note, details.professorName);
        recurrenceText = null;
        descriptionText = rewritePhoneNumber(details.phoneNumber);
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
                    "colorId": settings.courses[details.course].color, // TEST
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

function getAvailableSlots(date, course) {
    var availableSlots = {};
    for(var currentTime in timeEntries) {
        var tutorList = getAvailableTutors(date, currentTime, course);
        tutorList.splice(tutorList.indexOf('I\'m feeling lucky!'), 1);
        availableSlots[currentTime] = tutorList; // TODO: Make sure that they are in correct oreder
    }
    return availableSlots;
}

/* Helper functions */
// function selectRandomTutor(){
//     tutorList.splice(tutorList.indexOf('I\'m feeling lucky!'), 1);
//     var randomTutor = tutorList[Math.floor(Math.random() * tutorList.length)];
//     return randomTutor;
// }

function selectRandomTutor() {
    tutorList.splice(tutorList.indexOf('I\'m feeling lucky!'), 1);
    var min_num_courses = settings.tutors[tutorList[0]].length;
    var tutors_to_select = [];
    tutors_to_select.push(tutorList[0]);
	for(var i = 0; i < tutorList.length; i++) {
        var num_courses = settings.tutors[tutorList[i]].length;
        if (num_courses  == min_num_courses)
        	tutors_to_select.push(tutorList[i]);
    	else if(num_courses  < min_num_courses) {
            min_num_courses = num_courses; // Resetting the minumum
            tutors_to_select = [];
            tutors_to_select.push(tutorList[i]);
	    }
	}

    console.log(tutors_to_select);
    console.log(min_num_courses);

    var randomTutor = tutors_to_select[Math.floor(Math.random() * tutors_to_select.length)];
    return randomTutor;
}

function addDaysToDateString(dateString, days){
    var YearMonthDay = getYearMonthDay(dateString);
    if(!YearMonthDay)
        return null;

    var dateObject = new Date(YearMonthDay[0], YearMonthDay[1]-1, YearMonthDay[2]);

    dateObject.setDate(dateObject.getDate() + days);
    return dateObject.toISOString().substring(0,10) + 'T00:00:00-06:00';
}

function getProfessorsList(course) {
    return settings.professors[settings.courses[course].code];
}

function getAvailableTutors(popupDate, popupTime, popupCourse){
    var tutorList = [];
    var time = timeEntries[popupTime];
    var YearMonthDay = getYearMonthDay(popupDate);
    if(!YearMonthDay)
        return null;
    var dateObject = new Date(YearMonthDay[0], YearMonthDay[1]-1, YearMonthDay[2]);

    var weekDay = dayNames[dateObject.getDay()];

    try {
        if(!settings.schedule[weekDay][time])
            return []; // If day-time is not in schedule return empty list
        tutorList = filterTutorList(settings.schedule[weekDay][time], popupCourse, dateObject, time);
    } catch (error) {
        console.log(error);
        return [];
    }
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
    return date + 'T' + (timeString[1]?timeString:"0"+timeString[0]) + ':00:00';
}

function getAppointmentSummaries(startTime){
    var summaries = [];
    for(i = 0; i < scheduledAppointments.length; i++) {
        try {
        if(scheduledAppointments[i].start.dateTime.indexOf(startTime) > -1) // Check if startTime is a substring of event.start.dateTime
            summaries.push(scheduledAppointments[i].summary);
        }
        catch(error){
            console.log(error);
        }
    }
    return summaries;
}

function getTutorsFromSummaries(summaries){
    var tutors = [];
    for(i = 0; i < summaries.length; i++){
        var mo = scheduledAppointmentRegex.exec(summaries[i]);
        if(mo)
            tutors.push(mo[4]);
    }
    return tutors;
}

function isAbleToTuror(tutorName, course){
    courseCode = settings.courses[course].code; // TEST
    if(tutorName == '0')
        return false;
    try{
        if(contains(settings.tutors[tutorName], courseCode) || contains(settings.tutors.Everyone, courseCode)) // TEST
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
    var year, month, day;

    try {
        year = parseInt(popupDate.substring(0,4));
        month = parseInt(popupDate.substring(5,7));
        day = parseInt(popupDate.substring(8,10));
    }
    catch(error) {
        return null;
    }

    return [year, month, day];
}
function getAppointmentText(courseName, studentName, tutorName, note, professorName) {
    // Takes appointment details and returns appointment text
    var courseNumber = settings.courses[courseName].code;
    var appointmentText = rewriteName(studentName) + " (" + courseNumber + "; " + professorName + ") " + "w/" + tutorName;
    if(note)
        appointmentText += (" NOTE: " + note);
    return appointmentText;
}

function rewriteName(name) {
    var tokens = name.split(" ");
    for (var i = 0; i < tokens.length; i++) {
    	var first_letter = tokens[i].charAt(0).toUpperCase();
        tokens[i] = first_letter + tokens[i].substr(1).toLowerCase();
    }
    return tokens.join(" ");
}

function convertToDatepickerDate(dateText) {
    // Converts date text from google calendar page into form for datepicker
    var dateRegex = /.*,\s(\w{3})\s(\d{1,2}),\s(\d{4})/;
    var mo = dateRegex.exec(dateText);

    try {
        month = getMonth(mo[1]);
    }
    catch(error) {
        return null;
    }
    day = ("0" + (mo[2])).slice(-2);
    year = mo[3];
    var datePickerDate = year + '-' + month + '-' + day;
    return datePickerDate;
}

function rewritePhoneNumber(phoneNumber){
    // Returns given phoneNumber in format (XXX)-XXX-XXXX
    phoneNumberRegex = /^\(?(\d{3})\)?[-\.\s]?(\d{3})[-\.\s]?(\d{4})$/;

    updatedPhoneNumber = phoneNumber.replace(phoneNumberRegex, '($1)$2-$3');
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
