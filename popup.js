main = function() {
    var isStudyGroup = false;
    addEventListeners();
    initialSetup();
};

function addEventListeners() {
    $('body').keyup(function(event) {
        if(event.which == '0x0D' && checkFields())
            scheduleButtonHandler(isStudyGroup);
    });

    $('#individual-button').click(function() {
        isStudyGroup = false;
        $('#group-button').removeClass('btn-primary');
        $('#inputNote').prop('disabled', false);
        $(this).addClass('btn-primary');
        $('#inputStudentLabel').text('Name');
        $('body').removeClass('group');
    });

    $('#group-button').click(function() {
        isStudyGroup = true;
        $('#individual-button').removeClass('btn-primary');
        $('#inputNote').prop('disabled', true);
        $('#inputNote').val('');
        $(this).addClass('btn-primary');
        $('#inputStudentLabel').text('Names');
        $('body').addClass('group');
    });

    $('#schedule-button').click(function() {
        scheduleButtonHandler(isStudyGroup);
    });

    $('#clear-button').click(function() {
        chrome.runtime.sendMessage({method: 'onDateUpdate', details: date}); // Refreshing scheduled appointments
        clearForms();
    });

    $('#inputDate').change(function() {
        var date = $('#inputDate').val();
        var course = $('#inputCourse').val();
        $('#inputTutor').empty();
        $('#inputTime').val('');
        $('#schedule-button').prop('disabled', true);
	fillTimeSelect(date);
        checkFields();
        chrome.runtime.sendMessage({method: 'onDateUpdate', details: date});
        updateAvailableSlotsList(date, course);
    });

    $('#inputTutor').change(function() {
        checkFields();
        if(!isTutorSelected()) {
            displayErrorMessage(statusMessages.noTutorsAvailable);
            return true;
        }
    });

    $('#inputStudent, #inputPhone, #inputInitials').keyup(function() {
        if(checkFields()) { // Ready to schedule
            displayMessage(statusMessages.readyToSchedule);
            $('#schedule-button').prop('disabled', false);
        }
    });

    $('#inputTime, #inputCourse').change(function(event) {
        date = $('#inputDate').val();
        time = $('#inputTime').val();
        course = $('#inputCourse').val();
        if (event.target.id == 'inputCourse') {
            updateProfessorsList(course);
            updateAvailableSlotsList(date, course);
        }
        updateTutorList(date, time, course);
        if(checkFields()) {
            displayMessage(statusMessages.readyToSchedule);
            $('#schedule-button').prop('disabled', false);
        }
    });

    $('#inputProfessor').change(function(event) {
	if(checkFields()) {
            displayMessage(statusMessages.readyToSchedule);
            $('#schedule-button').prop('disabled', false);
	}
    });
}

function initialSetup() {
    fillCourses();
    setDate(fillTimeSelect);
}

function fillCourses() {
    chrome.runtime.getBackgroundPage(function(backgroundPage) {
	var courses = backgroundPage.settings.courses;
	if(!courses) {
            blockEverything(statusMessages.noSettingsFound);
            throw new Error(statusMessages.noSettingsFound);
	}
	var courses_names = [];

        for(var course in courses) {
            courses_names.push(course);
        }
        courses_names.sort();

        for(var i = 0; i < courses_names.length; i++) {
            $('<option/>').val(courses_names[i]).html(courses_names[i]).appendTo('#inputCourse');
        }
    });
}

function setDate(callback) {
    chrome.runtime.sendMessage({method: 'popupClick'}, function(response) {
	if(response.areSettingsPresent === false) {
            blockEverything(statusMessages.noSettingsFound);
            throw new Error(statusMessages.noSettingsFound);
	}
	var date = response.date;
	$('#inputDate').attr("value", date);
	callback(date);
    });
}

function fillTimeSelect(date) {
    chrome.runtime.getBackgroundPage(function (backgroundPage) {
	
	$("#inputTime option[value!='']").remove();
	
	var timeEntries = backgroundPage.timeEntries;
	var weekDay = backgroundPage.getWeekDay(date);
	var timeToDisplay = Object.keys(backgroundPage.settings.schedule[weekDay]);
        for(var key in timeEntries) {
	    // Checking if time is listed in schedule
	    if(backgroundPage.contains(timeToDisplay, timeEntries[key]))
		$('<option/>').val(key).html(key).appendTo('#inputTime');
	}
	$('#inputTime').val('');
    });
}

function scheduleButtonHandler(isStudyGroup) {
    var input = getInputData(isStudyGroup);
    $('#schedule-button').prop('disabled', true);
    disableInputs();
    chrome.runtime.sendMessage({method: 'schedule', details: input});
    changeStatus();
}

function changeStatus() {
    $('input').each(function(index, value) {
        $(this).parent().parent().removeClass('has-error');
    });
    $('select').each(function(index, value) {
        $(this).parent().parent().removeClass('has-error');
    });

    displayMessage(statusMessages.scheduledInProccess);
    var printDots = setInterval(animateDots, 833);
    setTimeout(function() {
        clearInterval(printDots);
        chrome.runtime.sendMessage({method: 'getStatus'}, function(response) {
            if(response === true) {
                displayMessage(statusMessages.scheduledSuccess);
                $("#available-slots-list tr").remove();
            }
            else if(response === false) {
                displayErrorMessage(statusMessages.scheduledFailure);
            }
            else{
                // Case where XHR request was not completed in 2.5 seconds
                displayErrorMessage(statusMessages.scheduledUndetermined);
            }
        });
    }, 2500);
}
function animateDots(dots) {
    $('.status').append('.');
}

function blockEverything(message) {
    $('.col-xs-6').each(function(index, value) {
        $(this).addClass('blur');
    });
    $('.pannel-footer').addClass('blur');
    disableInputs();
    $('#clear-button').prop('disabled', true);
    displayErrorMessage(message);
}

function displayErrorMessage(message) {
    $('.status').text(message);
    $('#schedule-button').prop('disabled', true);
    $('.status').addClass('status-error');
}
function displayMessage(message) {
    $('.status').text(message);
    $('.status').removeClass('status-error');
}

function updateProfessorsList(course) {
    if(course === null) {
        displayErrorMessage(statusMessages.selectCourse);
        return true;
    }
    chrome.runtime.sendMessage({method: 'getProfessorsList', course: course}, function(response) {
        $('#inputProfessor').empty().append('<option value="" select disabled>Select Professor</option>');
        if(response) {
            var professorsList = response;
            for(var idx = 0; idx < professorsList.length; idx++)
                $('<option/>').val(professorsList[idx]).html(professorsList[idx]).appendTo('#inputProfessor');
            if(professorsList.length > 1) // 'forcing' to select a professor if required
                $('#inputProfessor').val('');
        }
        else {
            $('#inputProfessor').empty().append('<option value="" select disabled>Select Professor</option>');
            displayErrorMessage(statusMessages.noSettingsFound);
        }
    });
}

function updateTutorList(date, time, course) {
    if(time === null) {
        displayErrorMessage(statusMessages.selectTime);
        return true;
    }
    else if(course === null) {
        displayErrorMessage(statusMessages.selectCourse);
        return true;
    }
    chrome.runtime.sendMessage({method: 'getTutorList', popupDate: date, popupTime: time, popupCourse: course}, function(response) {
        // On update of inputTime update list of available tutors in popup
        $('#inputTutor').empty();
        if(response) {
            var tutorList = response;
            for(var idx=0; idx < tutorList.length; idx++)
                if (tutorList[idx] != '0') {
                    $('<option/>').val(tutorList[idx]).html(tutorList[idx]).appendTo('#inputTutor');
                }
            if(checkFields()) {
                displayMessage(statusMessages.readyToSchedule);
                $('#schedule-button').prop('disabled', false);
            }
        }
        else {
            $('#inputTutor').empty();
        }
    });
    if(!isTutorSelected())
        displayErrorMessage(statusMessages.noTutorsAvailable);
}

function isTutorSelected() {
    var tutorName = $('#inputTutor').val();
    if(tutorName === null) {
        highlightField('error', '#inputTutor');
        return false;
    }
    else {
        highlightField('success', '#inputTutor');
        return true;
    }
}
function isProfessorSelected() {
    if($('#inputProfessor').val() === null) {
        highlightField('error', '#inputProfessor');
        return false;
    }
    else {
        highlightField('success', '#inputProfessor');
        return true;
    }
}

function isTimeSelected() {
    if($('#inputTime').val() === null) {
        highlightField('error', '#inputTime');
        return false;
    }
    else {
        highlightField('success', '#inputTime');
        return true;
    }
}

function isStudentInformationValid() {
    var studentName = $('#inputStudent').val();
    var contactInfo = $('#inputPhone').val();
    isValidName(studentName);
    isValidContactInfo(contactInfo);
    if(isValidContactInfo(contactInfo) && isValidName(studentName))
        return true;
    else
        return false;
}

function isValidContactInfo(contactInfo) {
    var contactInfoRegex = /(^(\()?(\d{3})(\))?[-\.\s]?(\d{3})[-\.\s]?(\d{4})$)|(^\S+@\S+\.\S+$)/;
    mo = contactInfoRegex.exec(contactInfo);
    if(mo) {
        highlightField('success', '#inputPhone');
        return true;
    }
    else {
        highlightField('error', '#inputPhone');
        return false;
    }
}

function isValidName(name) {
    var nameRegex = /.*\s.*/;
    mo = nameRegex.exec(name);
    if(mo) {
        highlightField('success', '#inputStudent');
        return true;
    }
    else {
        highlightField('error', '#inputStudent');
        return false;
    }
}

function isSigned() {
    var initials = $('#inputInitials').val();
    var initialsRegex = /^[a-z]+$/i;
    mo = initialsRegex.exec(initials);
    if(mo) {
        highlightField('success', '#inputInitials');
        return true;
    }
    else {
        highlightField('error', '#inputInitials');
        return false;
    }
}

function highlightField(type, elementId) {
    if(type == 'error') {
        $(elementId).parent().parent().addClass('has-error');
    }
    else if(type == 'success') {
        $(elementId).parent().parent().removeClass('has-error');
    }
}

function checkFields() {
    /* Function that is called from every event listener that detemines if we are ready to schedule an appointment */
    isProfessorSelected();
    isStudentInformationValid();
    isTutorSelected();
    isTimeSelected();
    isSigned();
    if(isProfessorSelected() && isStudentInformationValid() && isTutorSelected() && isTimeSelected() && isSigned()) {
        return true; // That will highlight every field needed to be filled out and return true if eveyrhing is ok to schedule
    }
    // the following block of code will check fields in order of urgency and display an appropriate message
    if(!isTimeSelected()) {
        displayErrorMessage(statusMessages.selectTime);
        return false;
    }
    if(!isTutorSelected()) {
        displayErrorMessage(statusMessages.noTutorsAvailable);
        return false;
    }
    if(!isProfessorSelected()) {
        displayErrorMessage(statusMessages.selectProfessor);
        return false;
    }
    if(!isStudentInformationValid()) {
        displayErrorMessage(statusMessages.invalidInput);
        return false;
    }
    if(!isSigned()) {
        displayErrorMessage(statusMessages.noInitials);
        return false;
    }
}

function getInputData(isStudyGroup) {
    // Returns contents of forms as an object
    var date = $('#inputDate').val();
    var time = $('#inputTime').val();
    var course = $('#inputCourse').val();
    var tutorName = $('#inputTutor').val();
    var studentName = $('#inputStudent').val();
    var phoneNumber = $('#inputPhone').val();
    var note = $('#inputNote').val();
    var professorName = $('#inputProfessor').val();
    var initials = $('#inputInitials').val();

    if(note === '')
        note = null;
    return {'date': date,
            'time': time,
            'course': course,
            'tutorName': tutorName,
            'studentName': studentName,
            'phoneNumber': phoneNumber,
            'isStudyGroup': isStudyGroup,
            'note': note,
            'professorName': professorName,
            'initials': initials
           };
}
function disableInputs() {
    $('#schedule-button').prop('disabled', true);
    $('input').each(function(index, value) {
        $(this).prop('disabled', true);
    });
    $('select').each(function(index, value) {
        $(this).prop('disabled', true);
    });
}
function enableInputs() {
    $('#schedule-button').prop('disabled', true);
    $('input').each(function(index, value) {
        $(this).prop('disabled', false);
    });
    $('select').each(function(index, value) {
        $(this).prop('disabled', false);
    });
}

function clearForms() {
    displayMessage(statusMessages.defaultMessage);
    enableInputs();
    $("#available-slots-list tr").remove();
    $('#inputTutor').empty();
    $('#schedule-button').prop('disabled', true);
    $('input').each(function(index, value) {
        if($(this).val() != $('#inputDate').val()) {
            $(this).val('');
            $(this).parent().parent().removeClass('has-error');
        }
    });
    $('select').each(function(index, value) {
        $(this).val('');
        $(this).parent().parent().removeClass('has-error');
    });
}

function updateAvailableSlotsList(date, course) {
    $("#available-slots-list tr").remove();
    if(!(date && course)){
        displayErrorMessage(statusMessages.selectCourse);
        return;
    }
    chrome.runtime.sendMessage({method: 'getSlotsList', date: date, course: course}, function(response){
        chrome.runtime.getBackgroundPage(function (backgroundPage) {
            var timeEntries = backgroundPage.timeEntries;
	    var weekDay = backgroundPage.getWeekDay(date);
	    var timeToDisplay = Object.keys(backgroundPage.settings.schedule[weekDay]);
            for(var currentTime in response) { //TODO: Make sure that order is correct
		if(backgroundPage.contains(timeToDisplay, timeEntries[currentTime])) {
		    var $row = getSlotRow(currentTime, response[currentTime]);
                    $('#available-slots-list').append($row);
		}
            }
            $('html').height($('#main').height());
        });
    });
}

function getSlotRow(time, tutorList) {
    var text = '';
    var type;

    if(tutorList.length === 0) {
        text += time + ': No available tutors';
        type = 'slot-unavailable';
    }
    else {
        text += time + ': ' + tutorList.length + ' available';
        type = 'slot-available';
    }
    var $row = $('<tr>', {class: type, id:time});
    var $td = $('<td>', {text: text});
    $row.append($td);
    return $row;
}

var statusMessages = {
    'noTutorsAvailable': 'There are no tutors available at given time',
    'defaultMessage': 'Scheduling extension, select date/time/course',
    'readyToSchedule': 'Everything is valid, appointment may be scheduled',
    'scheduledInProccess': 'Trying to schedule an appointment',
    'invalidInput': 'Enter a valid phone number OR email address and student name',
    'scheduledSuccess': 'Appointment has been scheduled, click Clear to do start over',
    'scheduledFailure': 'Appointment was NOT scheduled',
    'scheduledUndetermined': 'Reload the calendar and double-check the appointment status',
    'selectTime': 'Select time',
    'selectCourse': 'Select course',
    'noSettingsFound': 'No settings file found. Make sure settings URL is correct',
    'selectProfessor': 'Select a professor',
    'noInitials': 'Sign with your initials'
};


$(document).ready(main);
