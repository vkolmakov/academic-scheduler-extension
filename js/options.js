var optionsModule = angular.module('academic-scheduler-options', [
    'ngResource'
])

    .service('optionsService', ['$http', function ($http) {
        var self = this;
        this.getLocations = function (setLocations) {
            chrome.storage.sync.get(null, function (items) {
                var allLocations = items;
                setLocations(allLocations);
            });
        };

        this.addNewLocation = function (locationName, updateLocations) {
            chrome.storage.sync.get(locationName, function (value) {
                if (!value[locationName]) {
                    value[locationName] = {
                        'location': locationName,
                        'url': 'please set url',
                    };
                    chrome.storage.sync.set(value); // save changes
                    updateLocations();
                }
                else {
                    console.log('Already exists!');
                }
            });
        };

        this.removeLocation = function (locationName, updateLocations) {
            chrome.storage.sync.remove(locationName, function () {
                updateLocations();
            });
        };

        this.saveChanges = function (locationObj) {
            // converting semesterenddate to string so it will store in local storage
            chrome.storage.sync.get(locationObj.location, function (value) {
                for (prop in locationObj) {
                    // saving every property as a string
                    value[locationObj.location][prop] = '' + locationObj[prop];
                }
                chrome.storage.sync.set(value);
            });
        };

        this.getCalendars = function (setCalendars) {
            self.calendarsAPIUrl = 'https://www.googleapis.com/calendar/v3/users/me/calendarList'
            chrome.identity.getAuthToken ({
                'interactive': true
            }, function(token) {
                $http({
                    method: 'GET',
                    url: self.calendarsAPIUrl,
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                })
                    .then(
                        function (response) {
                            setCalendars(response.data.items);
                        },
                        function (error) {
                            console.log(error);
                        }
                    );
            });
        };
        
    }])

    .controller('OptionsController', ['$scope', 'optionsService', function ($scope, optionsService) {
        $scope.selectedLocationName = '';
        $scope.selectedLocation = {};
        $scope.locations = {};

        $scope.$watch('selectedLocationName', function (oldValue, newValue) {
            $scope.selectedLocation = $scope.locations[$scope.selectedLocationName];
            if ($scope.selectedLocationName) {
                $scope.selectedLocation.semesterEndDate = new Date($scope.selectedLocation.semesterEndDate);
                $scope.isLocationSelected = true;
            }
            else
                $scope.isLocationSelected = false;
        })

        $scope.newLocation = '';

        $scope.isLocationSelected = true;
        $scope.isAddingNewLocation = false;
        
        $scope.getLocations = function () {
            optionsService.getLocations (function (locations) {
                $scope.locations = locations;
                $scope.$apply();
            });
        };

        $scope.getLocations();
        optionsService.getCalendars(function (calendars) {
            $scope.calendars = calendars;
        });

        
        $scope.startAddingNewLocation = function () {
            $scope.isAddingNewLocation = !($scope.isAddingNewLocation);
        };

        $scope.cancelSelection = function () {
            $scope.selectedLocationName = '';
            $scope.isLocationSelected = false;
        };
        
        $scope.addNewLocation = function () {
            optionsService.addNewLocation ($scope.newLocation, $scope.getLocations);
            $scope.isAddingNewLocation = !($scope.isAddingNewLocation);
        };

        $scope.removeLocation = function () {
            optionsService.removeLocation ($scope.selectedLocationName, $scope.getLocations);
        }

        $scope.saveChanges = function () {
            optionsService.saveChanges ($scope.selectedLocation);
            // TODO: Display message
        }
    }]);
