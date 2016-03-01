var optionsModule = angular.module('academic-scheduler-options', [])

    .service('optionsService', ['$http', function ($http) {
        var self = this;
        this.getLocations = function (setLocations) {
            chrome.storage.sync.get(null, function (items) {
                var allLocations = items.locations || {};
                setLocations(allLocations);
            });
        };

        this.addNewLocation = function (locationName, updateLocations) {
            chrome.storage.sync.get(null, function (items) {
                if (_.isEmpty(items)) {
                    items.locations = {};
                }

                if (!items.locations[locationName]) {
                    items.locations[locationName] = {
                        'location': locationName,
                        'url': 'https://mathcenter.herokuapp.com/api/getExtensionSettings' // default link is hardcoded
                    };
                    chrome.storage.sync.set(items); // save changes
                    updateLocations();
                } else {
                    console.log('Already exists!');
                }
            });
        };

        this.removeLocation = function (locationName, updateLocations) {
            chrome.storage.sync.get(null, function (items) {
                items.locations = _.omit(items.locations, locationName);
                chrome.storage.sync.set(items);
            });
        };

        this.saveChanges = function (locationObj) {
            // converting semesterenddate to string so it will store in local storage
            chrome.storage.sync.get(null, function (items) {
                for (prop in locationObj) {
                    // saving every property as a string
                    items.locations[locationObj.location][prop] = '' + locationObj[prop];
                }
                chrome.storage.sync.set(items);
            });
        };

        this.getCalendars = function (setCalendars) {
            self.calendarsAPIUrl = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
            chrome.identity.getAuthToken ({
                'interactive': true
            }, function(token) {
                $http({
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    },
                    url: self.calendarsAPIUrl
                }).then(function (response) {
                    setCalendars(response.data.items);
                }, function (error) {
                    console.log(error);
                });
            });
        };
    }])

    .controller('OptionsController', ['$scope', 'optionsService', function ($scope, optionsService) {
        $scope.DEBUG = false;

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
        });

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
        };

        $scope.saveChanges = function () {
            optionsService.saveChanges ($scope.selectedLocation);
            // TODO: Display message
        };
    }]);
