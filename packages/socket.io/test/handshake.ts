import { Server } from "..";
import expect from "expect.js";
import { getPort, success } from "./support/util";

describe("handshake", () => {
  const request = require("superagent");

  it("should send the Access-Control-Allow-xxx headers on OPTIONS request", (done) => {
    const io = new Server(0, {
      cors: {
        origin: "http://localhost:54023",
        methods: ["GET", "POST"],
        allowedHeaders: ["content-type"],
        credentials: true,
      },
    });
    request
      .options(`http://localhost:${getPort(io)}/socket.io/default/`)
      .query({ transport: "polling", EIO: 4 })
      .set("Origin", "http://localhost:54023")
      .end((err, res) => {
        expect(res.status).to.be(204);

        expect(res.headers["access-control-allow-origin"]).to.be(
          "http://localhost:54023"
        );
        expect(res.headers["access-control-allow-methods"]).to.be("GET,POST");
        expect(res.headers["access-control-allow-headers"]).to.be(
          "content-type"
        );
        expect(res.headers["access-control-allow-credentials"]).to.be("true");
        success(done, io);
      });
  });

  it("should send the Access-Control-Allow-xxx headers on GET request", (done) => {
    const io = new Server(0, {
      cors: {
        origin: "http://localhost:54024",
        methods: ["GET", "POST"],
        allowedHeaders: ["content-type"],
        credentials: true,
      },
    });
    request
      .get(`http://localhost:${getPort(io)}/socket.io/default/`)
      .query({ transport: "polling", EIO: 4 })
      .set("Origin", "http://localhost:54024")
      .end((err, res) => {
        expect(res.status).to.be(200);

        expect(res.headers["access-control-allow-origin"]).to.be(
          "http://localhost:54024"
        );
        expect(res.headers["access-control-allow-credentials"]).to.be("true");
        success(done, io);
      });
  });

  it("should allow request if custom function in opts.allowRequest returns true", (done) => {
    const io = new Server(0, {
      allowRequest: (req, callback) => callback(null, true),
    });

    request
      .get(`http://localhost:${getPort(io)}/socket.io/default/`)
      .query({ transport: "polling", EIO: 4 })
      .end((err, res) => {
        expect(res.status).to.be(200);
        success(done, io);
      });
  });

  it("should disallow request if custom function in opts.allowRequest returns false", (done) => {
    const io = new Server(0, {
      allowRequest: (req, callback) => callback(null, false),
    });
    request
      .get(`http://localhost:${getPort(io)}/socket.io/default/`)
      .set("origin", "http://foo.example")
      .query({ transport: "polling", EIO: 4 })
      .end((err, res) => {
        expect(res.status).to.be(403);
        success(done, io);
      });
  });
});
