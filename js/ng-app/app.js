var app = angular.module('academic-scheduler', [
    'jcs-autoValidate',
    'angular-toArrayFilter',
    'angular-ladda'
])

    .run(function (defaultErrorMessageResolver) {
	defaultErrorMessageResolver.getErrorMessages().then(function (errorMessages) {
            errorMessages['badName'] = 'Enter first and last name';
	    errorMessages['badContact'] = 'Enter valid phone or email';
	    errorMessages['notSigned'] = 'Sign with your initials';
	});

        String.prototype.capitalize = String.prototype.capitalize || function () {
            return _.map(this.split(' '), function(str) {
              return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase();
            }).join(' ');
        };

        String.prototype.rewriteContact = String.prototype.rewriteContact || function () {
            // Mathches and rewrites phone numbers, doesnt change emails
            contactRegex = /^\(?(\d{3})\)?[-\.\s]?(\d{3})[-\.\s]?(\d{4})$/;
            return this.replace(contactRegex, '($1)$2-$3');
        };
    });
