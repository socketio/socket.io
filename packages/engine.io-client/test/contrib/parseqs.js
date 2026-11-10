// imported from https://github.com/galkn/querystring
const expect = require("expect.js");
const util = require("../../build/cjs/contrib/parseqs.js");

describe("querystring test suite", function () {
  it("should parse a querystring and return an object", function () {
    // Single assignment
    let queryObj = util.decode("foo=bar");
    expect(queryObj.foo).to.be("bar");

    // Multiple assignments
    queryObj = util.decode("france=paris&germany=berlin");
    expect(queryObj.france).to.be("paris");
    expect(queryObj.germany).to.be("berlin");

    // Assignments containing non-alphanumeric characters
    queryObj = util.decode("india=new%20delhi");
    expect(queryObj.india).to.be("new delhi");

    const queryWithEqualSigns = util.decode("a=b=c&d&e=1&f%3Dg=2");
    expect(queryWithEqualSigns.a).to.be("b=c");
    expect(queryWithEqualSigns.d).to.equal("");
    expect(queryWithEqualSigns.e).to.equal("1");
    expect(queryWithEqualSigns["f=g"]).to.equal("2");
  });

  it("should construct a query string from an object", function () {
    expect(util.encode({ a: "b" })).to.be("a=b");
    expect(util.encode({ a: "b", c: "d" })).to.be("a=b&c=d");
    expect(util.encode({ a: "b", c: "tobi rocks" })).to.be(
      "a=b&c=tobi%20rocks",
    );
  });
});
