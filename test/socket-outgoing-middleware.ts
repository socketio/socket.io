import { Server } from "..";
import expect from "expect.js";
import { success, createClient } from "./support/util";

describe("socket outgoing middleware", () => {
  it("should call functions before sending event", (done) => {
    const io = new Server(0);
    let run = 0;
    const clientSocket = createClient(io, "/", { multiplex: false });
    io.on("connection", (socket) => {
      socket.useOutgoing((event, next) => {
        expect(event).to.eql(["join", "woot"]);
        event.unshift("wrap");
        run++;
        next();
      });
      socket.useOutgoing((event, next) => {
        expect(event).to.eql(["wrap", "join", "woot"]);
        run++;
        next();
      });
      socket.onAnyOutgoing((arg1, arg2, arg3) => {
        expect(arg1).to.be("wrap");
        expect(arg2).to.be("join");
        expect(arg3).to.be("woot");
        expect(run).to.be(2);

        success(done, io, clientSocket);
      });

      socket.emit("join", "woot");
    });
  });

  it("should pass errors", (done) => {
    const io = new Server(0);
    const clientSocket = createClient(io, "/", { multiplex: false });

    io.on("connection", (socket) => {
      socket.useOutgoing((event, next) => {
        next(new Error("Filtering error"));
      });
      socket.useOutgoing((event, next) => {
        done(new Error("should not happen"));
      });
      socket.on("join", () => {
        done(new Error("should not happen"));
      });
      socket.on("error", (err) => {
        expect(err).to.be.an(Error);
        expect(err.message).to.eql("Filtering error");

        success(done, io, clientSocket);
      });
      socket.emit("join", "woot");
    });
  });
});
