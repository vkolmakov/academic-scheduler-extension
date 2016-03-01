app.directive('openSlotsTable', function () {
    return {
        restrict: 'AE',
        templateUrl: '../../views/templates/open-slots-table.html',
        scope: {
            tutorslist: '=',
            timetable: '='
        }
    };
});
