"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Namespace = void 0;
const socket_1 = require("./socket");
const events_1 = require("events");
const socket_io_parser_1 = require("socket.io-parser");
const has_binary2_1 = __importDefault(require("has-binary2"));
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("socket.io:namespace");
/**
 * Blacklisted events.
 */
const events = [
    "connect",
    "connection",
    "newListener"
];
class Namespace extends events_1.EventEmitter {
    /**
     * Namespace constructor.
     *
     * @param {Server} server instance
     * @param {string} name
     */
    constructor(server, name) {
        super();
        this.connected = new Map();
        /** @package */
        this.fns = [];
        /** @package */
        this.rooms = new Set();
        /** @package */
        this.flags = {};
        /** @package */
        this.ids = 0;
        /** @package */
        this.sockets = new Map();
        this.server = server;
        this.name = name;
        this.initAdapter();
    }
    /**
     * Initializes the `Adapter` for this nsp.
     * Run upon changing adapter by `Server#adapter`
     * in addition to the constructor.
     *
     * @package
     */
    initAdapter() {
        this.adapter = new (this.server.adapter())(this);
    }
    /**
     * Sets up namespace middleware.
     *
     * @return {Namespace} self
     */
    use(fn) {
        this.fns.push(fn);
        return this;
    }
    /**
     * Executes the middleware for an incoming client.
     *
     * @param {Socket} socket - the socket that will get added
     * @param {Function} fn - last fn call in the middleware
     */
    run(socket, fn) {
        const fns = this.fns.slice(0);
        if (!fns.length)
            return fn(null);
        function run(i) {
            fns[i](socket, function (err) {
                // upon error, short-circuit
                if (err)
                    return fn(err);
                // if no middleware left, summon callback
                if (!fns[i + 1])
                    return fn(null);
                // go on to next
                run(i + 1);
            });
        }
        run(0);
    }
    /**
     * Targets a room when emitting.
     *
     * @param {String} name
     * @return {Namespace} self
     */
    to(name) {
        this.rooms.add(name);
        return this;
    }
    /**
     * Targets a room when emitting.
     *
     * @param {String} name
     * @return {Namespace} self
     */
    in(name) {
        this.rooms.add(name);
        return this;
    }
    /**
     * Adds a new client.
     *
     * @return {Socket}
     */
    add(client, query, fn) {
        debug("adding socket to nsp %s", this.name);
        const socket = new socket_1.Socket(this, client, query);
        this.run(socket, err => {
            process.nextTick(() => {
                if ("open" == client.conn.readyState) {
                    if (err)
                        return socket.error(err.message);
                    // track socket
                    this.sockets.set(socket.id, socket);
                    // it's paramount that the internal `onconnect` logic
                    // fires before user-set events to prevent state order
                    // violations (such as a disconnection before the connection
                    // logic is complete)
                    socket.onconnect();
                    if (fn)
                        fn();
                    // fire user-set events
                    super.emit("connect", socket);
                    super.emit("connection", socket);
                }
                else {
                    debug("next called after client was closed - ignoring socket");
                }
            });
        });
        return socket;
    }
    /**
     * Removes a client. Called by each `Socket`.
     *
     * @package
     */
    remove(socket) {
        if (this.sockets.has(socket.id)) {
            this.sockets.delete(socket.id);
        }
        else {
            debug("ignoring remove for %s", socket.id);
        }
    }
    /**
     * Emits to all clients.
     *
     * @return {Namespace} self
     */
    // @ts-ignore
    emit(ev) {
        if (~events.indexOf(ev)) {
            super.emit.apply(this, arguments);
            return this;
        }
        // set up packet object
        const args = Array.prototype.slice.call(arguments);
        const packet = {
            type: (this.flags.binary !== undefined
                ? this.flags.binary
                : has_binary2_1.default(args))
                ? socket_io_parser_1.PacketType.BINARY_EVENT
                : socket_io_parser_1.PacketType.EVENT,
            data: args
        };
        if ("function" == typeof args[args.length - 1]) {
            throw new Error("Callbacks are not supported when broadcasting");
        }
        const rooms = new Set(this.rooms);
        const flags = Object.assign({}, this.flags);
        // reset flags
        this.rooms.clear();
        this.flags = {};
        this.adapter.broadcast(packet, {
            rooms: rooms,
            flags: flags
        });
        return this;
    }
    /**
     * Sends a `message` event to all clients.
     *
     * @return {Namespace} self
     */
    send(...args) {
        args.unshift("message");
        this.emit.apply(this, args);
        return this;
    }
    /**
     * Sends a `message` event to all clients.
     *
     * @return {Namespace} self
     */
    write(...args) {
        args.unshift("message");
        this.emit.apply(this, args);
        return this;
    }
    /**
     * Gets a list of clients.
     *
     * @return {Namespace} self
     */
    allSockets() {
        if (!this.adapter) {
            throw new Error("No adapter for this namespace, are you trying to get the list of clients of a dynamic namespace?");
        }
        const rooms = new Set(this.rooms);
        this.rooms.clear();
        return this.adapter.sockets(rooms);
    }
    /**
     * Sets the compress flag.
     *
     * @param {Boolean} compress - if `true`, compresses the sending data
     * @return {Namespace} self
     */
    compress(compress) {
        this.flags.compress = compress;
        return this;
    }
    /**
     * Sets the binary flag
     *
     * @param {Boolean} binary - encode as if it has binary data if `true`, Encode as if it doesnt have binary data if `false`
     * @return {Namespace} self
     */
    binary(binary) {
        this.flags.binary = binary;
        return this;
    }
    /**
     * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
     * receive messages (because of network slowness or other issues, or because they’re connected through long polling
     * and is in the middle of a request-response cycle).
     *
     * @return {Namespace} self
     */
    get volatile() {
        this.flags.volatile = true;
        return this;
    }
    /**
     * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
     *
     * @return {Namespace} self
     */
    get local() {
        this.flags.local = true;
        return this;
    }
}
exports.Namespace = Namespace;
