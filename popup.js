main = function() {
    $('#schedule-button').addClass('disabled');

    $('#schedule-button').click(function(){
        var input = getInputData();
        chrome.runtime.sendMessage({method: 'schedule', details: input});
    });

    $('#inputDate').change(function(){
        date = $('#inputDate').val();
        $('#inputTutor').empty();
        $('#inputTime').val('');
        $('#schedule-button').addClass('disabled');
        chrome.runtime.sendMessage({method: 'onDateUpdate', details: date});
    });

    $('#inputTutor').change(function(){
        if(!isTutorSelected()){
            $('.status').text('Select a tutor');
            $('#schedule-button').addClass('disabled');
            return true;
        }

    });

    $('#inputStudent, #inputPhone').keyup(function(){
        if(!isTutorSelected()){
            $('.status').text('Select a tutor');
            $('#schedule-button').addClass('disabled');
            return true;
        }

        if(isStudentInformationValid() && isTutorSelected){
            $('.status').text('Phone number and student name are valid');
            $('#schedule-button').removeClass('disabled');
        }
        else {
            $('.status').text('Enter a valid phone number and student name');
            $('#schedule-button').addClass('disabled');
        }
    });

    $('#inputTime, #inputCourse').change(function(){
        $('#schedule-button').addClass('disabled');
        date = $('#inputDate').val();
        time = $('#inputTime').val();
        course = $('#inputCourse').val();
        chrome.runtime.sendMessage({method: 'getTutorList', popupDate: date, popupTime: time, popupCourse: course}, function(response){
            // On update of inputTime update list of available tutors in popup
            $('#inputTutor').empty();
            if(response) {
                var tutorList = response;
                for(var idx=0; idx < tutorList.length; idx++)
                    if (tutorList[idx] != '0'){
                        $('<option/>').val(tutorList[idx]).html(tutorList[idx]).appendTo('#inputTutor');
                    }
            }
            else
                $('#inputTutor').clear();
        if(!isTutorSelected()){
            $('.status').text('There are no tutors available at given time');
            $('#schedule-button').addClass('disabled');
            return true;
            }
        else if(isStudentInformationValid() && isTutorSelected){
            $('.status').text('Phone number and student name are valid');
            $('#schedule-button').removeClass('disabled');
            }
        });
   });

    chrome.runtime.sendMessage({method: 'popupClick'}, function(response){
        var date = response;
        $('#inputDate').attr("value", date);
    });

    // Populating time entries from background page
    chrome.runtime.getBackgroundPage(function (backgroundPage) {
        var timeEntries = backgroundPage.timeEntries;
        var courses = backgroundPage.courseNames;
        for(var key in timeEntries) {
            $('<option/>').val(key).html(key).appendTo('#inputTime');
        }
        for(var course in courses) {
            $('<option/>').val(course).html(course).appendTo('#inputCourse');
        }
    });

};

function isTutorSelected(){
    var tutorName = $('#inputTutor').val();
    if(tutorName)
        return true;
    else
        return false;
}

function isStudentInformationValid(){
    var studentName = $('#inputStudent').val();
    var phoneNumber = $('#inputPhone').val();


    if(isValidPhoneNumber(phoneNumber) && isValidName(studentName))
        return true;
    else
        return false;

}

function isValidPhoneNumber(phoneNumber){
    var phoneNumberRegex = /^(\()?(\d{3})(\))?[-\.\s]?(\d{3})[-\.\s]?(\d{4})$/;
    mo = phoneNumberRegex.exec(phoneNumber);
    if(mo)
        return true;
    else
        return false;
}

function isValidName(name){
    var nameRegex = /([A-Z]){1}.*\s([A-Z]){1}.*/;
    mo = nameRegex.exec(name);
    if(mo)
        return true;
    else
        return false;
}

function getInputData(){
    // Returns contents of forms as a list
    var date = $('#inputDate').val();
    var time = $('#inputTime').val();
    var course = $('#inputCourse').val();
    var tutorName = $('#inputTutor').val();
    var studentName = $('#inputStudent').val();
    var phoneNumber = $('#inputPhone').val();

    return [date, time,  course, tutorName, studentName, phoneNumber];
}

$(document).ready(main);
