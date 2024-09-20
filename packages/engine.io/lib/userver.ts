import debugModule from "debug";
import { AttachOptions, BaseServer, Server } from "./server";
import { HttpRequest, HttpResponse, TemplatedApp } from "uWebSockets.js";
import transports from "./transports-uws";

const debug = debugModule("engine:uws");

export interface uOptions {
  /**
   * What permessage-deflate compression to use. uWS.DISABLED, uWS.SHARED_COMPRESSOR or any of the uWS.DEDICATED_COMPRESSOR_xxxKB.
   * @default uWS.DISABLED
   */
  compression?: number;
  /**
   * Maximum amount of seconds that may pass without sending or getting a message. Connection is closed if this timeout passes. Resolution (granularity) for timeouts are typically 4 seconds, rounded to closest. Disable by using 0.
   * @default 120
   */
  idleTimeout?: number;
  /**
   * Maximum length of allowed backpressure per socket when publishing or sending messages. Slow receivers with too high backpressure will be skipped until they catch up or timeout.
   * @default 1024 * 1024
   */
  maxBackpressure?: number;
}

/**
 * An Engine.IO server based on the `uWebSockets.js` package.
 */
// TODO export it into its own package
export class uServer extends BaseServer {
  protected init() {}
  protected cleanup() {}

  /**
   * Prepares a request by processing the query string.
   *
   * @private
   */
  private prepare(req, res: HttpResponse) {
    req.method = req.getMethod().toUpperCase();
    req.url = req.getUrl();

    const params = new URLSearchParams(req.getQuery());
    req._query = Object.fromEntries(params.entries());

    req.headers = {};
    req.forEach((key, value) => {
      req.headers[key] = value;
    });

    req.connection = {
      remoteAddress: Buffer.from(res.getRemoteAddressAsText()).toString(),
    };

    res.onAborted(() => {
      debug("response has been aborted");
    });
  }

  protected createTransport(transportName, req) {
    return new transports[transportName](req);
  }

  /**
   * Attach the engine to a µWebSockets.js server
   * @param app
   * @param options
   */
  public attach(
    app /* : TemplatedApp */,
    options: AttachOptions & uOptions = {},
  ) {
    const path = this._computePath(options);
    (app as TemplatedApp)
      .any(path, this.handleRequest.bind(this))
      //
      .ws<{ transport: any }>(path, {
        compression: options.compression,
        idleTimeout: options.idleTimeout,
        maxBackpressure: options.maxBackpressure,
        maxPayloadLength: this.opts.maxHttpBufferSize,
        upgrade: this.handleUpgrade.bind(this),
        open: (ws) => {
          const transport = ws.getUserData().transport;
          transport.socket = ws;
          transport.writable = true;
          transport.emit("ready");
        },
        message: (ws, message, isBinary) => {
          ws.getUserData().transport.onData(
            isBinary ? message : Buffer.from(message).toString(),
          );
        },
        close: (ws, code, message) => {
          ws.getUserData().transport.onClose(code, message);
        },
      });
  }

  override _applyMiddlewares(
    req: any,
    res: any,
    callback: (err?: any) => void,
  ): void {
    if (this.middlewares.length === 0) {
      return callback();
    }

    // needed to buffer headers until the status is computed
    req.res = new ResponseWrapper(res);

    super._applyMiddlewares(req, req.res, (err) => {
      // some middlewares (like express-session) wait for the writeHead() call to flush their headers
      // see https://github.com/expressjs/session/blob/1010fadc2f071ddf2add94235d72224cf65159c6/index.js#L220-L244
      req.res.writeHead();

      callback(err);
    });
  }

  private handleRequest(
    res: HttpResponse,
    req: HttpRequest & { res: any; _query: any },
  ) {
    debug('handling "%s" http request "%s"', req.getMethod(), req.getUrl());
    this.prepare(req, res);

    req.res = res;

    const callback = (errorCode, errorContext) => {
      if (errorCode !== undefined) {
        this.emit("connection_error", {
          req,
          code: errorCode,
          message: Server.errorMessages[errorCode],
          context: errorContext,
        });
        this.abortRequest(req.res, errorCode, errorContext);
        return;
      }

      if (req._query.sid) {
        debug("setting new request for existing client");
        // @ts-ignore
        this.clients[req._query.sid].transport.onRequest(req);
      } else {
        const closeConnection = (errorCode, errorContext) =>
          this.abortRequest(res, errorCode, errorContext);
        this.handshake(req._query.transport, req, closeConnection);
      }
    };

    this._applyMiddlewares(req, res, (err) => {
      if (err) {
        callback(Server.errors.BAD_REQUEST, { name: "MIDDLEWARE_FAILURE" });
      } else {
        this.verify(req, false, callback);
      }
    });
  }

  private handleUpgrade(
    res: HttpResponse,
    req: HttpRequest & { res: any; _query: any },
    context,
  ) {
    debug("on upgrade");

    this.prepare(req, res);

    req.res = res;

    const callback = async (errorCode, errorContext) => {
      if (errorCode !== undefined) {
        this.emit("connection_error", {
          req,
          code: errorCode,
          message: Server.errorMessages[errorCode],
          context: errorContext,
        });
        this.abortRequest(res, errorCode, errorContext);
        return;
      }

      const id = req._query.sid;
      let transport;

      if (id) {
        const client = this.clients[id];
        if (!client) {
          debug("upgrade attempt for closed client");
          return res.close();
        } else if (client.upgrading) {
          debug("transport has already been trying to upgrade");
          return res.close();
        } else if (client.upgraded) {
          debug("transport had already been upgraded");
          return res.close();
        } else {
          debug("upgrading existing transport");
          transport = this.createTransport(req._query.transport, req);
          client._maybeUpgrade(transport);
        }
      } else {
        transport = await this.handshake(
          req._query.transport,
          req,
          (errorCode, errorContext) =>
            this.abortRequest(res, errorCode, errorContext),
        );
        if (!transport) {
          return;
        }
      }

      // calling writeStatus() triggers the flushing of any header added in a middleware
      req.res.writeStatus("101 Switching Protocols");

      res.upgrade(
        {
          transport,
        },
        req.getHeader("sec-websocket-key"),
        req.getHeader("sec-websocket-protocol"),
        req.getHeader("sec-websocket-extensions"),
        context,
      );
    };

    this._applyMiddlewares(req, res, (err) => {
      if (err) {
        callback(Server.errors.BAD_REQUEST, { name: "MIDDLEWARE_FAILURE" });
      } else {
        this.verify(req, true, callback);
      }
    });
  }

  private abortRequest(
    res: HttpResponse | ResponseWrapper,
    errorCode,
    errorContext,
  ) {
    const statusCode =
      errorCode === Server.errors.FORBIDDEN
        ? "403 Forbidden"
        : "400 Bad Request";
    const message =
      errorContext && errorContext.message
        ? errorContext.message
        : Server.errorMessages[errorCode];

    res.writeStatus(statusCode);
    res.writeHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        code: errorCode,
        message,
      }),
    );
  }
}

class ResponseWrapper {
  private statusWritten: boolean = false;
  private headers = [];
  private isAborted = false;

  constructor(readonly res: HttpResponse) {}

  public set statusCode(status: number) {
    if (!status) {
      return;
    }
    // FIXME: handle all status codes?
    this.writeStatus(status === 200 ? "200 OK" : "204 No Content");
  }

  public writeHead(status: number) {
    this.statusCode = status;
  }

  public setHeader(key, value) {
    if (Array.isArray(value)) {
      value.forEach((val) => {
        this.writeHeader(key, val);
      });
    } else {
      this.writeHeader(key, value);
    }
  }

  public removeHeader() {
    // FIXME: not implemented
  }

  // needed by vary: https://github.com/jshttp/vary/blob/5d725d059b3871025cf753e9dfa08924d0bcfa8f/index.js#L134
  public getHeader() {}

  public writeStatus(status: string) {
    if (this.isAborted) return;

    this.res.writeStatus(status);
    this.statusWritten = true;
    this.writeBufferedHeaders();
    return this;
  }

  public writeHeader(key: string, value: string) {
    if (this.isAborted) return;

    if (key === "Content-Length") {
      // the content length is automatically added by uWebSockets.js
      return;
    }
    if (this.statusWritten) {
      this.res.writeHeader(key, value);
    } else {
      this.headers.push([key, value]);
    }
  }

  private writeBufferedHeaders() {
    this.headers.forEach(([key, value]) => {
      this.res.writeHeader(key, value);
    });
  }

  public end(data) {
    if (this.isAborted) return;

    this.res.cork(() => {
      if (!this.statusWritten) {
        // status will be inferred as "200 OK"
        this.writeBufferedHeaders();
      }
      this.res.end(data);
    });
  }

  public onData(fn) {
    if (this.isAborted) return;

    this.res.onData(fn);
  }

  public onAborted(fn) {
    if (this.isAborted) return;

    this.res.onAborted(() => {
      // Any attempt to use the UWS response object after abort will throw!
      this.isAborted = true;
      fn();
    });
  }

  public cork(fn) {
    if (this.isAborted) return;

    this.res.cork(fn);
  }
}
