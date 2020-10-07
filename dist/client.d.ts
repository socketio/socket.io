/// <reference types="node" />
import { IncomingMessage } from "http";
import { Server } from "./index";
import { Socket } from "./socket";
export declare class Client {
    readonly conn: any;
    /** @package */
    readonly id: string;
    private readonly server;
    private readonly encoder;
    private readonly decoder;
    private sockets;
    private nsps;
    /**
     * Client constructor.
     *
     * @param {Server} server instance
     * @param {Socket} conn
     * @package
     */
    constructor(server: Server, conn: any);
    /**
     * @return the reference to the request that originated the Engine.IO connection
     */
    get request(): IncomingMessage;
    /**
     * Sets up event listeners.
     */
    private setup;
    /**
     * Connects a client to a namespace.
     *
     * @param {String} name - the namespace
     * @param {Object} auth - the auth parameters
     * @package
     */
    connect(name: string, auth?: object): void;
    /**
     * Connects a client to a namespace.
     *
     * @param {String} name - the namespace
     * @param {Object} auth - the auth parameters
     */
    private doConnect;
    /**
     * Disconnects from all namespaces and closes transport.
     *
     * @package
     */
    disconnect(): void;
    /**
     * Removes a socket. Called by each `Socket`.
     *
     * @package
     */
    remove(socket: Socket): void;
    /**
     * Closes the underlying connection.
     */
    private close;
    /**
     * Writes a packet to the transport.
     *
     * @param {Object} packet object
     * @param {Object} opts
     * @package
     */
    packet(packet: any, opts?: any): void;
    /**
     * Called with incoming transport data.
     */
    private ondata;
    /**
     * Called when parser fully decodes a packet.
     */
    private ondecoded;
    /**
     * Handles an error.
     *
     * @param {Object} err object
     */
    private onerror;
    /**
     * Called upon transport close.
     *
     * @param reason
     */
    private onclose;
    /**
     * Cleans up event listeners.
     */
    private destroy;
}
