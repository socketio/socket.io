const expect = require("expect.js");
const { newRequest } = require("../build/cjs/transports/polling-xhr.node.js");
const env = require("./support/env");

describe("XMLHttpRequest", () => {
  if (env.isIE9) {
    describe("IE8_9", () => {
      context("when xdomain is false", () => {
        it("should have same properties as XMLHttpRequest does", () => {
          const xhra = newRequest({
            xdomain: false,
            xscheme: false,
            enablesXDR: false,
          });
          expect(xhra).to.be.an("object");
          expect(xhra).to.have.property("open");
          expect(xhra).to.have.property("onreadystatechange");
          const xhrb = newRequest({
            xdomain: false,
            xscheme: false,
            enablesXDR: true,
          });
          expect(xhrb).to.be.an("object");
          expect(xhrb).to.have.property("open");
          expect(xhrb).to.have.property("onreadystatechange");
          const xhrc = newRequest({
            xdomain: false,
            xscheme: true,
            enablesXDR: false,
          });
          expect(xhrc).to.be.an("object");
          expect(xhrc).to.have.property("open");
          expect(xhrc).to.have.property("onreadystatechange");
          const xhrd = newRequest({
            xdomain: false,
            xscheme: true,
            enablesXDR: true,
          });
          expect(xhrd).to.be.an("object");
          expect(xhrd).to.have.property("open");
          expect(xhrd).to.have.property("onreadystatechange");
        });
      });

      context("when xdomain is true", () => {
        context("when xscheme is false and enablesXDR is true", () => {
          it("should have same properties as XDomainRequest does", () => {
            const xhr = newRequest({
              xdomain: true,
              xscheme: false,
              enablesXDR: true,
            });
            expect(xhr).to.be.an("object");
            expect(xhr).to.have.property("open");
            expect(xhr).to.have.property("onload");
            expect(xhr).to.have.property("onerror");
          });
        });

        context("when xscheme is true", () => {
          it("should not have open in properties", () => {
            const xhra = newRequest({
              xdomain: true,
              xscheme: true,
              enablesXDR: false,
            });
            expect(xhra).to.be.an("object");
            expect(xhra).not.to.have.property("open");
            const xhrb = newRequest({
              xdomain: true,
              xscheme: true,
              enablesXDR: true,
            });
            expect(xhrb).to.be.an("object");
            expect(xhrb).not.to.have.property("open");
          });
        });

        context("when enablesXDR is false", () => {
          it("should not have open in properties", () => {
            const xhra = newRequest({
              xdomain: true,
              xscheme: false,
              enablesXDR: false,
            });
            expect(xhra).to.be.an("object");
            expect(xhra).not.to.have.property("open");
            const xhrb = newRequest({
              xdomain: true,
              xscheme: true,
              enablesXDR: false,
            });
            expect(xhrb).to.be.an("object");
            expect(xhrb).not.to.have.property("open");
          });
        });
      });
    });
  }

  if (env.isIE10 || env.isIE11) {
    describe("IE10_11", () => {
      context("when enablesXDR is true and xscheme is false", () => {
        it("should have same properties as XMLHttpRequest does", () => {
          const xhra = newRequest({
            xdomain: false,
            xscheme: false,
            enablesXDR: true,
          });
          expect(xhra).to.be.an("object");
          expect(xhra).to.have.property("open");
          expect(xhra).to.have.property("onreadystatechange");
          const xhrb = newRequest({
            xdomain: true,
            xscheme: false,
            enablesXDR: true,
          });
          expect(xhrb).to.be.an("object");
          expect(xhrb).to.have.property("open");
          expect(xhrb).to.have.property("onreadystatechange");
        });
      });
    });
  }
});
