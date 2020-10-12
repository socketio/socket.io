import Emitter from "component-emitter";
export declare class Manager extends Emitter {
    autoConnect: boolean;
    readyState: "opening" | "open" | "closed";
    reconnecting: boolean;
    private readonly uri;
    private readonly opts;
    private nsps;
    private subs;
    private backoff;
    private _reconnection;
    private _reconnectionAttempts;
    private _reconnectionDelay;
    private _randomizationFactor;
    private _reconnectionDelayMax;
    private _timeout;
    private connecting;
    private encoder;
    private decoder;
    private engine;
    private skipReconnect;
    /**
     * `Manager` constructor.
     *
     * @param {String} engine instance or engine uri/opts
     * @param {Object} options
     * @api public
     */
    constructor(uri: any, opts: any);
    /**
     * Propagate given event to sockets and emit on `this`
     *
     * @api private
     */
    emitAll(event: string, arg?: any): void;
    /**
     * Sets the `reconnection` config.
     *
     * @param {Boolean} true/false if it should automatically reconnect
     * @return {Manager} self or value
     * @api public
     */
    reconnection(v?: any): boolean | this;
    /**
     * Sets the reconnection attempts config.
     *
     * @param {Number} max reconnection attempts before giving up
     * @return {Manager} self or value
     * @api public
     */
    reconnectionAttempts(v?: any): number | this;
    /**
     * Sets the delay between reconnections.
     *
     * @param {Number} delay
     * @return {Manager} self or value
     * @api public
     */
    reconnectionDelay(v?: any): number | this;
    randomizationFactor(v?: any): number | this;
    /**
     * Sets the maximum delay between reconnections.
     *
     * @param {Number} delay
     * @return {Manager} self or value
     * @api public
     */
    reconnectionDelayMax(v?: any): number | this;
    /**
     * Sets the connection timeout. `false` to disable
     *
     * @return {Manager} self or value
     * @api public
     */
    timeout(v?: any): any;
    /**
     * Starts trying to reconnect if reconnection is enabled and we have not
     * started reconnecting yet
     *
     * @api private
     */
    maybeReconnectOnOpen(): void;
    /**
     * Sets the current transport `socket`.
     *
     * @param {Function} optional, callback
     * @return {Manager} self
     * @api public
     */
    open(fn?: any, opts?: any): this;
    connect(fn: any, opts: any): this;
    /**
     * Called upon transport open.
     *
     * @api private
     */
    onopen(): void;
    /**
     * Called upon a ping.
     *
     * @api private
     */
    onping(): void;
    /**
     * Called with data.
     *
     * @api private
     */
    ondata(data: any): void;
    /**
     * Called when parser fully decodes a packet.
     *
     * @api private
     */
    ondecoded(packet: any): void;
    /**
     * Called upon socket error.
     *
     * @api private
     */
    onerror(err: any): void;
    /**
     * Creates a new socket for the given `nsp`.
     *
     * @return {Socket}
     * @api public
     */
    socket(nsp: any, opts: any): any;
    /**
     * Called upon a socket close.
     *
     * @param {Socket} socket
     */
    destroy(socket: any): void;
    /**
     * Writes a packet.
     *
     * @param {Object} packet
     * @api private
     */
    packet(packet: any): void;
    /**
     * Clean up transport subscriptions and packet buffer.
     *
     * @api private
     */
    cleanup(): void;
    /**
     * Close the current socket.
     *
     * @api private
     */
    close(): void;
    disconnect(): void;
    /**
     * Called upon engine close.
     *
     * @api private
     */
    onclose(reason: any): void;
    /**
     * Attempt a reconnection.
     *
     * @api private
     */
    reconnect(): this;
    /**
     * Called upon successful reconnect.
     *
     * @api private
     */
    onreconnect(): void;
}
