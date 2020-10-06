"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Socket = void 0;
const socket_io_parser_1 = require("socket.io-parser");
const component_emitter_1 = __importDefault(require("component-emitter"));
const to_array_1 = __importDefault(require("to-array"));
const on_1 = require("./on");
const component_bind_1 = __importDefault(require("component-bind"));
const parseqs_1 = __importDefault(require("parseqs"));
const has_binary2_1 = __importDefault(require("has-binary2"));
const debug = require("debug")("socket.io-client:socket");
/**
 * Internal events (blacklisted).
 * These events can't be emitted by the user.
 *
 * @api private
 */
const events = {
    connect: 1,
    connect_error: 1,
    connect_timeout: 1,
    connecting: 1,
    disconnect: 1,
    error: 1,
    reconnect: 1,
    reconnect_attempt: 1,
    reconnect_failed: 1,
    reconnect_error: 1,
    reconnecting: 1,
    ping: 1,
    pong: 1,
};
class Socket extends component_emitter_1.default {
    /**
     * `Socket` constructor.
     *
     * @api public
     */
    constructor(io, nsp, opts) {
        super();
        this.ids = 0;
        this.acks = {};
        this.receiveBuffer = [];
        this.sendBuffer = [];
        this.flags = {};
        this.io = io;
        this.nsp = nsp;
        this.ids = 0;
        this.acks = {};
        this.receiveBuffer = [];
        this.sendBuffer = [];
        this.connected = false;
        this.disconnected = true;
        this.flags = {};
        if (opts && opts.query) {
            this.query = opts.query;
        }
        if (this.io.autoConnect)
            this.open();
    }
    /**
     * Subscribe to open, close and packet events
     *
     * @api private
     */
    subEvents() {
        if (this.subs)
            return;
        const io = this.io;
        this.subs = [
            on_1.on(io, "open", component_bind_1.default(this, "onopen")),
            on_1.on(io, "packet", component_bind_1.default(this, "onpacket")),
            on_1.on(io, "close", component_bind_1.default(this, "onclose")),
        ];
    }
    /**
     * "Opens" the socket.
     *
     * @api public
     */
    open() {
        if (this.connected)
            return this;
        this.subEvents();
        if (!this.io.reconnecting)
            this.io.open(); // ensure open
        if ("open" === this.io.readyState)
            this.onopen();
        this.emit("connecting");
        return this;
    }
    connect() {
        if (this.connected)
            return this;
        this.subEvents();
        if (!this.io.reconnecting)
            this.io.open(); // ensure open
        if ("open" === this.io.readyState)
            this.onopen();
        this.emit("connecting");
        return this;
    }
    /**
     * Sends a `message` event.
     *
     * @return {Socket} self
     * @api public
     */
    send() {
        const args = to_array_1.default(arguments);
        args.unshift("message");
        this.emit.apply(this, args);
        return this;
    }
    /**
     * Override `emit`.
     * If the event is in `events`, it's emitted normally.
     *
     * @param {String} event name
     * @return {Socket} self
     * @api public
     */
    emit(ev) {
        if (events.hasOwnProperty(ev)) {
            super.emit.apply(this, arguments);
            return this;
        }
        const args = to_array_1.default(arguments);
        const packet = {
            type: (this.flags.binary !== undefined ? this.flags.binary : has_binary2_1.default(args))
                ? socket_io_parser_1.PacketType.BINARY_EVENT
                : socket_io_parser_1.PacketType.EVENT,
            data: args,
        };
        packet.options = {};
        packet.options.compress = !this.flags || false !== this.flags.compress;
        // event ack callback
        if ("function" === typeof args[args.length - 1]) {
            debug("emitting packet with ack id %d", this.ids);
            this.acks[this.ids] = args.pop();
            packet.id = this.ids++;
        }
        if (this.connected) {
            this.packet(packet);
        }
        else {
            this.sendBuffer.push(packet);
        }
        this.flags = {};
        return this;
    }
    /**
     * Sends a packet.
     *
     * @param {Object} packet
     * @api private
     */
    packet(packet) {
        packet.nsp = this.nsp;
        this.io.packet(packet);
    }
    /**
     * Called upon engine `open`.
     *
     * @api private
     */
    onopen() {
        debug("transport is open - connecting");
        // write connect packet if necessary
        if ("/" !== this.nsp) {
            if (this.query) {
                const query = typeof this.query === "object"
                    ? parseqs_1.default.encode(this.query)
                    : this.query;
                debug("sending connect packet with query %s", query);
                this.packet({ type: socket_io_parser_1.PacketType.CONNECT, query: query });
            }
            else {
                this.packet({ type: socket_io_parser_1.PacketType.CONNECT });
            }
        }
    }
    /**
     * Called upon engine `close`.
     *
     * @param {String} reason
     * @api private
     */
    onclose(reason) {
        debug("close (%s)", reason);
        this.connected = false;
        this.disconnected = true;
        delete this.id;
        super.emit("disconnect", reason);
    }
    /**
     * Called with socket packet.
     *
     * @param {Object} packet
     * @api private
     */
    onpacket(packet) {
        const sameNamespace = packet.nsp === this.nsp;
        const rootNamespaceError = packet.type === socket_io_parser_1.PacketType.ERROR && packet.nsp === "/";
        if (!sameNamespace && !rootNamespaceError)
            return;
        switch (packet.type) {
            case socket_io_parser_1.PacketType.CONNECT:
                this.onconnect();
                break;
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
                super.emit("error", packet.data);
                break;
        }
    }
    /**
     * Called upon a server event.
     *
     * @param {Object} packet
     * @api private
     */
    onevent(packet) {
        const args = packet.data || [];
        debug("emitting event %j", args);
        if (null != packet.id) {
            debug("attaching ack callback to event");
            args.push(this.ack(packet.id));
        }
        if (this.connected) {
            super.emit.apply(this, args);
        }
        else {
            this.receiveBuffer.push(args);
        }
    }
    /**
     * Produces an ack callback to emit with an event.
     *
     * @api private
     */
    ack(id) {
        const self = this;
        let sent = false;
        return function () {
            // prevent double callbacks
            if (sent)
                return;
            sent = true;
            const args = to_array_1.default(arguments);
            debug("sending ack %j", args);
            self.packet({
                type: has_binary2_1.default(args) ? socket_io_parser_1.PacketType.BINARY_ACK : socket_io_parser_1.PacketType.ACK,
                id: id,
                data: args,
            });
        };
    }
    /**
     * Called upon a server acknowlegement.
     *
     * @param {Object} packet
     * @api private
     */
    onack(packet) {
        const ack = this.acks[packet.id];
        if ("function" === typeof ack) {
            debug("calling ack %s with %j", packet.id, packet.data);
            ack.apply(this, packet.data);
            delete this.acks[packet.id];
        }
        else {
            debug("bad ack %s", packet.id);
        }
    }
    /**
     * Called upon server connect.
     *
     * @api private
     */
    onconnect() {
        this.connected = true;
        this.disconnected = false;
        this.emit("connect");
        this.emitBuffered();
    }
    /**
     * Emit buffered events (received and emitted).
     *
     * @api private
     */
    emitBuffered() {
        for (let i = 0; i < this.receiveBuffer.length; i++) {
            super.emit.apply(this, this.receiveBuffer[i]);
        }
        this.receiveBuffer = [];
        for (let i = 0; i < this.sendBuffer.length; i++) {
            this.packet(this.sendBuffer[i]);
        }
        this.sendBuffer = [];
    }
    /**
     * Called upon server disconnect.
     *
     * @api private
     */
    ondisconnect() {
        debug("server disconnect (%s)", this.nsp);
        this.destroy();
        this.onclose("io server disconnect");
    }
    /**
     * Called upon forced client/server side disconnections,
     * this method ensures the manager stops tracking us and
     * that reconnections don't get triggered for this.
     *
     * @api private.
     */
    destroy() {
        if (this.subs) {
            // clean subscriptions to avoid reconnections
            for (let i = 0; i < this.subs.length; i++) {
                this.subs[i].destroy();
            }
            this.subs = null;
        }
        this.io.destroy(this);
    }
    /**
     * Disconnects the socket manually.
     *
     * @return {Socket} self
     * @api public
     */
    close() {
        if (this.connected) {
            debug("performing disconnect (%s)", this.nsp);
            this.packet({ type: socket_io_parser_1.PacketType.DISCONNECT });
        }
        // remove socket from pool
        this.destroy();
        if (this.connected) {
            // fire events
            this.onclose("io client disconnect");
        }
        return this;
    }
    disconnect() {
        if (this.connected) {
            debug("performing disconnect (%s)", this.nsp);
            this.packet({ type: socket_io_parser_1.PacketType.DISCONNECT });
        }
        // remove socket from pool
        this.destroy();
        if (this.connected) {
            // fire events
            this.onclose("io client disconnect");
        }
        return this;
    }
    /**
     * Sets the compress flag.
     *
     * @param {Boolean} if `true`, compresses the sending data
     * @return {Socket} self
     * @api public
     */
    compress(compress) {
        this.flags.compress = compress;
        return this;
    }
    /**
     * Sets the binary flag
     *
     * @param {Boolean} whether the emitted data contains binary
     * @return {Socket} self
     * @api public
     */
    binary(binary) {
        this.flags.binary = binary;
        return this;
    }
}
exports.Socket = Socket;
