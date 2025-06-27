import { EngineRequest, Transport } from "../transport";
import { createGzip, createDeflate } from "zlib";
import * as accepts from "accepts";
import debugModule from "debug";
import type { IncomingMessage, ServerResponse } from "http";
import type { Packet, RawData } from "engine.io-parser";
import type * as parser_v4 from "engine.io-parser";
import type * as parser_v3 from "../parser-v3/index";

const debug = debugModule("engine:polling");

const compressionMethods = {
  gzip: createGzip,
  deflate: createDeflate,
};

export class Polling extends Transport {
  public maxHttpBufferSize: number;
  public httpCompression: any;

  private req: EngineRequest;
  private res: ServerResponse;
  private dataReq: IncomingMessage;
  private dataRes: ServerResponse;
  private shouldClose: () => void;

  private readonly closeTimeout: number;

  /**
   * HTTP polling constructor.
   */
  constructor(req) {
    super(req);

    this.closeTimeout = 30 * 1000;
  }

  /**
   * Transport name
   */
  get name() {
    return "polling";
  }

  /**
   * Overrides onRequest.
   *
   * @param {EngineRequest} req
   * @package
   */
  onRequest(req: EngineRequest) {
    const res = req.res;
    // remove the reference to the ServerResponse object (as the first request of the session is kept in memory by default)
    req.res = null;

    if ("GET" === req.method) {
      this.onPollRequest(req, res);
    } else if ("POST" === req.method) {
      this.onDataRequest(req, res);
    } else {
      res.writeHead(500);
      res.end();
    }
  }

  /**
   * The client sends a request awaiting for us to send data.
   *
   * @private
   */
  private onPollRequest(req: EngineRequest, res: ServerResponse) {
    if (this.req) {
      debug("request overlap");
      // assert: this.res, '.req and .res should be (un)set together'
      this.onError("overlap from client");
      res.writeHead(400);
      res.end();
      return;
    }

    debug("setting request");

    this.req = req;
    this.res = res;

    const onClose = () => {
      this.onError("poll connection closed prematurely");
    };

    const cleanup = () => {
      req.removeListener("close", onClose);
      this.req = this.res = null;
    };

    req.cleanup = cleanup;
    req.on("close", onClose);

    this.writable = true;
    this.emit("ready");

    // if we're still writable but had a pending close, trigger an empty send
    if (this.writable && this.shouldClose) {
      debug("triggering empty send to append close packet");
      this.send([{ type: "noop" }]);
    }
  }

  /**
   * The client sends a request with data.
   *
   * @private
   */
  private onDataRequest(req: IncomingMessage, res: ServerResponse) {
    if (this.dataReq) {
      // assert: this.dataRes, '.dataReq and .dataRes should be (un)set together'
      this.onError("data request overlap from client");
      res.writeHead(400);
      res.end();
      return;
    }

    const isBinary = "application/octet-stream" === req.headers["content-type"];

    if (isBinary && this.protocol === 4) {
      return this.onError("invalid content");
    }

    this.dataReq = req;
    this.dataRes = res;

    let chunks = isBinary ? Buffer.concat([]) : "";

    const cleanup = () => {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("close", onClose);
      this.dataReq = this.dataRes = chunks = null;
    };

    const onClose = () => {
      cleanup();
      this.onError("data request connection closed prematurely");
    };

    const onData = (data) => {
      let contentLength;
      if (isBinary) {
        chunks = Buffer.concat([chunks, data]);
        contentLength = chunks.length;
      } else {
        chunks += data;
        contentLength = Buffer.byteLength(chunks);
      }

      if (contentLength > this.maxHttpBufferSize) {
        res.writeHead(413).end();
        cleanup();
      }
    };

    const onEnd = () => {
      this.onData(chunks);

      const headers = {
        // text/html is required instead of text/plain to avoid an
        // unwanted download dialog on certain user-agents (GH-43)
        "Content-Type": "text/html",
        "Content-Length": "2",
      };

      res.writeHead(200, this.headers(req, headers));
      res.end("ok");
      cleanup();
    };

    req.on("close", onClose);
    if (!isBinary) req.setEncoding("utf8");
    req.on("data", onData);
    req.on("end", onEnd);
  }

  /**
   * Processes the incoming data payload.
   *
   * @param data - encoded payload
   * @protected
   */
  override onData(data: RawData) {
    debug('received "%s"', data);
    const callback = (packet) => {
      if ("close" === packet.type) {
        debug("got xhr close packet");
        this.onClose();
        return false;
      }

      this.onPacket(packet);
    };

    if (this.protocol === 3) {
      (this.parser as typeof parser_v3).decodePayload(data, callback);
    } else {
      (this.parser as typeof parser_v4).decodePayload(data).forEach(callback);
    }
  }

  /**
   * Overrides onClose.
   *
   * @private
   */
  onClose() {
    if (this.writable) {
      // close pending poll request
      this.send([{ type: "noop" }]);
    }
    super.onClose();
  }

  send(packets: Packet[]) {
    this.writable = false;

    if (this.shouldClose) {
      debug("appending close packet to payload");
      packets.push({ type: "close" });
      this.shouldClose();
      this.shouldClose = null;
    }

    const doWrite = (data: string) => {
      const compress = packets.some((packet) => {
        return packet.options && packet.options.compress;
      });
      this.write(data, { compress });
    };

    if (this.protocol === 3) {
      (this.parser as typeof parser_v3).encodePayload(packets, this.supportsBinary, doWrite);
    } else {
      (this.parser as typeof parser_v4).encodePayload(packets, doWrite);
    }
  }

  /**
   * Writes data as response to poll request.
   *
   * @param {String} data
   * @param {Object} options
   * @private
   */
  private write(data, options) {
    debug('writing "%s"', data);
    this.doWrite(data, options, () => {
      this.req.cleanup();
      this.emit("drain");
    });
  }

  /**
   * Performs the write.
   *
   * @protected
   */
  protected doWrite(data, options, callback) {
    // explicit UTF-8 is required for pages not served under utf
    const isString = typeof data === "string";
    const contentType = isString
      ? "text/plain; charset=UTF-8"
      : "application/octet-stream";

    const headers = {
      "Content-Type": contentType,
    };

    const respond = (data) => {
      headers["Content-Length"] =
        "string" === typeof data ? Buffer.byteLength(data) : data.length;
      this.res.writeHead(200, this.headers(this.req, headers));
      this.res.end(data);
      callback();
    };

    if (!this.httpCompression || !options.compress) {
      respond(data);
      return;
    }

    const len = isString ? Buffer.byteLength(data) : data.length;
    if (len < this.httpCompression.threshold) {
      respond(data);
      return;
    }

    const encoding = accepts(this.req).encodings(["gzip", "deflate"]);
    if (!encoding) {
      respond(data);
      return;
    }

    this.compress(data, encoding, (err, data) => {
      if (err) {
        this.res.writeHead(500);
        this.res.end();
        callback(err);
        return;
      }

      headers["Content-Encoding"] = encoding;
      respond(data);
    });
  }

  /**
   * Compresses data.
   *
   * @private
   */
  private compress(data, encoding, callback) {
    debug("compressing");

    const buffers = [];
    let nread = 0;

    compressionMethods[encoding](this.httpCompression)
      .on("error", callback)
      .on("data", function (chunk) {
        buffers.push(chunk);
        nread += chunk.length;
      })
      .on("end", function () {
        callback(null, Buffer.concat(buffers, nread));
      })
      .end(data);
  }

  /**
   * Closes the transport.
   *
   * @private
   */
  override doClose(fn: () => void) {
    debug("closing");

    let closeTimeoutTimer;

    if (this.dataReq) {
      debug("aborting ongoing data request");
      this.dataReq.destroy();
    }

    const onClose = () => {
      clearTimeout(closeTimeoutTimer);
      fn();
      this.onClose();
    };

    if (this.writable) {
      debug("transport writable - closing right away");
      this.send([{ type: "close" }]);
      onClose();
    } else if (this.discarded) {
      debug("transport discarded - closing right away");
      onClose();
    } else {
      debug("transport not writable - buffering orderly close");
      this.shouldClose = onClose;
      closeTimeoutTimer = setTimeout(onClose, this.closeTimeout);
    }
  }

  /**
   * Returns headers for a response.
   *
   * @param {http.IncomingMessage} req
   * @param {Object} headers - extra headers
   * @private
   */
  private headers(req: IncomingMessage, headers: Record<string, string> = {}) {
    // prevent XSS warnings on IE
    // https://github.com/LearnBoost/socket.io/pull/1333
    const ua = req.headers["user-agent"];
    if (ua && (~ua.indexOf(";MSIE") || ~ua.indexOf("Trident/"))) {
      headers["X-XSS-Protection"] = "0";
    }

    headers["cache-control"] = "no-store";

    this.emit("headers", headers, req);
    return headers;
  }
}
