const qs = require("querystring");
const parse = require("url").parse;
const base64id = require("base64id");
const transports = require("./transports");
const EventEmitter = require("events").EventEmitter;
const Socket = require("./socket");
const debug = require("debug")("engine");
const cookieMod = require("cookie");

const DEFAULT_WS_ENGINE = require("ws").Server;

class Server extends EventEmitter {
  /**
   * Server constructor.
   *
   * @param {Object} options
   * @api public
   */
  constructor(opts = {}) {
    super();

    this.clients = {};
    this.clientsCount = 0;

    this.opts = Object.assign(
      {
        wsEngine: DEFAULT_WS_ENGINE,
        pingTimeout: 20000,
        pingInterval: 25000,
        upgradeTimeout: 10000,
        maxHttpBufferSize: 1e6,
        transports: Object.keys(transports),
        allowUpgrades: true,
        httpCompression: {
          threshold: 1024
        },
        cors: false,
        allowEIO3: false
      },
      opts
    );

    if (opts.cookie) {
      this.opts.cookie = Object.assign(
        {
          name: "io",
          path: "/",
          httpOnly: opts.cookie.path !== false,
          sameSite: "lax"
        },
        opts.cookie
      );
    }

    if (this.opts.cors) {
      this.corsMiddleware = require("cors")(this.opts.cors);
    }

    if (opts.perMessageDeflate) {
      this.opts.perMessageDeflate = Object.assign(
        {
          threshold: 1024
        },
        opts.perMessageDeflate
      );
    }

    this.init();
  }

  /**
   * Initialize websocket server
   *
   * @api private
   */
  init() {
    if (!~this.opts.transports.indexOf("websocket")) return;

    if (this.ws) this.ws.close();

    this.ws = new this.opts.wsEngine({
      noServer: true,
      clientTracking: false,
      perMessageDeflate: this.opts.perMessageDeflate,
      maxPayload: this.opts.maxHttpBufferSize
    });

    if (typeof this.ws.on === "function") {
      this.ws.on("headers", (headersArray, req) => {
        // note: 'ws' uses an array of headers, while Engine.IO uses an object (response.writeHead() accepts both formats)
        // we could also try to parse the array and then sync the values, but that will be error-prone
        const additionalHeaders = {};

        const isInitialRequest = !req._query.sid;
        if (isInitialRequest) {
          this.emit("initial_headers", additionalHeaders, req);
        }

        this.emit("headers", additionalHeaders, req);

        Object.keys(additionalHeaders).forEach(key => {
          headersArray.push(`${key}: ${additionalHeaders[key]}`);
        });
      });
    }
  }

  /**
   * Returns a list of available transports for upgrade given a certain transport.
   *
   * @return {Array}
   * @api public
   */
  upgrades(transport) {
    if (!this.opts.allowUpgrades) return [];
    return transports[transport].upgradesTo || [];
  }

  /**
   * Verifies a request.
   *
   * @param {http.IncomingMessage}
   * @return {Boolean} whether the request is valid
   * @api private
   */
  verify(req, upgrade, fn) {
    // transport check
    const transport = req._query.transport;
    if (!~this.opts.transports.indexOf(transport)) {
      debug('unknown transport "%s"', transport);
      return fn(Server.errors.UNKNOWN_TRANSPORT, { transport });
    }

    // 'Origin' header check
    const isOriginInvalid = checkInvalidHeaderChar(req.headers.origin);
    if (isOriginInvalid) {
      const origin = req.headers.origin;
      req.headers.origin = null;
      debug("origin header invalid");
      return fn(Server.errors.BAD_REQUEST, {
        name: "INVALID_ORIGIN",
        origin
      });
    }

    // sid check
    const sid = req._query.sid;
    if (sid) {
      if (!this.clients.hasOwnProperty(sid)) {
        debug('unknown sid "%s"', sid);
        return fn(Server.errors.UNKNOWN_SID, {
          sid
        });
      }
      const previousTransport = this.clients[sid].transport.name;
      if (!upgrade && previousTransport !== transport) {
        debug("bad request: unexpected transport without upgrade");
        return fn(Server.errors.BAD_REQUEST, {
          name: "TRANSPORT_MISMATCH",
          transport,
          previousTransport
        });
      }
    } else {
      // handshake is GET only
      if ("GET" !== req.method) {
        return fn(Server.errors.BAD_HANDSHAKE_METHOD, {
          method: req.method
        });
      }

      if (!this.opts.allowRequest) return fn();

      return this.opts.allowRequest(req, (message, success) => {
        if (!success) {
          return fn(Server.errors.FORBIDDEN, {
            message
          });
        }
        fn();
      });
    }

    fn();
  }

  /**
   * Prepares a request by processing the query string.
   *
   * @api private
   */
  prepare(req) {
    // try to leverage pre-existing `req._query` (e.g: from connect)
    if (!req._query) {
      req._query = ~req.url.indexOf("?") ? qs.parse(parse(req.url).query) : {};
    }
  }

  /**
   * Closes all clients.
   *
   * @api public
   */
  close() {
    debug("closing all open clients");
    for (let i in this.clients) {
      if (this.clients.hasOwnProperty(i)) {
        this.clients[i].close(true);
      }
    }
    if (this.ws) {
      debug("closing webSocketServer");
      this.ws.close();
      // don't delete this.ws because it can be used again if the http server starts listening again
    }
    return this;
  }

  /**
   * Handles an Engine.IO HTTP request.
   *
   * @param {http.IncomingMessage} request
   * @param {http.ServerResponse|http.OutgoingMessage} response
   * @api public
   */
  handleRequest(req, res) {
    debug('handling "%s" http request "%s"', req.method, req.url);
    this.prepare(req);
    req.res = res;

    const callback = (errorCode, errorContext) => {
      if (errorCode !== undefined) {
        this.emit("connection_error", {
          req,
          code: errorCode,
          message: Server.errorMessages[errorCode],
          context: errorContext
        });
        sendErrorMessage(req, res, errorCode, errorContext);
        return;
      }

      if (req._query.sid) {
        debug("setting new request for existing client");
        this.clients[req._query.sid].transport.onRequest(req);
      } else {
        this.handshake(req._query.transport, req);
      }
    };

    if (this.corsMiddleware) {
      this.corsMiddleware.call(null, req, res, () => {
        this.verify(req, false, callback);
      });
    } else {
      this.verify(req, false, callback);
    }
  }

  /**
   * generate a socket id.
   * Overwrite this method to generate your custom socket id
   *
   * @param {Object} request object
   * @api public
   */
  generateId(req) {
    return base64id.generateId();
  }

  /**
   * Handshakes a new client.
   *
   * @param {String} transport name
   * @param {Object} request object
   * @api private
   */
  async handshake(transportName, req) {
    const protocol = req._query.EIO === "4" ? 4 : 3; // 3rd revision by default
    if (protocol === 3 && !this.opts.allowEIO3) {
      debug("unsupported protocol version");
      this.emit("connection_error", {
        req,
        code: Server.errors.UNSUPPORTED_PROTOCOL_VERSION,
        message:
          Server.errorMessages[Server.errors.UNSUPPORTED_PROTOCOL_VERSION],
        context: {
          protocol
        }
      });
      sendErrorMessage(
        req,
        req.res,
        Server.errors.UNSUPPORTED_PROTOCOL_VERSION
      );
      return;
    }

    let id;
    try {
      id = await this.generateId(req);
    } catch (e) {
      debug("error while generating an id");
      this.emit("connection_error", {
        req,
        code: Server.errors.BAD_REQUEST,
        message: Server.errorMessages[Server.errors.BAD_REQUEST],
        context: {
          name: "ID_GENERATION_ERROR",
          error: e
        }
      });
      sendErrorMessage(req, req.res, Server.errors.BAD_REQUEST);
      return;
    }

    debug('handshaking client "%s"', id);

    try {
      var transport = new transports[transportName](req);
      if ("polling" === transportName) {
        transport.maxHttpBufferSize = this.opts.maxHttpBufferSize;
        transport.httpCompression = this.opts.httpCompression;
      } else if ("websocket" === transportName) {
        transport.perMessageDeflate = this.opts.perMessageDeflate;
      }

      if (req._query && req._query.b64) {
        transport.supportsBinary = false;
      } else {
        transport.supportsBinary = true;
      }
    } catch (e) {
      debug('error handshaking to transport "%s"', transportName);
      this.emit("connection_error", {
        req,
        code: Server.errors.BAD_REQUEST,
        message: Server.errorMessages[Server.errors.BAD_REQUEST],
        context: {
          name: "TRANSPORT_HANDSHAKE_ERROR",
          error: e
        }
      });
      sendErrorMessage(req, req.res, Server.errors.BAD_REQUEST);
      return;
    }
    const socket = new Socket(id, this, transport, req, protocol);

    transport.on("headers", (headers, req) => {
      const isInitialRequest = !req._query.sid;

      if (isInitialRequest) {
        if (this.opts.cookie) {
          headers["Set-Cookie"] = [
            cookieMod.serialize(this.opts.cookie.name, id, this.opts.cookie)
          ];
        }
        this.emit("initial_headers", headers, req);
      }
      this.emit("headers", headers, req);
    });

    transport.onRequest(req);

    this.clients[id] = socket;
    this.clientsCount++;

    socket.once("close", () => {
      delete this.clients[id];
      this.clientsCount--;
    });

    this.emit("connection", socket);
  }

  /**
   * Handles an Engine.IO HTTP Upgrade.
   *
   * @api public
   */
  handleUpgrade(req, socket, upgradeHead) {
    this.prepare(req);

    this.verify(req, true, (errorCode, errorContext) => {
      if (errorCode) {
        this.emit("connection_error", {
          req,
          code: errorCode,
          message: Server.errorMessages[errorCode],
          context: errorContext
        });
        abortConnection(socket, errorCode, errorContext);
        return;
      }

      const head = Buffer.from(upgradeHead); // eslint-disable-line node/no-deprecated-api
      upgradeHead = null;

      // delegate to ws
      this.ws.handleUpgrade(req, socket, head, conn => {
        this.onWebSocket(req, conn);
      });
    });
  }

  /**
   * Called upon a ws.io connection.
   *
   * @param {ws.Socket} websocket
   * @api private
   */
  onWebSocket(req, socket) {
    socket.on("error", onUpgradeError);

    if (
      transports[req._query.transport] !== undefined &&
      !transports[req._query.transport].prototype.handlesUpgrades
    ) {
      debug("transport doesnt handle upgraded requests");
      socket.close();
      return;
    }

    // get client id
    const id = req._query.sid;

    // keep a reference to the ws.Socket
    req.websocket = socket;

    if (id) {
      const client = this.clients[id];
      if (!client) {
        debug("upgrade attempt for closed client");
        socket.close();
      } else if (client.upgrading) {
        debug("transport has already been trying to upgrade");
        socket.close();
      } else if (client.upgraded) {
        debug("transport had already been upgraded");
        socket.close();
      } else {
        debug("upgrading existing transport");

        // transport error handling takes over
        socket.removeListener("error", onUpgradeError);

        const transport = new transports[req._query.transport](req);
        if (req._query && req._query.b64) {
          transport.supportsBinary = false;
        } else {
          transport.supportsBinary = true;
        }
        transport.perMessageDeflate = this.perMessageDeflate;
        client.maybeUpgrade(transport);
      }
    } else {
      // transport error handling takes over
      socket.removeListener("error", onUpgradeError);

      this.handshake(req._query.transport, req);
    }

    function onUpgradeError() {
      debug("websocket error before upgrade");
      // socket.close() not needed
    }
  }

  /**
   * Captures upgrade requests for a http.Server.
   *
   * @param {http.Server} server
   * @param {Object} options
   * @api public
   */
  attach(server, options = {}) {
    let path = (options.path || "/engine.io").replace(/\/$/, "");

    const destroyUpgradeTimeout = options.destroyUpgradeTimeout || 1000;

    // normalize path
    path += "/";

    function check(req) {
      return path === req.url.substr(0, path.length);
    }

    // cache and clean up listeners
    const listeners = server.listeners("request").slice(0);
    server.removeAllListeners("request");
    server.on("close", this.close.bind(this));
    server.on("listening", this.init.bind(this));

    // add request handler
    server.on("request", (req, res) => {
      if (check(req)) {
        debug('intercepting request for path "%s"', path);
        this.handleRequest(req, res);
      } else {
        let i = 0;
        const l = listeners.length;
        for (; i < l; i++) {
          listeners[i].call(server, req, res);
        }
      }
    });

    if (~this.opts.transports.indexOf("websocket")) {
      server.on("upgrade", (req, socket, head) => {
        if (check(req)) {
          this.handleUpgrade(req, socket, head);
        } else if (false !== options.destroyUpgrade) {
          // default node behavior is to disconnect when no handlers
          // but by adding a handler, we prevent that
          // and if no eio thing handles the upgrade
          // then the socket needs to die!
          setTimeout(function() {
            if (socket.writable && socket.bytesWritten <= 0) {
              return socket.end();
            }
          }, destroyUpgradeTimeout);
        }
      });
    }
  }
}

/**
 * Protocol errors mappings.
 */

Server.errors = {
  UNKNOWN_TRANSPORT: 0,
  UNKNOWN_SID: 1,
  BAD_HANDSHAKE_METHOD: 2,
  BAD_REQUEST: 3,
  FORBIDDEN: 4,
  UNSUPPORTED_PROTOCOL_VERSION: 5
};

Server.errorMessages = {
  0: "Transport unknown",
  1: "Session ID unknown",
  2: "Bad handshake method",
  3: "Bad request",
  4: "Forbidden",
  5: "Unsupported protocol version"
};

/**
 * Sends an Engine.IO Error Message
 *
 * @param req - the request object
 * @param res - the response object
 * @param errorCode - the error code
 * @param errorContext - additional error context
 *
 * @api private
 */

function sendErrorMessage(req, res, errorCode, errorContext) {
  const statusCode = errorCode === Server.errors.FORBIDDEN ? 403 : 400;
  const message =
    errorContext && errorContext.message
      ? errorContext.message
      : Server.errorMessages[errorCode];

  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      code: errorCode,
      message
    })
  );
}

/**
 * Closes the connection
 *
 * @param {net.Socket} socket
 * @param {string} errorCode - the error code
 * @param {object} errorContext - additional error context
 *
 * @api private
 */

function abortConnection(socket, errorCode, errorContext) {
  socket.on("error", () => {
    debug("ignoring error from closed connection");
  });
  if (socket.writable) {
    const message = errorContext.message || Server.errorMessages[errorCode];
    const length = Buffer.byteLength(message);
    socket.write(
      "HTTP/1.1 400 Bad Request\r\n" +
        "Connection: close\r\n" +
        "Content-type: text/html\r\n" +
        "Content-Length: " +
        length +
        "\r\n" +
        "\r\n" +
        message
    );
  }
  socket.destroy();
}

module.exports = Server;

/* eslint-disable */

/**
 * From https://github.com/nodejs/node/blob/v8.4.0/lib/_http_common.js#L303-L354
 *
 * True if val contains an invalid field-vchar
 *  field-value    = *( field-content / obs-fold )
 *  field-content  = field-vchar [ 1*( SP / HTAB ) field-vchar ]
 *  field-vchar    = VCHAR / obs-text
 *
 * checkInvalidHeaderChar() is currently designed to be inlinable by v8,
 * so take care when making changes to the implementation so that the source
 * code size does not exceed v8's default max_inlined_source_size setting.
 **/
// prettier-ignore
const validHdrChars = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, // 0 - 15
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16 - 31
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 32 - 47
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 48 - 63
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 64 - 79
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 80 - 95
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 96 - 111
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, // 112 - 127
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 128 ...
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1  // ... 255
]

function checkInvalidHeaderChar(val) {
  val += "";
  if (val.length < 1) return false;
  if (!validHdrChars[val.charCodeAt(0)]) {
    debug('invalid header, index 0, char "%s"', val.charCodeAt(0));
    return true;
  }
  if (val.length < 2) return false;
  if (!validHdrChars[val.charCodeAt(1)]) {
    debug('invalid header, index 1, char "%s"', val.charCodeAt(1));
    return true;
  }
  if (val.length < 3) return false;
  if (!validHdrChars[val.charCodeAt(2)]) {
    debug('invalid header, index 2, char "%s"', val.charCodeAt(2));
    return true;
  }
  if (val.length < 4) return false;
  if (!validHdrChars[val.charCodeAt(3)]) {
    debug('invalid header, index 3, char "%s"', val.charCodeAt(3));
    return true;
  }
  for (let i = 4; i < val.length; ++i) {
    if (!validHdrChars[val.charCodeAt(i)]) {
      debug('invalid header, index "%i", char "%s"', i, val.charCodeAt(i));
      return true;
    }
  }
  return false;
}
