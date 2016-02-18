app.controller('MainController', ['$scope', 'locationService','calendarService', 'tutorService', 'settingsService', 'initialSetupService', function ($scope, locationService, calendarService, tutorService, settingsService, initialSetupService) {
    $scope.DEBUG = false;
    $scope.formData = {};
    $scope.formStatus = {};
    $scope.locations = {};
    $scope.tutors = [];

    $scope.messages = {
        updatingSettings: 'Trying to update settings...',
        noLocations: 'No locations are specified. You can set them up in the options menu.',
        invalidLocations: 'Make sure every location has semester end date and calendar specified',
    };

    $scope.onSubmit = function() {
        $scope.formStatus.scheduling = true;
        calendarService.schedule($scope.formData, $scope.tutors, function(isScheduled) {
            $scope.tutors = [];
            $scope.formStatus.scheduling = false;
            $scope.formStatus.scheduled = isScheduled;
            $scope.formStatus.errorOcurred = !isScheduled;
        });
    };

    $scope.onClearForm = function () {
        $scope.resetForm();
        $scope.form.$setPristine();
    };

    $scope.onLocationUpdate = function () {
        $scope.formStatus.setupError = true;
        $scope.formStatus.errorMessage = $scope.messages.updatingSettings;

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
        $scope.formStatus.errorMessage = errorMessage;
        $scope.formStatus.setupError = true;
        $scope.$apply();
    };

    $scope.setTutors = function () {
        // fix this if statement, use _ instead
        if ($scope.tutors[$scope.formData.time])
            $scope.formData.tutor = $scope.tutors[$scope.formData.time][0];
        // TODO: fix it later, find a better way to select first tutor
    };

    $scope.getTutors = function () {
        // event listener for time-select and course-select
        tutorService.getAvailableTutors($scope.settings, $scope.formData, function (tutors) {
            $scope.tutors = tutors;
        });
    };

    $scope.resetForm = function () {
        $scope.formData = {
            selectedLocation: $scope.formData.selectedLocation,
            date: $scope.formData.date
        };

        $scope.formStatus = {
            scheduled: false,
            scheduling: false,
            hasError: true,
            errorOcurred: false,
            setupError: $scope.formStatus.setupError || false,
            errorMessage: $scope.formStatus.errorMessage || ''
        };
        console.log();
    };

    // BAD-BAD-BAD-BADDDDD, needs refactioring
    $scope.initialSetup = function (onStartup) {
        $scope.settings = {};
        $scope.resetForm();
        locationService.getLocations(function (locations) {
            // grabbing locations from chrome sync storage
            var isValidLocationObject = locationService.isValidLocation(locations);

            if (_.isEmpty(locations)) {
                $scope.onError($scope.messages.noLocations);
                return;
            }

            else if (!isValidLocationObject) {
                $scope.onError($scope.messages.invalidLocations);
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

                if ($scope.DEBUG) {
                    console.log("got the settings!");
                    console.log($scope.settings);
                }

                $scope.formStatus.setupError = false;
                $scope.formStatus.errorMessage = '';

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
