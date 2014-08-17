var expect = require('expect.js');
var XMLHttpRequest = require('../lib/xmlhttprequest');
var isIE8 = /MSIE 8/.test(navigator.userAgent);

describe('XMLHttpRequest', function () {

  if (isIE8) {
    describe('IE8', function() {
      it('should have same properties as XDomainRequest does when enablesXDR is true and xscheme is false', function() {
        var xhr = new XMLHttpRequest({xdomain: false, xscheme: false, enablesXDR: true});
        expect(xhr).to.be.an('object');
        expect(xhr).to.have.property('onload');
        expect(xhr).to.have.property('onerror');
      });

      it('should have same properties as XMLHttpRequest does when both enablesXDR and xscheme are true', function() {
        var xhr = new XMLHttpRequest({xdomain: false, xscheme: true, enablesXDR: true});
        expect(xhr).to.be.an('object');
        expect(xhr).to.have.property('onreadystatechange');
      });

      it('should have same properties as XMLHttpRequest does when enablesXDR is false', function() {
        var xhra = new XMLHttpRequest({xdomain: false, xscheme: false});
        expect(xhra).to.be.an('object');
        expect(xhra).to.have.property('onreadystatechange');
        var xhrb = new XMLHttpRequest({xdomain: false, xscheme: true});
        expect(xhrb).to.be.an('object');
        expect(xhrb).to.have.property('onreadystatechange');
      });
    });
  }

});
