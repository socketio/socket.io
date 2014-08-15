var expect = require('expect.js');
var XMLHttpRequest = require('../lib/xmlhttprequest');
var isIE8 = /MSIE 8/.test(navigator.userAgent);

describe('XMLHttpRequest', function () {

  if (isIE8) {
    describe('IE8', function() {
      it('should have same properties as XDomainRequest does when xscheme is false', function() {
        var xhr = new XMLHttpRequest({xdomain: false, xscheme: false});
        expect(xhr).to.be.an('object');
        expect(xhr).to.have.property('onload');
        expect(xhr).to.have.property('onerror');
      });

      it('should have same properties as XMLHttpRequest does when xscheme is true', function() {
        var xhr = new XMLHttpRequest({xdomain: false, xscheme: true});
        expect(xhr).to.be.an('object');
        expect(xhr).to.have.property('onreadystatechange');
      });
    });
  }

});
