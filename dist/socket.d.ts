/// <reference types="node" />
import { EventEmitter } from "events";
import { Client, Namespace } from "./index";
import { IncomingMessage } from "http";
import { Room, SocketId } from "socket.io-adapter";
/**
 * The handshake details
 */
export interface Handshake {
    /**
     * The headers sent as part of the handshake
     */
    headers: object;
    /**
     * The date of creation (as string)
     */
    time: string;
    /**
     * The ip of the client
     */
    address: string;
    /**
     * Whether the connection is cross-domain
     */
    xdomain: boolean;
    /**
     * Whether the connection is secure
     */
    secure: boolean;
    /**
     * The date of creation (as unix timestamp)
     */
    issued: number;
    /**
     * The request URL string
     */
    url: string;
    /**
     * The query object
     */
    query: object;
    /**
     * The auth object
     */
    auth: object;
}
export declare class Socket extends EventEmitter {
    readonly nsp: Namespace;
    readonly client: Client;
    readonly id: SocketId;
    readonly handshake: Handshake;
    connected: boolean;
    disconnected: boolean;
    private readonly server;
    private readonly adapter;
    private acks;
    private fns;
    private flags;
    private _rooms;
    /**
     * Interface to a `Client` for a given `Namespace`.
     *
     * @param {Namespace} nsp
     * @param {Client} client
     * @param {Object} auth
     * @package
     */
    constructor(nsp: Namespace, client: Client, auth: object);
    /**
     * Builds the `handshake` BC object
     */
    private buildHandshake;
    /**
     * Emits to this client.
     *
     * @return {Socket} self
     */
    emit(ev: any): this;
    /**
     * Targets a room when broadcasting.
     *
     * @param {String} name
     * @return {Socket} self
     */
    to(name: Room): this;
    /**
     * Targets a room when broadcasting.
     *
     * @param {String} name
     * @return {Socket} self
     */
    in(name: Room): Socket;
    /**
     * Sends a `message` event.
     *
     * @return {Socket} self
     */
    send(...args: any[]): Socket;
    /**
     * Sends a `message` event.
     *
     * @return {Socket} self
     */
    write(...args: any[]): Socket;
    /**
     * Writes a packet.
     *
     * @param {Object} packet - packet object
     * @param {Object} opts - options
     */
    private packet;
    /**
     * Joins a room.
     *
     * @param {String|Array} rooms - room or array of rooms
     * @param {Function} fn - optional, callback
     * @return {Socket} self
     */
    join(rooms: Room | Array<Room>, fn?: (err: Error) => void): Socket;
    /**
     * Leaves a room.
     *
     * @param {String} room
     * @param {Function} fn - optional, callback
     * @return {Socket} self
     */
    leave(room: string, fn?: (err: Error) => void): Socket;
    /**
     * Leave all rooms.
     */
    private leaveAll;
    /**
     * Called by `Namespace` upon successful
     * middleware execution (ie: authorization).
     * Socket is added to namespace array before
     * call to join, so adapters can access it.
     *
     * @package
     */
    onconnect(): void;
    /**
     * Called with each packet. Called by `Client`.
     *
     * @param {Object} packet
     * @package
     */
    onpacket(packet: any): void;
    /**
     * Called upon event packet.
     *
     * @param {Object} packet - packet object
     */
    private onevent;
    /**
     * Produces an ack callback to emit with an event.
     *
     * @param {Number} id - packet id
     */
    private ack;
    /**
     * Called upon ack packet.
     */
    private onack;
    /**
     * Called upon client disconnect packet.
     */
    private ondisconnect;
    /**
     * Handles a client error.
     *
     * @package
     */
    onerror(err: any): void;
    /**
     * Called upon closing. Called by `Client`.
     *
     * @param {String} reason
     * @throw {Error} optional error object
     *
     * @package
     */
    onclose(reason: string): this;
    /**
     * Produces an `error` packet.
     *
     * @param {Object} err - error object
     *
     * @package
     */
    error(err: any): void;
    /**
     * Disconnects this client.
     *
     * @param {Boolean} close - if `true`, closes the underlying connection
     * @return {Socket} self
     */
    disconnect(close?: boolean): Socket;
    /**
     * Sets the compress flag.
     *
     * @param {Boolean} compress - if `true`, compresses the sending data
     * @return {Socket} self
     */
    compress(compress: boolean): Socket;
    /**
     * Sets the binary flag
     *
     * @param {Boolean} binary - encode as if it has binary data if `true`, Encode as if it doesnt have binary data if `false`
     * @return {Socket} self
     */
    binary(binary: boolean): Socket;
    /**
     * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
     * receive messages (because of network slowness or other issues, or because they’re connected through long polling
     * and is in the middle of a request-response cycle).
     *
     * @return {Socket} self
     */
    get volatile(): Socket;
    /**
     * Sets a modifier for a subsequent event emission that the event data will only be broadcast to every sockets but the
     * sender.
     *
     * @return {Socket} self
     */
    get broadcast(): Socket;
    /**
     * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
     *
     * @return {Socket} self
     */
    get local(): Socket;
    /**
     * Dispatch incoming event to socket listeners.
     *
     * @param {Array} event - event that will get emitted
     */
    private dispatch;
    /**
     * Sets up socket middleware.
     *
     * @param {Function} fn - middleware function (event, next)
     * @return {Socket} self
     */
    use(fn: (event: Array<any>, next: (err: Error) => void) => void): Socket;
    /**
     * Executes the middleware for an incoming event.
     *
     * @param {Array} event - event that will get emitted
     * @param {Function} fn - last fn call in the middleware
     */
    private run;
    get request(): IncomingMessage;
    get conn(): any;
    get rooms(): Set<Room>;
}
