main = function() {

    var isStudyGroup = false;

    $('body').keyup(function(event) {
        if(event.which == '0x0D' && isTutorSelected() && isStudentInformationValid())
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
        date = $('#inputDate').val();
        $('#inputTutor').empty();
        $('#inputTime').val('');
        $('#schedule-button').prop('disabled', true);
        displayErrorMessage(statusMessages.selectTime);
        chrome.runtime.sendMessage({method: 'onDateUpdate', details: date});
    });

    $('#inputTutor').change(function() {
        if(!isTutorSelected()) {
            displayErrorMessage(statusMessages.noTutorsAvailable);
            return true;
        }
    });

    $('#inputStudent, #inputPhone').keyup(function() {
        if(!isTutorSelected()) {
            displayErrorMessage(statusMessages.noTutorsAvailable);
            return true;
        }
        if(isStudentInformationValid() && isTutorSelected) {
            displayMessage(statusMessages.readyToSchedule);
            $('#schedule-button').prop('disabled', false);
        }
        else {
            displayErrorMessage(statusMessages.invalidInput);
        }
    });

    $('#inputTime, #inputCourse').change(function() {
        date = $('#inputDate').val();
        time = $('#inputTime').val();
        course = $('#inputCourse').val();
        updateTutorList(date, time, course);
   });

   chrome.runtime.sendMessage({method: 'popupClick'}, function(response) {
       if(response.areSettingsPresent === false) {
           blockEverything(statusMessages.noSettingsFound);
           throw new Error(statusMessages.noSettingsFound);
       }
       var date = response.date;
       $('#inputDate').attr("value", date);
   });

   // Populating time entries from background page
   chrome.runtime.getBackgroundPage(function (backgroundPage) {
       var timeEntries = backgroundPage.timeEntries;
       var courses = backgroundPage.settings.courseNames;
       if(!courses) {
            blockEverything(statusMessages.noSettingsFound);
            throw new Error(statusMessages.noSettingsFound);
        }
       for(var key in timeEntries) {
           $('<option/>').val(key).html(key).appendTo('#inputTime');
       }
       for(var course in courses) {
           $('<option/>').val(course).html(course).appendTo('#inputCourse');
       }
       clearForms();
   });
};

function scheduleButtonHandler(isStudyGroup) {
    var input = getInputData(isStudyGroup);
    $('#schedule-button').prop('disabled', true);
    disableInputs();
    chrome.runtime.sendMessage({method: 'schedule', details: input});
    changeStatus();
}

function changeStatus() {
    displayMessage(statusMessages.scheduledInProccess);
    var printDots = setInterval(animateDots, 833);
    setTimeout(function() {
        clearInterval(printDots);
        chrome.runtime.sendMessage({method: 'getStatus'}, function(response) {
            if(response === true) {
                displayMessage(statusMessages.scheduledSuccess);
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
            if(!isTutorSelected())
                displayErrorMessage(statusMessages.noTutorsAvailable);
            else if(!isStudentInformationValid())
                displayErrorMessage(statusMessages.invalidInput);
            else {
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
    if(tutorName === null)
        return false;
    else
        return true;
}

function isStudentInformationValid() {
    var studentName = $('#inputStudent').val();
    var phoneNumber = $('#inputPhone').val();


    if(isValidPhoneNumber(phoneNumber) && isValidName(studentName))
        return true;
    else
        return false;

}

function isValidPhoneNumber(phoneNumber) {
    var phoneNumberRegex = /^(\()?(\d{3})(\))?[-\.\s]?(\d{3})[-\.\s]?(\d{4})$/;
    mo = phoneNumberRegex.exec(phoneNumber);
    if(mo)
        return true;
    else
        return false;
}

function isValidName(name) {
    var nameRegex = /([A-Z]){1}.*\s([A-Z]){1}.*/;
    mo = nameRegex.exec(name);
    if(mo)
        return true;
    else
        return false;
}

function getInputData(isStudyGroup) {
    // Returns contents of forms as a list
    var date = $('#inputDate').val();
    var time = $('#inputTime').val();
    var course = $('#inputCourse').val();
    var tutorName = $('#inputTutor').val();
    var studentName = $('#inputStudent').val();
    var phoneNumber = $('#inputPhone').val();
    var note = $('#inputNote').val();

    if(note === '')
        note = null;

    return [date, time,  course, tutorName, studentName, phoneNumber, isStudyGroup, note];
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
    $('#inputTutor').empty();
    $('#schedule-button').prop('disabled', true);
    $('input').each(function(index, value) {
        if($(this).val() != $('#inputDate').val())
            $(this).val('');
    });
    $('select').each(function(index, value) {
        $(this).val('');
    });
}

var statusMessages = {
    'noTutorsAvailable': 'There are no tutors available at given time',
    'defaultMessage': 'Scheduling extension, select date/time/course',
    'readyToSchedule': 'Phone number and student name are valid, appointment may be scheduled',
    'scheduledInProccess': 'Trying to schedule an appointment',
    'invalidInput': 'Enter a valid phone number and student name',
    'scheduledSuccess': 'Appointment has been scheduled, click Clear to schedule one more',
    'scheduledFailure': 'Appointment was NOT scheduled',
    'scheduledUndetermined': 'Reload the calendar and double-check the appointment status',
    'selectTime': 'Select time',
    'selectCourse': 'Select course',
    'noSettingsFound': 'No settings file found. Make sure settings URL in settings is correct'
};

$(document).ready(main);
