import expect = require("expect.js");
import { io } from "..";
import { wrap, BASE_URL, success } from "./support/util";

describe("retry", () => {
  it("should preserve the order of the packets", () => {
    return wrap((done) => {
      const socket = io(BASE_URL, {
        forceNew: true,
        retries: 1,
        ackTimeout: 50,
      });

      let i = 0;
      const expected = [
        "0",
        '20["echo",1]',
        '21["echo",2]',
        '22["echo",3]',
        "1",
      ];

      socket.io.engine.on("packetCreate", ({ data }) => {
        expect(data).to.eql(expected[i++]);
      });

      socket.emit("echo", 1, () => {
        // @ts-ignore
        expect(socket._queue.length).to.eql(2);
      });

      // @ts-ignore
      expect(socket._queue.length).to.eql(1);

      socket.emit("echo", 2, () => {
        // @ts-ignore
        expect(socket._queue.length).to.eql(1);
      });

      // @ts-ignore
      expect(socket._queue.length).to.eql(2);

      socket.emit("echo", 3, (err, val) => {
        expect(err).to.be(null);
        expect(val).to.eql(3);
        // @ts-ignore
        expect(socket._queue.length).to.eql(0);

        success(done, socket);
      });

      // @ts-ignore
      expect(socket._queue.length).to.eql(3);
    });
  });

  it("should fail when the server does not acknowledge the packet", () => {
    return wrap((done) => {
      const socket = io(BASE_URL, {
        forceNew: true,
        retries: 3,
        ackTimeout: 50,
      });

      let count = 0;

      let i = 0;
      const expected = [
        "0",
        '20["ack"]',
        '21["ack"]',
        '22["ack"]',
        '23["ack"]',
        "1",
      ];

      socket.io.engine.on("packetCreate", ({ data }) => {
        expect(data).to.eql(expected[i++]);
      });

      socket.emit("ack", () => {
        expect(count).to.eql(4);

        success(done, socket);
      });

      socket.on("ack", () => {
        count++;
      });
    });
  });

  it("should not drain the queue while the socket is disconnected", () => {
    return wrap((done) => {
      const socket = io(BASE_URL, {
        forceNew: true,
        autoConnect: false,
        retries: 3,
        ackTimeout: 10,
      });

      socket.emit("echo", 1, (err) => {
        expect(err).to.be(null);

        success(done, socket);
      });

      setTimeout(() => {
        socket.connect();
      }, 100);
    });
  });

  it("should not emit a packet twice in the 'connect' handler", () => {
    return wrap((done) => {
      const socket = io(BASE_URL, {
        forceNew: true,
        retries: 3,
      });

      const received: string[] = [];
      const sent: string[] = [];

      socket.io.engine.on("packetCreate", ({ data }) => {
        sent.push(data);
      });

      socket.io.engine.on("packet", ({ data }) => {
        received.push(data);
      });

      socket.on("connect", () => {
        socket.emit("echo", null);
      });

      setTimeout(() => {
        expect(sent).to.eql(["0", '20["echo",null]']);

        expect(received.length).to.eql(3);
        // 1: engine.io OPEN packet
        // 2: socket.io CONNECT packet
        // 3: ack packet
        expect(received[2]).to.eql("30[null]");

        success(done, socket);
      }, 100);
    });
  });
});
