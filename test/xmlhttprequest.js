var expect = require('expect.js');
var XMLHttpRequest = require('../lib/xmlhttprequest');
var isIE8_9 = /MSIE (8|9)/.test(navigator.userAgent);
var isIE10_11 = /MSIE 10|Trident.*rv[ :]*11\./.test(navigator.userAgent);

describe('XMLHttpRequest', function () {

  if (isIE8_9) {
    describe('IE8_9', function() {
      context('when xdomain is false', function() {
        it('should have same properties as XMLHttpRequest does', function() {
          var xhra = new XMLHttpRequest({xdomain: false, xscheme: false, enablesXDR: false});
          expect(xhra).to.be.an('object');
          expect(xhra).to.have.property('open');
          expect(xhra).to.have.property('onreadystatechange');
          var xhrb = new XMLHttpRequest({xdomain: false, xscheme: false, enablesXDR: true});
          expect(xhrb).to.be.an('object');
          expect(xhrb).to.have.property('open');
          expect(xhrb).to.have.property('onreadystatechange');
         var xhrc = new XMLHttpRequest({xdomain: false, xscheme: true, enablesXDR: false});
          expect(xhrc).to.be.an('object');
          expect(xhrc).to.have.property('open');
          expect(xhrc).to.have.property('onreadystatechange');
         var xhrd = new XMLHttpRequest({xdomain: false, xscheme: true, enablesXDR: true});
          expect(xhrd).to.be.an('object');
          expect(xhrd).to.have.property('open');
          expect(xhrd).to.have.property('onreadystatechange');
        });
      });

      context('when xdomain is true', function() {
        context('when xscheme is false and enablesXDR is true', function() {
          it('should have same properties as XDomainRequest does', function() {
            var xhr = new XMLHttpRequest({xdomain: true, xscheme: false, enablesXDR: true});
            expect(xhr).to.be.an('object');
            expect(xhr).to.have.property('open');
            expect(xhr).to.have.property('onload');
            expect(xhr).to.have.property('onerror');
          });
        });

        context('when xscheme is true', function() {
          it('should not have open in properties', function() {
            var xhra = new XMLHttpRequest({xdomain: true, xscheme: true, enablesXDR: false});
            expect(xhra).to.be.an('object');
            expect(xhra).not.to.have.property('open');
            var xhrb = new XMLHttpRequest({xdomain: true, xscheme: true, enablesXDR: true});
            expect(xhrb).to.be.an('object');
            expect(xhrb).not.to.have.property('open');
          });
        });

        context('when enablesXDR is false', function() {
          it('should not have open in properties', function() {
            var xhra = new XMLHttpRequest({xdomain: true, xscheme: false, enablesXDR: false});
            expect(xhra).to.be.an('object');
            expect(xhra).not.to.have.property('open');
            var xhrb = new XMLHttpRequest({xdomain: true, xscheme: true, enablesXDR: false});
            expect(xhrb).to.be.an('object');
            expect(xhrb).not.to.have.property('open');
          });
        });
      });
    });
  }

  if (isIE10_11) {
    describe('IE10_11', function() {
      context('when enablesXDR is true and xscheme is false', function() {
        it('should have same properties as XMLHttpRequest does', function() {
          var xhra = new XMLHttpRequest({xdomain: false, xscheme: false, enablesXDR: true});
          expect(xhra).to.be.an('object');
          expect(xhra).to.have.property('open');
          expect(xhra).to.have.property('onreadystatechange');
          var xhrb = new XMLHttpRequest({xdomain: true, xscheme: false, enablesXDR: true});
          expect(xhrb).to.be.an('object');
          expect(xhrb).to.have.property('open');
          expect(xhrb).to.have.property('onreadystatechange');
        });
      });
    });
  }

});
