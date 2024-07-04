import { url } from "../build/cjs/url";
import expect from "expect.js";

const loc: any = {};

describe("url", () => {
  it("works with undefined", () => {
    loc.hostname = "woot.com";
    loc.protocol = "https:";
    loc.port = 4005;
    loc.host = loc.hostname + ":" + loc.port;
    const parsed = url(undefined, undefined, loc);
    expect(parsed.host).to.be("woot.com");
    expect(parsed.protocol).to.be("https");
    expect(parsed.port).to.be("4005");
  });

  it("works with relative paths", () => {
    loc.hostname = "woot.com";
    loc.protocol = "https:";
    loc.port = 3000;
    loc.host = loc.hostname + ":" + loc.port;
    const parsed = url("/test", undefined, loc);
    expect(parsed.host).to.be("woot.com");
    expect(parsed.protocol).to.be("https");
    expect(parsed.port).to.be("3000");
  });

  it("works with no protocol", () => {
    loc.protocol = "http:";
    const parsed = url("localhost:3000", undefined, loc);
    expect(parsed.host).to.be("localhost");
    expect(parsed.port).to.be("3000");
    expect(parsed.protocol).to.be("http");
  });

  it("works with no schema", () => {
    loc.protocol = "http:";
    const parsed = url("//localhost:3000", undefined, loc);
    expect(parsed.host).to.be("localhost");
    expect(parsed.port).to.be("3000");
    expect(parsed.protocol).to.be("http");
  });

  it("forces ports for unique url ids", () => {
    const id1 = url("http://google.com:80/");
    const id2 = url("http://google.com/");
    const id3 = url("https://google.com/");
    const id4 = url("http://google.com/", "/test");
    expect(id1.id).to.be(id2.id);
    expect(id1.id).to.not.be(id3.id);
    expect(id2.id).to.not.be(id3.id);
    expect(id2.id).to.not.be(id4.id);
  });

  it("identifies the namespace", () => {
    loc.protocol = "http:";
    loc.hostname = "woot.com";

    expect(url("/woot", undefined, loc).path).to.be("/woot");
    expect(url("http://google.com").path).to.be("/");
    expect(url("http://google.com/").path).to.be("/");
  });

  it("works with ipv6", () => {
    const parsed = url("http://[::1]");
    expect(parsed.protocol).to.be("http");
    expect(parsed.host).to.be("::1");
    expect(parsed.port).to.be("80");
    expect(parsed.id).to.be("http://[::1]:80");
  });

  it("works with ipv6 location", () => {
    loc.protocol = "http:";
    loc.hostname = "[::1]";
    loc.port = "";
    loc.host = loc.hostname + ":" + loc.port;

    const parsed = url(undefined, undefined, loc);
    expect(parsed.protocol).to.be("http");
    expect(parsed.host).to.be("::1");
    expect(parsed.port).to.be("80");
    expect(parsed.id).to.be("http://[::1]:80");
  });

  it("works with a custom path", function () {
    const parsed = url("https://woot.com/some-namespace", "/some-path");
    expect(parsed.id).to.be("https://woot.com:443/some-path");
    expect(parsed.path).to.be("/some-namespace");
  });
});
