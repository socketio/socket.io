import { Server, Socket } from "..";
import expect from "expect.js";
import { success, getPort, waitFor } from "./support/util";
import * as io_v2 from "socket.io-client-v2";

describe("v2 compatibility", () => {
  it("should connect if `allowEIO3` is true", (done) => {
    const io = new Server(0, {
      allowEIO3: true,
    });

    const clientSocket = io_v2.connect(`http://localhost:${getPort(io)}`, {
      multiplex: false,
    });

    Promise.all([
      waitFor(io, "connection"),
      waitFor(clientSocket, "connect"),
    ]).then(([socket]) => {
      expect((socket as Socket).id).to.eql(clientSocket.id);

      success(done, io, clientSocket);
    });
  });

  it("should be able to connect to a namespace with a query", (done) => {
    const io = new Server(0, {
      allowEIO3: true,
    });

    const clientSocket = io_v2.connect(
      `http://localhost:${getPort(io)}/the-namespace`,
      {
        multiplex: false,
      }
    );
    clientSocket.query = { test: "123" };

    Promise.all([
      waitFor(io.of("/the-namespace"), "connection"),
      waitFor(clientSocket, "connect"),
    ]).then(([socket]) => {
      expect((socket as Socket).handshake.auth).to.eql({ test: "123" });

      success(done, io, clientSocket);
    });
  });

  it("should not connect if `allowEIO3` is false (default)", (done) => {
    const io = new Server(0);

    const clientSocket = io_v2.connect(`http://localhost:${getPort(io)}`, {
      multiplex: false,
    });

    clientSocket.on("connect", () => {
      done(new Error("should not happen"));
    });

    clientSocket.on("connect_error", () => {
      success(done, io, clientSocket);
    });
  });
});
