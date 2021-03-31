const expect = require("expect.js");
const XHR = require("../../lib/transports/polling-xhr");
const env = require("../support/env");

describe("XHR", () => {
  describe("Request", () => {
    describe("hasXDR", () => {
      if (env.isIE8) {
        it("should return true when xscheme is false and enablesXDR is true", () => {
          const request = new XHR.Request({
            uri: "http://localhost/engine.io?sid=test",
            xd: true,
            xs: false,
            enablesXDR: true
          });
          expect(request.hasXDR()).to.be(true);
        });

        it("should return false when xscheme is true", () => {
          let request;
          request = new XHR.Request({
            uri: "http://localhost/engine.io?sid=test",
            xd: true,
            xs: true,
            enablesXDR: true
          });
          expect(request.hasXDR()).to.be(false);

          request = new XHR.Request({
            uri: "http://localhost/engine.io?sid=test",
            xd: true,
            xs: true,
            enablesXDR: true
          });
          expect(request.hasXDR()).to.be(false);
        });

        it("should return false when enablesXDR is false", () => {
          let request;
          request = new XHR.Request({
            uri: "http://localhost/engine.io?sid=test",
            xd: true,
            xs: true,
            enablesXDR: false
          });
          expect(request.hasXDR()).to.be(false);

          request = new XHR.Request({
            uri: "http://localhost/engine.io?sid=test",
            xd: true,
            xs: false,
            enablesXDR: false
          });
          expect(request.hasXDR()).to.be(false);
        });
      }
    });
  });
});
