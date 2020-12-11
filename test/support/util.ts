const expect = require("expect.js");
const i = expect.stringify;

// add support for Set/Map
const contain = expect.Assertion.prototype.contain;
expect.Assertion.prototype.contain = function (...args) {
  if (typeof this.obj === "object") {
    args.forEach((obj) => {
      this.assert(
        this.obj.has(obj),
        function () {
          return "expected " + i(this.obj) + " to contain " + i(obj);
        },
        function () {
          return "expected " + i(this.obj) + " to not contain " + i(obj);
        }
      );
    });
    return this;
  }
  return contain.apply(this, args);
};
