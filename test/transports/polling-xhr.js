var expect = require('expect.js');
var XHR = require('../../lib/transports/polling-xhr');
var isIE8 = /MSIE 8/.test(navigator.userAgent);

describe('XHR', function() {
  describe('Request', function() {
    describe('hasXDR', function() {
      if (isIE8) {
        it('should return true when xscheme is false and enablesXDR is true', function() {
          var request = new XHR.Request({
            uri: "http://localhost/engine.io?sid=test"
          , xd: true
          , xs: false
          , enablesXDR: true
          });
          expect(request.hasXDR()).to.be(true);
        });

        it('should return false when xscheme is true', function() {
          var request;
          request = new XHR.Request({
            uri: "http://localhost/engine.io?sid=test"
          , xd: true
          , xs: true
          , enablesXDR: true
          });
          expect(request.hasXDR()).to.be(false);

          request = new XHR.Request({
            uri: "http://localhost/engine.io?sid=test"
          , xd: true
          , xs: true
          , enablesXDR: true
          });
          expect(request.hasXDR()).to.be(false);
        });

        it('should return false when enablesXDR is false', function() {
          var request;
          request = new XHR.Request({
            uri: "http://localhost/engine.io?sid=test"
          , xd: true
          , xs: true
          , enablesXDR: false
          });
          expect(request.hasXDR()).to.be(false);

          request = new XHR.Request({
            uri: "http://localhost/engine.io?sid=test"
          , xd: true
          , xs: false
          , enablesXDR: false
          });
          expect(request.hasXDR()).to.be(false);
        });
      }
    });
  });
});
