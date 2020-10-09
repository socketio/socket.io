/// <reference types="node" />
import { Socket } from "./socket";
import { Server } from "./index";
import { EventEmitter } from "events";
import { Adapter, Room, SocketId } from "socket.io-adapter";
export declare class Namespace extends EventEmitter {
    readonly name: string;
    readonly connected: Map<SocketId, Socket>;
    adapter: Adapter;
    /** @package */
    readonly server: any;
    /** @package */
    fns: Array<(socket: Socket, next: (err: Error) => void) => void>;
    /** @package */
    rooms: Set<Room>;
    /** @package */
    flags: any;
    /** @package */
    ids: number;
    /** @package */
    sockets: Map<SocketId, Socket>;
    /**
     * Namespace constructor.
     *
     * @param {Server} server instance
     * @param {string} name
     */
    constructor(server: Server, name: string);
    /**
     * Initializes the `Adapter` for this nsp.
     * Run upon changing adapter by `Server#adapter`
     * in addition to the constructor.
     *
     * @package
     */
    initAdapter(): void;
    /**
     * Sets up namespace middleware.
     *
     * @return {Namespace} self
     */
    use(fn: (socket: Socket, next: (err?: Error) => void) => void): Namespace;
    /**
     * Executes the middleware for an incoming client.
     *
     * @param {Socket} socket - the socket that will get added
     * @param {Function} fn - last fn call in the middleware
     */
    private run;
    /**
     * Targets a room when emitting.
     *
     * @param {String} name
     * @return {Namespace} self
     */
    to(name: Room): Namespace;
    /**
     * Targets a room when emitting.
     *
     * @param {String} name
     * @return {Namespace} self
     */
    in(name: Room): Namespace;
    /**
     * Adds a new client.
     *
     * @return {Socket}
     */
    private add;
    /**
     * Removes a client. Called by each `Socket`.
     *
     * @package
     */
    remove(socket: Socket): void;
    /**
     * Emits to all clients.
     *
     * @return {Namespace} self
     */
    emit(ev: string, ...args: any[]): Namespace;
    /**
     * Sends a `message` event to all clients.
     *
     * @return {Namespace} self
     */
    send(...args: any[]): Namespace;
    /**
     * Sends a `message` event to all clients.
     *
     * @return {Namespace} self
     */
    write(...args: any[]): Namespace;
    /**
     * Gets a list of clients.
     *
     * @return {Namespace} self
     */
    allSockets(): Promise<Set<SocketId>>;
    /**
     * Sets the compress flag.
     *
     * @param {Boolean} compress - if `true`, compresses the sending data
     * @return {Namespace} self
     */
    compress(compress: boolean): Namespace;
    /**
     * Sets the binary flag
     *
     * @param {Boolean} binary - encode as if it has binary data if `true`, Encode as if it doesnt have binary data if `false`
     * @return {Namespace} self
     */
    binary(binary: boolean): Namespace;
    /**
     * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
     * receive messages (because of network slowness or other issues, or because they’re connected through long polling
     * and is in the middle of a request-response cycle).
     *
     * @return {Namespace} self
     */
    get volatile(): Namespace;
    /**
     * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
     *
     * @return {Namespace} self
     */
    get local(): Namespace;
}
