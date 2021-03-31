const expect = require("expect.js");
const eio = require("../");

const expectedPort =
  typeof location !== "undefined" && "https:" === location.protocol
    ? "443"
    : "80";

describe("engine.io-client", () => {
  let open;

  before(() => {
    open = eio.Socket.prototype.open;
    // override Socket#open to not connect
    eio.Socket.prototype.open = () => {};
  });

  after(() => {
    eio.Socket.prototype.open = open;
  });

  it("should expose protocol number", () => {
    expect(eio.protocol).to.be.a("number");
  });

  it("should properly parse http uri without port", () => {
    const client = eio("http://localhost");
    expect(client.port).to.be("80");
  });

  it("should properly parse https uri without port", () => {
    const client = eio("https://localhost");
    expect(client.hostname).to.be("localhost");
    expect(client.port).to.be("443");
  });

  it("should properly parse wss uri without port", () => {
    const client = eio("wss://localhost");
    expect(client.hostname).to.be("localhost");
    expect(client.port).to.be("443");
  });

  it("should properly parse wss uri with port", () => {
    const client = eio("wss://localhost:2020");
    expect(client.hostname).to.be("localhost");
    expect(client.port).to.be("2020");
  });

  it("should properly parse a host without port", () => {
    const client = eio({ host: "localhost" });
    expect(client.hostname).to.be("localhost");
    expect(client.port).to.be(expectedPort);
  });

  it("should properly parse a host with port", () => {
    const client = eio({ host: "localhost", port: "8080" });
    expect(client.hostname).to.be("localhost");
    expect(client.port).to.be("8080");
  });

  it("should properly parse an IPv6 uri without port", () => {
    const client = eio("http://[::1]");
    expect(client.hostname).to.be("::1");
    expect(client.port).to.be("80");
  });

  it("should properly parse an IPv6 uri with port", () => {
    const client = eio("http://[::1]:8080");
    expect(client.hostname).to.be("::1");
    expect(client.port).to.be("8080");
  });

  it("should properly parse an IPv6 host without port (1/2)", () => {
    const client = eio({ host: "[::1]" });
    expect(client.hostname).to.be("::1");
    expect(client.port).to.be(expectedPort);
  });

  it("should properly parse an IPv6 host without port (2/2)", () => {
    const client = eio({ secure: true, host: "[::1]" });
    expect(client.hostname).to.be("::1");
    expect(client.port).to.be("443");
  });

  it("should properly parse an IPv6 host with port", () => {
    const client = eio({ host: "[::1]", port: "8080" });
    expect(client.hostname).to.be("::1");
    expect(client.port).to.be("8080");
  });

  it("should properly parse an IPv6 host without brace", () => {
    const client = eio({ host: "::1" });
    expect(client.hostname).to.be("::1");
    expect(client.port).to.be(expectedPort);
  });
});
