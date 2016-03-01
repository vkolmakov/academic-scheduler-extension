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
    });
