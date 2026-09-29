import expect = require("expect.js");
import { io } from "..";
import { wrap, BASE_URL, success } from "./support/util";

describe("connection state recovery", () => {
  it("should have an accessible socket id equal to the server-side socket id (default namespace)", () => {
    return wrap((done) => {
      const socket = io(BASE_URL, {
        forceNew: true,
        reconnectionDelay: 10,
      });

      expect(socket.recovered).to.eql(false);

      socket.emit("hi"); // init the offset

      socket.on("hi", () => {
        const id = socket.id;

        socket.io.engine.close();

        socket.on("connect", () => {
          expect(socket.id).to.eql(id); // means that the reconnection was successful
          expect(socket.recovered).to.eql(true); // means that the reconnection was successful
          done();
        });
      });
    });
  });

  it("should restore session even if no event was received", () => {
    return wrap((done) => {
      const socket = io(BASE_URL, {
        forceNew: true,
        reconnectionDelay: 10,
      });

      expect(socket.recovered).to.eql(false);

      let id: string;

      socket.on("connect", () => {
        if (!id) {
          // first connection: no event has been exchanged yet
          id = socket.id;

          socket.io.engine.close();
        } else {
          expect(socket.id).to.eql(id); // means that the reconnection was successful
          expect(socket.recovered).to.eql(true); // means that the reconnection was successful
          done();
        }
      });
    });
  });
});
