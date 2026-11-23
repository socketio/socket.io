import expect = require("expect.js");
import { io } from "..";
import { PacketType } from "socket.io-parser";
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

  it("should not be recovered when the server does not use connection state recovery", () => {
    const socket = io(BASE_URL, { forceNew: true, autoConnect: false });

    // the CONNECT packet of a server without connection state recovery has no "pid" attribute
    // @ts-ignore method 'onpacket' is private
    socket.onpacket({
      type: PacketType.CONNECT,
      nsp: "/",
      data: { sid: "abc" },
    });

    expect(socket.connected).to.be(true);
    expect(socket.recovered).to.be(false);
  });
});
