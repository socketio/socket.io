import { Server } from "..";
import expect from "expect.js";
import { success, createClient } from "./support/util";

describe("socket middleware", () => {
  it("should call functions", (done) => {
    const io = new Server(0);
    const clientSocket = createClient(io, "/", { multiplex: false });

    clientSocket.emit("join", "woot");

    let run = 0;

    io.on("connection", (socket) => {
      socket.use((event, next) => {
        expect(event).to.eql(["join", "woot"]);
        event.unshift("wrap");
        run++;
        next();
      });
      socket.use((event, next) => {
        expect(event).to.eql(["wrap", "join", "woot"]);
        run++;
        next();
      });
      socket.on("wrap", (data1, data2) => {
        expect(data1).to.be("join");
        expect(data2).to.be("woot");
        expect(run).to.be(2);

        success(done, io, clientSocket);
      });
    });
  });

  it("should pass errors", (done) => {
    const io = new Server(0);
    const clientSocket = createClient(io, "/", { multiplex: false });

    clientSocket.emit("join", "woot");

    io.on("connection", (socket) => {
      socket.use((event, next) => {
        next(new Error("Authentication error"));
      });
      socket.use((event, next) => {
        done(new Error("should not happen"));
      });
      socket.on("join", () => {
        done(new Error("should not happen"));
      });
      socket.on("error", (err) => {
        expect(err).to.be.an(Error);
        expect(err.message).to.eql("Authentication error");

        success(done, io, clientSocket);
      });
    });
  });
});
