"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
const http_1 = __importDefault(require("http"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const engine_io_1 = __importDefault(require("engine.io"));
const client_1 = require("./client");
const events_1 = require("events");
const namespace_1 = require("./namespace");
const parent_namespace_1 = require("./parent-namespace");
const socket_io_adapter_1 = require("socket.io-adapter");
const parser = __importStar(require("socket.io-parser"));
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("socket.io:server");
const clientVersion = require("socket.io-client/package.json").version;
/**
 * Socket.IO client source.
 */
let clientSource = undefined;
let clientSourceMap = undefined;
class Server extends events_1.EventEmitter {
    constructor(srv, opts = {}) {
        super();
        this.nsps = new Map();
        this.parentNsps = new Map();
        if ("object" == typeof srv && srv instanceof Object && !srv.listen) {
            opts = srv;
            srv = null;
        }
        this.path(opts.path || "/socket.io");
        this.serveClient(false !== opts.serveClient);
        this.parser = opts.parser || parser;
        this.encoder = new this.parser.Encoder();
        this.adapter(opts.adapter || socket_io_adapter_1.Adapter);
        this.sockets = this.of("/");
        if (srv)
            this.attach(srv, opts);
    }
    /**
     * Sets/gets whether client code is being served.
     *
     * @param {Boolean} v - whether to serve client code
     * @return {Server|Boolean} self when setting or value when getting
     */
    serveClient(v) {
        if (!arguments.length)
            return this._serveClient;
        this._serveClient = v;
        const resolvePath = function (file) {
            const filepath = path_1.default.resolve(__dirname, "./../../", file);
            if (fs_1.existsSync(filepath)) {
                return filepath;
            }
            return require.resolve(file);
        };
        if (v && !clientSource) {
            clientSource = fs_1.readFileSync(resolvePath("socket.io-client/dist/socket.io.js"), "utf-8");
            try {
                clientSourceMap = fs_1.readFileSync(resolvePath("socket.io-client/dist/socket.io.js.map"), "utf-8");
            }
            catch (err) {
                debug("could not load sourcemap file");
            }
        }
        return this;
    }
    /**
     * Executes the middleware for an incoming namespace not already created on the server.
     *
     * @param {String} name - name of incoming namespace
     * @param {Object} auth - the auth parameters
     * @param {Function} fn - callback
     *
     * @package
     */
    checkNamespace(name, auth, fn) {
        if (this.parentNsps.size === 0)
            return fn(false);
        const keysIterator = this.parentNsps.keys();
        const run = () => {
            let nextFn = keysIterator.next();
            if (nextFn.done) {
                return fn(false);
            }
            nextFn.value(name, auth, (err, allow) => {
                if (err || !allow) {
                    run();
                }
                else {
                    fn(this.parentNsps.get(nextFn.value).createChild(name));
                }
            });
        };
        run();
    }
    /**
     * Sets the client serving path.
     *
     * @param {String} v pathname
     * @return {Server|String} self when setting or value when getting
     */
    path(v) {
        if (!arguments.length)
            return this._path;
        this._path = v.replace(/\/$/, "");
        return this;
    }
    /**
     * Sets the adapter for rooms.
     *
     * @param {Adapter} v pathname
     * @return {Server|Adapter} self when setting or value when getting
     */
    adapter(v) {
        if (!arguments.length)
            return this._adapter;
        this._adapter = v;
        for (const nsp of this.nsps.values()) {
            nsp.initAdapter();
        }
        return this;
    }
    listen(srv, opts = {}) {
        return this.attach(srv, opts);
    }
    attach(srv, opts = {}) {
        if ("function" == typeof srv) {
            const msg = "You are trying to attach socket.io to an express " +
                "request handler function. Please pass a http.Server instance.";
            throw new Error(msg);
        }
        // handle a port as a string
        if (Number(srv) == srv) {
            srv = Number(srv);
        }
        if ("number" == typeof srv) {
            debug("creating http server and binding to %d", srv);
            const port = srv;
            srv = http_1.default.createServer((req, res) => {
                res.writeHead(404);
                res.end();
            });
            srv.listen(port);
        }
        // set engine.io path to `/socket.io`
        opts.path = opts.path || this._path;
        this.initEngine(srv, opts);
        return this;
    }
    /**
     * Initialize engine
     *
     * @param srv - the server to attach to
     * @param opts - options passed to engine.io
     */
    initEngine(srv, opts) {
        // initialize engine
        debug("creating engine.io instance with opts %j", opts);
        this.eio = engine_io_1.default.attach(srv, opts);
        // attach static file serving
        if (this._serveClient)
            this.attachServe(srv);
        // Export http server
        this.httpServer = srv;
        // bind to engine events
        this.bind(this.eio);
    }
    /**
     * Attaches the static file serving.
     *
     * @param {Function|http.Server} srv http server
     */
    attachServe(srv) {
        debug("attaching client serving req handler");
        const url = this._path + "/socket.io.js";
        const urlMap = this._path + "/socket.io.js.map";
        const evs = srv.listeners("request").slice(0);
        const self = this;
        srv.removeAllListeners("request");
        srv.on("request", function (req, res) {
            if (0 === req.url.indexOf(urlMap)) {
                self.serveMap(req, res);
            }
            else if (0 === req.url.indexOf(url)) {
                self.serve(req, res);
            }
            else {
                for (let i = 0; i < evs.length; i++) {
                    evs[i].call(srv, req, res);
                }
            }
        });
    }
    /**
     * Handles a request serving `/socket.io.js`
     *
     * @param {http.IncomingMessage} req
     * @param {http.ServerResponse} res
     */
    serve(req, res) {
        // Per the standard, ETags must be quoted:
        // https://tools.ietf.org/html/rfc7232#section-2.3
        const expectedEtag = '"' + clientVersion + '"';
        const etag = req.headers["if-none-match"];
        if (etag) {
            if (expectedEtag == etag) {
                debug("serve client 304");
                res.writeHead(304);
                res.end();
                return;
            }
        }
        debug("serve client source");
        res.setHeader("Cache-Control", "public, max-age=0");
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("ETag", expectedEtag);
        res.writeHead(200);
        res.end(clientSource);
    }
    /**
     * Handles a request serving `/socket.io.js.map`
     *
     * @param {http.IncomingMessage} req
     * @param {http.ServerResponse} res
     */
    serveMap(req, res) {
        // Per the standard, ETags must be quoted:
        // https://tools.ietf.org/html/rfc7232#section-2.3
        const expectedEtag = '"' + clientVersion + '"';
        const etag = req.headers["if-none-match"];
        if (etag) {
            if (expectedEtag == etag) {
                debug("serve client 304");
                res.writeHead(304);
                res.end();
                return;
            }
        }
        debug("serve client sourcemap");
        res.setHeader("Content-Type", "application/json");
        res.setHeader("ETag", expectedEtag);
        res.writeHead(200);
        res.end(clientSourceMap);
    }
    /**
     * Binds socket.io to an engine.io instance.
     *
     * @param {engine.Server} engine engine.io (or compatible) server
     * @return {Server} self
     */
    bind(engine) {
        this.engine = engine;
        this.engine.on("connection", this.onconnection.bind(this));
        return this;
    }
    /**
     * Called with each incoming transport connection.
     *
     * @param {engine.Socket} conn
     * @return {Server} self
     */
    onconnection(conn) {
        debug("incoming connection with id %s", conn.id);
        new client_1.Client(this, conn);
        return this;
    }
    /**
     * Looks up a namespace.
     *
     * @param {String|RegExp|Function} name nsp name
     * @param {Function} [fn] optional, nsp `connection` ev handler
     */
    of(name, fn) {
        if (typeof name === "function" || name instanceof RegExp) {
            const parentNsp = new parent_namespace_1.ParentNamespace(this);
            debug("initializing parent namespace %s", parentNsp.name);
            if (typeof name === "function") {
                this.parentNsps.set(name, parentNsp);
            }
            else {
                this.parentNsps.set((nsp, conn, next) => next(null, name.test(nsp)), parentNsp);
            }
            if (fn) {
                // @ts-ignore
                parentNsp.on("connect", fn);
            }
            return parentNsp;
        }
        if (String(name)[0] !== "/")
            name = "/" + name;
        let nsp = this.nsps.get(name);
        if (!nsp) {
            debug("initializing namespace %s", name);
            nsp = new namespace_1.Namespace(this, name);
            this.nsps.set(name, nsp);
        }
        if (fn)
            nsp.on("connect", fn);
        return nsp;
    }
    /**
     * Closes server connection
     *
     * @param {Function} [fn] optional, called as `fn([err])` on error OR all conns closed
     */
    close(fn) {
        for (const socket of this.sockets.sockets.values()) {
            socket.onclose("server shutting down");
        }
        this.engine.close();
        if (this.httpServer) {
            this.httpServer.close(fn);
        }
        else {
            fn && fn();
        }
    }
    /**
     * Sets up namespace middleware.
     *
     * @return {Server} self
     * @public
     */
    use(fn) {
        this.sockets.use(fn);
        return this;
    }
    /**
     * Targets a room when emitting.
     *
     * @param {String} name
     * @return {Server} self
     * @public
     */
    to(name) {
        this.sockets.to(name);
        return this;
    }
    /**
     * Targets a room when emitting.
     *
     * @param {String} name
     * @return {Server} self
     * @public
     */
    in(name) {
        this.sockets.in(name);
        return this;
    }
    /**
     * Sends a `message` event to all clients.
     *
     * @return {Namespace} self
     */
    send(...args) {
        args.unshift("message");
        this.sockets.emit.apply(this.sockets, args);
        return this;
    }
    /**
     * Sends a `message` event to all clients.
     *
     * @return {Namespace} self
     */
    write(...args) {
        args.unshift("message");
        this.sockets.emit.apply(this.sockets, args);
        return this;
    }
    /**
     * Gets a list of socket ids.
     */
    allSockets() {
        return this.sockets.allSockets();
    }
    /**
     * Sets the compress flag.
     *
     * @param {Boolean} compress - if `true`, compresses the sending data
     * @return {Server} self
     */
    compress(compress) {
        this.sockets.compress(compress);
        return this;
    }
    /**
     * Sets the binary flag
     *
     * @param {Boolean} binary - encode as if it has binary data if `true`, Encode as if it doesnt have binary data if `false`
     * @return {Server} self
     */
    binary(binary) {
        this.sockets.binary(binary);
        return this;
    }
    /**
     * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
     * receive messages (because of network slowness or other issues, or because they’re connected through long polling
     * and is in the middle of a request-response cycle).
     *
     * @return {Server} self
     */
    get volatile() {
        this.sockets.volatile;
        return this;
    }
    /**
     * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
     *
     * @return {Server} self
     */
    get local() {
        this.sockets.local;
        return this;
    }
}
exports.Server = Server;
/**
 * Expose main namespace (/).
 */
const emitterMethods = Object.keys(events_1.EventEmitter.prototype).filter(function (key) {
    return typeof events_1.EventEmitter.prototype[key] === "function";
});
emitterMethods.forEach(function (fn) {
    Server.prototype[fn] = function () {
        return this.sockets[fn].apply(this.sockets, arguments);
    };
});
module.exports = (srv, opts) => new Server(srv, opts);
module.exports.Server = Server;
