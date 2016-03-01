app.directive('openSlotsTable', function () {
    return {
        restrict: 'E',
        templateUrl: '../../views/templates/open-slots-table.html',
        scope: {
            tutorslist: '=',
            timetable: '='
        }
    };
})
    .directive('formFieldInline', function () {
        return {
            transclude: true,
            restrict: 'E',
            templateUrl: '../../views/templates/form-field-inline.html',
            scope: {
                fieldName: '@'
            }
        };
    })
    .directive('clearButton', function () {
        return {
            restrict: 'E',
            templateUrl: '../../views/templates/clear-button.html'
        };
    })
    .directive('scheduleButton', function () {
        return {
            restrict: 'E',
            templateUrl: '../../views/templates/schedule-button.html'
        };
    });
