"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Socket = void 0;
const events_1 = require("events");
const socket_io_parser_1 = require("socket.io-parser");
const has_binary2_1 = __importDefault(require("has-binary2"));
const url_1 = __importDefault(require("url"));
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("socket.io:socket");
/**
 * Blacklisted events.
 */
const events = [
    "error",
    "connect",
    "disconnect",
    "disconnecting",
    "newListener",
    "removeListener"
];
class Socket extends events_1.EventEmitter {
    /**
     * Interface to a `Client` for a given `Namespace`.
     *
     * @param {Namespace} nsp
     * @param {Client} client
     * @param {Object} query
     * @package
     */
    constructor(nsp, client, query) {
        super();
        this.nsp = nsp;
        this.client = client;
        this.acks = new Map();
        this.fns = [];
        this.flags = {};
        this._rooms = new Set();
        this.server = nsp.server;
        this.adapter = this.nsp.adapter;
        this.id = nsp.name !== "/" ? nsp.name + "#" + client.id : client.id;
        this.connected = true;
        this.disconnected = false;
        this.handshake = this.buildHandshake(query);
    }
    /**
     * Builds the `handshake` BC object
     */
    buildHandshake(query) {
        const self = this;
        function buildQuery() {
            const requestQuery = url_1.default.parse(self.request.url, true).query;
            //if socket-specific query exist, replace query strings in requestQuery
            return Object.assign({}, query, requestQuery);
        }
        return {
            headers: this.request.headers,
            time: new Date() + "",
            address: this.conn.remoteAddress,
            xdomain: !!this.request.headers.origin,
            // @ts-ignore
            secure: !!this.request.connection.encrypted,
            issued: +new Date(),
            url: this.request.url,
            query: buildQuery()
        };
    }
    /**
     * Emits to this client.
     *
     * @return {Socket} self
     */
    // @ts-ignore
    emit(ev) {
        if (~events.indexOf(ev)) {
            super.emit.apply(this, arguments);
            return this;
        }
        const args = Array.prototype.slice.call(arguments);
        const packet = {
            type: (this.flags.binary !== undefined
                ? this.flags.binary
                : has_binary2_1.default(args))
                ? socket_io_parser_1.PacketType.BINARY_EVENT
                : socket_io_parser_1.PacketType.EVENT,
            data: args
        };
        // access last argument to see if it's an ACK callback
        if (typeof args[args.length - 1] === "function") {
            if (this._rooms.size || this.flags.broadcast) {
                throw new Error("Callbacks are not supported when broadcasting");
            }
            debug("emitting packet with ack id %d", this.nsp.ids);
            this.acks.set(this.nsp.ids, args.pop());
            packet.id = this.nsp.ids++;
        }
        const rooms = new Set(this._rooms);
        const flags = Object.assign({}, this.flags);
        // reset flags
        this._rooms.clear();
        this.flags = {};
        if (rooms.size || flags.broadcast) {
            this.adapter.broadcast(packet, {
                except: new Set([this.id]),
                rooms: rooms,
                flags: flags
            });
        }
        else {
            // dispatch packet
            this.packet(packet, flags);
        }
        return this;
    }
    /**
     * Targets a room when broadcasting.
     *
     * @param {String} name
     * @return {Socket} self
     */
    to(name) {
        this._rooms.add(name);
        return this;
    }
    /**
     * Targets a room when broadcasting.
     *
     * @param {String} name
     * @return {Socket} self
     */
    in(name) {
        this._rooms.add(name);
        return this;
    }
    /**
     * Sends a `message` event.
     *
     * @return {Socket} self
     */
    send(...args) {
        args.unshift("message");
        this.emit.apply(this, args);
        return this;
    }
    /**
     * Sends a `message` event.
     *
     * @return {Socket} self
     */
    write(...args) {
        args.unshift("message");
        this.emit.apply(this, args);
        return this;
    }
    /**
     * Writes a packet.
     *
     * @param {Object} packet - packet object
     * @param {Object} opts - options
     */
    packet(packet, opts = {}) {
        packet.nsp = this.nsp.name;
        opts.compress = false !== opts.compress;
        this.client.packet(packet, opts);
    }
    /**
     * Joins a room.
     *
     * @param {String|Array} rooms - room or array of rooms
     * @param {Function} fn - optional, callback
     * @return {Socket} self
     */
    join(rooms, fn) {
        debug("joining room %s", rooms);
        this.adapter.addAll(this.id, new Set(Array.isArray(rooms) ? rooms : [rooms]));
        debug("joined room %s", rooms);
        fn && fn(null);
        return this;
    }
    /**
     * Leaves a room.
     *
     * @param {String} room
     * @param {Function} fn - optional, callback
     * @return {Socket} self
     */
    leave(room, fn) {
        debug("leave room %s", room);
        this.adapter.del(this.id, room);
        debug("left room %s", room);
        fn && fn(null);
        return this;
    }
    /**
     * Leave all rooms.
     */
    leaveAll() {
        this.adapter.delAll(this.id);
    }
    /**
     * Called by `Namespace` upon successful
     * middleware execution (ie: authorization).
     * Socket is added to namespace array before
     * call to join, so adapters can access it.
     *
     * @package
     */
    onconnect() {
        debug("socket connected - writing packet");
        this.nsp.connected.set(this.id, this);
        this.join(this.id);
        const skip = this.nsp.name === "/" && this.nsp.fns.length === 0;
        if (skip) {
            debug("packet already sent in initial handshake");
        }
        else {
            this.packet({ type: socket_io_parser_1.PacketType.CONNECT });
        }
    }
    /**
     * Called with each packet. Called by `Client`.
     *
     * @param {Object} packet
     * @package
     */
    onpacket(packet) {
        debug("got packet %j", packet);
        switch (packet.type) {
            case socket_io_parser_1.PacketType.EVENT:
                this.onevent(packet);
                break;
            case socket_io_parser_1.PacketType.BINARY_EVENT:
                this.onevent(packet);
                break;
            case socket_io_parser_1.PacketType.ACK:
                this.onack(packet);
                break;
            case socket_io_parser_1.PacketType.BINARY_ACK:
                this.onack(packet);
                break;
            case socket_io_parser_1.PacketType.DISCONNECT:
                this.ondisconnect();
                break;
            case socket_io_parser_1.PacketType.ERROR:
                this.onerror(new Error(packet.data));
        }
    }
    /**
     * Called upon event packet.
     *
     * @param {Object} packet - packet object
     */
    onevent(packet) {
        const args = packet.data || [];
        debug("emitting event %j", args);
        if (null != packet.id) {
            debug("attaching ack callback to event");
            args.push(this.ack(packet.id));
        }
        this.dispatch(args);
    }
    /**
     * Produces an ack callback to emit with an event.
     *
     * @param {Number} id - packet id
     */
    ack(id) {
        const self = this;
        let sent = false;
        return function () {
            // prevent double callbacks
            if (sent)
                return;
            const args = Array.prototype.slice.call(arguments);
            debug("sending ack %j", args);
            self.packet({
                id: id,
                type: has_binary2_1.default(args) ? socket_io_parser_1.PacketType.BINARY_ACK : socket_io_parser_1.PacketType.ACK,
                data: args
            });
            sent = true;
        };
    }
    /**
     * Called upon ack packet.
     */
    onack(packet) {
        const ack = this.acks.get(packet.id);
        if ("function" == typeof ack) {
            debug("calling ack %s with %j", packet.id, packet.data);
            ack.apply(this, packet.data);
            this.acks.delete(packet.id);
        }
        else {
            debug("bad ack %s", packet.id);
        }
    }
    /**
     * Called upon client disconnect packet.
     */
    ondisconnect() {
        debug("got disconnect packet");
        this.onclose("client namespace disconnect");
    }
    /**
     * Handles a client error.
     *
     * @package
     */
    onerror(err) {
        if (this.listeners("error").length) {
            super.emit("error", err);
        }
        else {
            console.error("Missing error handler on `socket`.");
            console.error(err.stack);
        }
    }
    /**
     * Called upon closing. Called by `Client`.
     *
     * @param {String} reason
     * @throw {Error} optional error object
     *
     * @package
     */
    onclose(reason) {
        if (!this.connected)
            return this;
        debug("closing socket - reason %s", reason);
        super.emit("disconnecting", reason);
        this.leaveAll();
        this.nsp.remove(this);
        this.client.remove(this);
        this.connected = false;
        this.disconnected = true;
        this.nsp.connected.delete(this.id);
        super.emit("disconnect", reason);
    }
    /**
     * Produces an `error` packet.
     *
     * @param {Object} err - error object
     *
     * @package
     */
    error(err) {
        this.packet({ type: socket_io_parser_1.PacketType.ERROR, data: err });
    }
    /**
     * Disconnects this client.
     *
     * @param {Boolean} close - if `true`, closes the underlying connection
     * @return {Socket} self
     */
    disconnect(close = false) {
        if (!this.connected)
            return this;
        if (close) {
            this.client.disconnect();
        }
        else {
            this.packet({ type: socket_io_parser_1.PacketType.DISCONNECT });
            this.onclose("server namespace disconnect");
        }
        return this;
    }
    /**
     * Sets the compress flag.
     *
     * @param {Boolean} compress - if `true`, compresses the sending data
     * @return {Socket} self
     */
    compress(compress) {
        this.flags.compress = compress;
        return this;
    }
    /**
     * Sets the binary flag
     *
     * @param {Boolean} binary - encode as if it has binary data if `true`, Encode as if it doesnt have binary data if `false`
     * @return {Socket} self
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
     * @return {Socket} self
     */
    get volatile() {
        this.flags.volatile = true;
        return this;
    }
    /**
     * Sets a modifier for a subsequent event emission that the event data will only be broadcast to every sockets but the
     * sender.
     *
     * @return {Socket} self
     */
    get broadcast() {
        this.flags.broadcast = true;
        return this;
    }
    /**
     * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
     *
     * @return {Socket} self
     */
    get local() {
        this.flags.local = true;
        return this;
    }
    /**
     * Dispatch incoming event to socket listeners.
     *
     * @param {Array} event - event that will get emitted
     */
    dispatch(event) {
        debug("dispatching an event %j", event);
        this.run(event, err => {
            process.nextTick(() => {
                if (err) {
                    return this.error(err.message);
                }
                super.emit.apply(this, event);
            });
        });
    }
    /**
     * Sets up socket middleware.
     *
     * @param {Function} fn - middleware function (event, next)
     * @return {Socket} self
     */
    use(fn) {
        this.fns.push(fn);
        return this;
    }
    /**
     * Executes the middleware for an incoming event.
     *
     * @param {Array} event - event that will get emitted
     * @param {Function} fn - last fn call in the middleware
     */
    run(event, fn) {
        const fns = this.fns.slice(0);
        if (!fns.length)
            return fn(null);
        function run(i) {
            fns[i](event, function (err) {
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
    get request() {
        return this.client.request;
    }
    get conn() {
        return this.client.conn;
    }
    get rooms() {
        return this.adapter.socketRooms(this.id) || new Set();
    }
}
exports.Socket = Socket;
