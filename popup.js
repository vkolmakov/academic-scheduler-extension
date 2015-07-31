main = function() {
    $('#schedule-button').prop('disabled', true);

    $('#schedule-button').click(function(){
        var input = getInputData();
        $('#schedule-button').prop('disabled', true);
        $('.status').text('Trying to schedule an appointment...');
        chrome.runtime.sendMessage({method: 'schedule', details: input});
        changeStatus();
        // TODO: Do something to wait and grab status + disable button
    });

    $('#inputDate').change(function(){
        date = $('#inputDate').val();
        $('#inputTutor').empty();
        $('#inputTime').val('');
        $('#schedule-button').prop('disabled', true);
        chrome.runtime.sendMessage({method: 'onDateUpdate', details: date});
    });

    $('#inputTutor').change(function(){
        if(!isTutorSelected()){
            $('.status').text('Select a tutor');
            $('#schedule-button').prop('disabled', true);
            return true;
        }

    });

    $('#inputStudent, #inputPhone').keyup(function(){
        if(!isTutorSelected()){
            $('.status').text('Select a tutor');
            $('#schedule-button').prop('disabled', true);
            return true;
        }

        if(isStudentInformationValid() && isTutorSelected){
            $('.status').text('Phone number and student name are valid');
            $('#schedule-button').prop('disabled', false);
        }
        else {
            $('.status').text('Enter a valid phone number and student name');
            $('#schedule-button').prop('disabled', true);
        }
    });

    $('#inputTime, #inputCourse').change(function(){
        $('#schedule-button').prop('disabled', true);
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
            $('#schedule-button').prop('disabled', true);
            return true;
            }
        else if(isStudentInformationValid() && isTutorSelected){
            $('.status').text('Phone number and student name are valid');
            $('#schedule-button').prop('disabled', false);
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

function changeStatus() {
    console.log('inside the function');
    setTimeout(function(){
        console.log('inside the timeout');
        chrome.runtime.sendMessage({method: 'getStatus'}, function(response){
            console.log('message sent');
            console.log(response);
            if(response === true)
                $('.status').text('Appointment has been scheduled');
            else if(response === false)
                $('.status').text('Appointment was NOT scheduled');
            else
                // Case where XHR request was not completed in 2.5 seconds
                $('.status').text('Reload the calendar and double-check the appointment');
        });

    }, 2500);
}

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
