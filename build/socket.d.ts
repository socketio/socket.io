import Emitter from "component-emitter";
import { Manager } from "./manager";
export declare class Socket extends Emitter {
    readonly io: Manager;
    id: string;
    connected: boolean;
    disconnected: boolean;
    private readonly nsp;
    private readonly auth;
    private ids;
    private acks;
    private receiveBuffer;
    private sendBuffer;
    private flags;
    private subs;
    /**
     * `Socket` constructor.
     *
     * @api public
     */
    constructor(io: any, nsp: any, opts: any);
    /**
     * Subscribe to open, close and packet events
     *
     * @api private
     */
    subEvents(): void;
    /**
     * "Opens" the socket.
     *
     * @api public
     */
    open(): this;
    connect(): this;
    /**
     * Sends a `message` event.
     *
     * @return {Socket} self
     * @api public
     */
    send(): this;
    /**
     * Override `emit`.
     * If the event is in `events`, it's emitted normally.
     *
     * @param {String} event name
     * @return {Socket} self
     * @api public
     */
    emit(ev: any): this;
    /**
     * Sends a packet.
     *
     * @param {Object} packet
     * @api private
     */
    packet(packet: any): void;
    /**
     * Called upon engine `open`.
     *
     * @api private
     */
    onopen(): void;
    /**
     * Called upon engine `close`.
     *
     * @param {String} reason
     * @api private
     */
    onclose(reason: any): void;
    /**
     * Called with socket packet.
     *
     * @param {Object} packet
     * @api private
     */
    onpacket(packet: any): void;
    /**
     * Called upon a server event.
     *
     * @param {Object} packet
     * @api private
     */
    onevent(packet: any): void;
    /**
     * Produces an ack callback to emit with an event.
     *
     * @api private
     */
    ack(id: any): () => void;
    /**
     * Called upon a server acknowlegement.
     *
     * @param {Object} packet
     * @api private
     */
    onack(packet: any): void;
    /**
     * Called upon server connect.
     *
     * @api private
     */
    onconnect(): void;
    /**
     * Emit buffered events (received and emitted).
     *
     * @api private
     */
    emitBuffered(): void;
    /**
     * Called upon server disconnect.
     *
     * @api private
     */
    ondisconnect(): void;
    /**
     * Called upon forced client/server side disconnections,
     * this method ensures the manager stops tracking us and
     * that reconnections don't get triggered for this.
     *
     * @api private.
     */
    destroy(): void;
    /**
     * Disconnects the socket manually.
     *
     * @return {Socket} self
     * @api public
     */
    close(): this;
    disconnect(): this;
    /**
     * Sets the compress flag.
     *
     * @param {Boolean} if `true`, compresses the sending data
     * @return {Socket} self
     * @api public
     */
    compress(compress: any): this;
    /**
     * Sets the binary flag
     *
     * @param {Boolean} whether the emitted data contains binary
     * @return {Socket} self
     * @api public
     */
    binary(binary: any): this;
}
