// imported from https://github.com/galkn/parseuri
const expect = require("expect.js");
const parseuri = require("..").parse;
const { repeat } = require("./util");

describe("parseuri", function () {
  it("should parse an uri", function () {
    const http = parseuri("http://google.com"),
      https = parseuri("https://www.google.com:80"),
      query = parseuri("google.com:8080/foo/bar?foo=bar"),
      localhost = parseuri("localhost:8080"),
      ipv6 = parseuri("2001:0db8:85a3:0042:1000:8a2e:0370:7334"),
      ipv6short = parseuri("2001:db8:85a3:42:1000:8a2e:370:7334"),
      ipv6port = parseuri("2001:db8:85a3:42:1000:8a2e:370:7334:80"),
      ipv6abbrev = parseuri("2001::7334:a:80"),
      ipv6http = parseuri("http://[2001::7334:a]:80"),
      ipv6query = parseuri("http://[2001::7334:a]:80/foo/bar?foo=bar");

    expect(http.protocol).to.be("http");
    expect(http.port).to.be("");
    expect(http.host).to.be("google.com");
    expect(https.protocol).to.be("https");
    expect(https.port).to.be("80");
    expect(https.host).to.be("www.google.com");
    expect(query.port).to.be("8080");
    expect(query.query).to.be("foo=bar");
    expect(query.path).to.be("/foo/bar");
    expect(query.relative).to.be("/foo/bar?foo=bar");
    expect(query.queryKey.foo).to.be("bar");
    expect(query.pathNames[0]).to.be("foo");
    expect(query.pathNames[1]).to.be("bar");
    expect(localhost.protocol).to.be("");
    expect(localhost.host).to.be("localhost");
    expect(localhost.port).to.be("8080");
    expect(ipv6.protocol).to.be("");
    expect(ipv6.host).to.be("2001:0db8:85a3:0042:1000:8a2e:0370:7334");
    expect(ipv6.port).to.be("");
    expect(ipv6short.protocol).to.be("");
    expect(ipv6short.host).to.be("2001:db8:85a3:42:1000:8a2e:370:7334");
    expect(ipv6short.port).to.be("");
    expect(ipv6port.protocol).to.be("");
    expect(ipv6port.host).to.be("2001:db8:85a3:42:1000:8a2e:370:7334");
    expect(ipv6port.port).to.be("80");
    expect(ipv6abbrev.protocol).to.be("");
    expect(ipv6abbrev.host).to.be("2001::7334:a:80");
    expect(ipv6abbrev.port).to.be("");
    expect(ipv6http.protocol).to.be("http");
    expect(ipv6http.port).to.be("80");
    expect(ipv6http.host).to.be("2001::7334:a");
    expect(ipv6query.protocol).to.be("http");
    expect(ipv6query.port).to.be("80");
    expect(ipv6query.host).to.be("2001::7334:a");
    expect(ipv6query.relative).to.be("/foo/bar?foo=bar");

    const withUserInfo = parseuri("ws://foo:bar@google.com");

    expect(withUserInfo.protocol).to.eql("ws");
    expect(withUserInfo.userInfo).to.eql("foo:bar");
    expect(withUserInfo.user).to.eql("foo");
    expect(withUserInfo.password).to.eql("bar");
    expect(withUserInfo.host).to.eql("google.com");

    const relativeWithQuery = parseuri("/foo?bar=@example.com");

    expect(relativeWithQuery.host).to.be("");
    expect(relativeWithQuery.path).to.be("/foo");
    expect(relativeWithQuery.query).to.be("bar=@example.com");

    expect(() => parseuri(repeat("a", 8001))).to.throwError("URI too long");
  });
});
