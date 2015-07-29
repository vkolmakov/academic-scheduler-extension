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
        chrome.runtime.sendMessage({method: 'onDateUpdate', details: date});
    });

    $('#inputTime, #inputCourse').change(function(){
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
