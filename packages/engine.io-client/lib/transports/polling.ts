import { Transport } from "../transport.js";
import { randomString } from "../util.js";
import { encodePayload, decodePayload } from "engine.io-parser";
import debugModule from "debug"; // debug()

const debug = debugModule("engine.io-client:polling"); // debug()

export abstract class Polling extends Transport {
  private _polling: boolean = false;

  override get name() {
    return "polling";
  }

  /**
   * Opens the socket (triggers polling). We write a PING message to determine
   * when the transport is open.
   *
   * @protected
   */
  override doOpen() {
    this._poll();
  }

  /**
   * Pauses polling.
   *
   * @param {Function} onPause - callback upon buffers are flushed and transport is paused
   * @package
   */
  override pause(onPause) {
    this.readyState = "pausing";

    const pause = () => {
      debug("paused");
      this.readyState = "paused";
      onPause();
    };

    if (this._polling || !this.writable) {
      let total = 0;

      if (this._polling) {
        debug("we are currently polling - waiting to pause");
        total++;
        this.once("pollComplete", function () {
          debug("pre-pause polling complete");
          --total || pause();
        });
      }

      if (!this.writable) {
        debug("we are currently writing - waiting to pause");
        total++;
        this.once("drain", function () {
          debug("pre-pause writing complete");
          --total || pause();
        });
      }
    } else {
      pause();
    }
  }

  /**
   * Starts polling cycle.
   *
   * @private
   */
  private _poll() {
    debug("polling");
    this._polling = true;
    this.doPoll();
    this.emitReserved("poll");
  }

  /**
   * Overloads onData to detect payloads.
   *
   * @protected
   */
  override onData(data) {
    debug("polling got data %s", data);
    const callback = (packet) => {
      // if its the first message we consider the transport open
      if ("opening" === this.readyState && packet.type === "open") {
        this.onOpen();
      }

      // if its a close packet, we close the ongoing requests
      if ("close" === packet.type) {
        this.onClose({ description: "transport closed by the server" });
        return false;
      }

      // otherwise bypass onData and handle the message
      this.onPacket(packet);

      if (this.closeDeferred && "open" === packet.type) {
        // close() was called while the handshake was still in flight and it
        // just completed, so the deferred close packet can now be written.
        // The sid is read from the open packet itself, as the Socket may have
        // already dropped its listeners (see Socket#_onClose).
        this.closeDeferred = false;
        if (!this.query.sid && typeof packet.data === "string") {
          try {
            const sid = JSON.parse(packet.data).sid;
            if (sid) {
              this.query.sid = sid;
            }
          } catch (e) {
            debug("could not parse sid from open packet");
          }
        }
        debug("writing deferred close packet");
        this.write([{ type: "close" }]);
        this.onClose();
      }
    };

    // decode payload
    decodePayload(data, this.socket.binaryType).forEach(callback);

    // if an event did not trigger closing
    if ("closed" !== this.readyState) {
      // if we got data we're not polling
      this._polling = false;
      this.emitReserved("pollComplete");

      if ("open" === this.readyState) {
        this._poll();
      } else {
        debug('ignoring poll - transport state "%s"', this.readyState);
      }
    }
  }

  /**
   * For polling, send a close packet.
   *
   * @protected
   */
  override doClose() {
    const close = () => {
      debug("writing close packet");
      this.write([{ type: "close" }]);
    };

    if ("open" === this.readyState) {
      debug("transport open - closing");
      this.closeDeferred = false;
      close();
    } else {
      // in case we're trying to close while handshaking is in progress
      // (GH-164), wait for the handshake to complete before writing the close
      // packet. This intentionally does not rely on a one-off "open"
      // listener: the Socket clears all transport listeners when it closes
      // (see Socket#_onClose), which would silently drop the deferred close.
      debug("transport not open - deferring close");
      this.closeDeferred = true;
    }
  }

  /**
   * Writes a packets payload.
   *
   * @param {Array} packets - data packets
   * @protected
   */
  override write(packets) {
    this.writable = false;

    encodePayload(packets, (data) => {
      this.doWrite(data, () => {
        this.writable = true;
        this.emitReserved("drain");
      });
    });
  }

  /**
   * Generates uri for connection.
   *
   * @private
   */
  protected uri() {
    const schema = this.opts.secure ? "https" : "http";
    const query: { b64?: number; sid?: string } = this.query || {};

    // cache busting is forced
    if (false !== this.opts.timestampRequests) {
      query[this.opts.timestampParam] = randomString();
    }

    if (!this.supportsBinary && !query.sid) {
      query.b64 = 1;
    }

    return this.createUri(schema, query);
  }

  abstract doPoll();
  abstract doWrite(data: string, callback: () => void);
}
