const expect = require("expect.js");
const { Socket, protocol } = require("..");
const { randomString } = require("../build/cjs/util.js");

const expectedPort =
  typeof location !== "undefined" && "https:" === location.protocol
    ? "443"
    : "80";

describe("engine.io-client", () => {
  let open;

  before(() => {
    open = Socket.prototype.open;
    // override Socket#open to not connect
    Socket.prototype.open = () => {};
  });

  after(() => {
    Socket.prototype.open = open;
  });

  it("should expose protocol number", () => {
    expect(protocol).to.be.a("number");
  });

  it("should properly parse http uri without port", () => {
    const client = new Socket("http://localhost");
    expect(client.port).to.be("80");
  });

  it("should properly parse https uri without port", () => {
    const client = new Socket("https://localhost");
    expect(client.hostname).to.be("localhost");
    expect(client.port).to.be("443");
  });

  it("should properly parse wss uri without port", () => {
    const client = new Socket("wss://localhost");
    expect(client.hostname).to.be("localhost");
    expect(client.port).to.be("443");
  });

  it("should properly parse wss uri with port", () => {
    const client = new Socket("wss://localhost:2020");
    expect(client.hostname).to.be("localhost");
    expect(client.port).to.be("2020");
  });

  it("should properly parse a host without port", () => {
    const client = new Socket({ host: "localhost" });
    expect(client.hostname).to.be("localhost");
    expect(client.port).to.be(expectedPort);
  });

  it("should properly parse a host with port", () => {
    const client = new Socket({ host: "localhost", port: "8080" });
    expect(client.hostname).to.be("localhost");
    expect(client.port).to.be("8080");
  });

  it("should properly handle the addTrailingSlash option", () => {
    const client = new Socket({ host: "localhost", addTrailingSlash: false });
    expect(client.hostname).to.be("localhost");
    expect(client.opts.path).to.be("/engine.io");
  });

  it("should properly parse an IPv6 uri without port", () => {
    const client = new Socket("http://[::1]");
    expect(client.hostname).to.be("::1");
    expect(client.port).to.be("80");
  });

  it("should properly parse an IPv6 uri with port", () => {
    const client = new Socket("http://[::1]:8080");
    expect(client.hostname).to.be("::1");
    expect(client.port).to.be("8080");
  });

  it("should properly parse an IPv6 host without port (1/2)", () => {
    const client = new Socket({ host: "[::1]" });
    expect(client.hostname).to.be("::1");
    expect(client.port).to.be(expectedPort);
  });

  it("should properly parse an IPv6 host without port (2/2)", () => {
    const client = new Socket({ secure: true, host: "[::1]" });
    expect(client.hostname).to.be("::1");
    expect(client.port).to.be("443");
  });

  it("should properly parse an IPv6 host with port", () => {
    const client = new Socket({ host: "[::1]", port: "8080" });
    expect(client.hostname).to.be("::1");
    expect(client.port).to.be("8080");
  });

  it("should properly parse an IPv6 host without brace", () => {
    const client = new Socket({ host: "::1" });
    expect(client.hostname).to.be("::1");
    expect(client.port).to.be(expectedPort);
  });

  it("should generate a random string", () => {
    const a = randomString();
    const b = randomString();
    const c = randomString();

    expect(a.length).to.eql(8);
    expect(a).to.not.equal(b);
    expect(b).to.not.equal(c);
  });
});
