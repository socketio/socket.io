import { Packet, PacketType } from "socket.io-parser";
import { on } from "./on.js";
import { Manager } from "./manager.js";
import {
  DefaultEventsMap,
  EventNames,
  EventParams,
  EventsMap,
  Emitter,
} from "@socket.io/component-emitter";
import debugModule from "debug"; // debug()

const debug = debugModule("socket.io-client:socket"); // debug()

export interface SocketOptions {
  /**
   * the authentication payload sent when connecting to the Namespace
   */
  auth: { [key: string]: any } | ((cb: (data: object) => void) => void);
}

/**
 * Internal events.
 * These events can't be emitted by the user.
 */
const RESERVED_EVENTS = Object.freeze({
  connect: 1,
  connect_error: 1,
  disconnect: 1,
  disconnecting: 1,
  // EventEmitter reserved events: https://nodejs.org/api/events.html#events_event_newlistener
  newListener: 1,
  removeListener: 1,
});

interface Flags {
  compress?: boolean;
  volatile?: boolean;
  timeout?: number;
}

export type DisconnectDescription =
  | Error
  | {
      description: string;
      context?: CloseEvent | XMLHttpRequest;
    };

interface SocketReservedEvents {
  connect: () => void;
  connect_error: (err: Error) => void;
  disconnect: (
    reason: Socket.DisconnectReason,
    description?: DisconnectDescription
  ) => void;
}

export class Socket<
  ListenEvents extends EventsMap = DefaultEventsMap,
  EmitEvents extends EventsMap = ListenEvents
> extends Emitter<ListenEvents, EmitEvents, SocketReservedEvents> {
  public readonly io: Manager<ListenEvents, EmitEvents>;

  public id: string;
  public connected: boolean = false;

  public auth: { [key: string]: any } | ((cb: (data: object) => void) => void);
  public receiveBuffer: Array<ReadonlyArray<any>> = [];
  public sendBuffer: Array<Packet> = [];

  private readonly nsp: string;

  private ids: number = 0;
  private acks: object = {};
  private flags: Flags = {};
  private subs?: Array<VoidFunction>;
  private _anyListeners: Array<(...args: any[]) => void>;
  private _anyOutgoingListeners: Array<(...args: any[]) => void>;

  /**
   * `Socket` constructor.
   *
   * @public
   */
  constructor(io: Manager, nsp: string, opts?: Partial<SocketOptions>) {
    super();
    this.io = io;
    this.nsp = nsp;
    if (opts && opts.auth) {
      this.auth = opts.auth;
    }
    if (this.io._autoConnect) this.open();
  }

  /**
   * Whether the socket is currently disconnected
   */
  public get disconnected(): boolean {
    return !this.connected;
  }

  /**
   * Subscribe to open, close and packet events
   *
   * @private
   */
  private subEvents(): void {
    if (this.subs) return;

    const io = this.io;
    this.subs = [
      on(io, "open", this.onopen.bind(this)),
      on(io, "packet", this.onpacket.bind(this)),
      on(io, "error", this.onerror.bind(this)),
      on(io, "close", this.onclose.bind(this)),
    ];
  }

  /**
   * Whether the Socket will try to reconnect when its Manager connects or reconnects
   */
  public get active(): boolean {
    return !!this.subs;
  }

  /**
   * "Opens" the socket.
   *
   * @public
   */
  public connect(): this {
    if (this.connected) return this;

    this.subEvents();
    if (!this.io["_reconnecting"]) this.io.open(); // ensure open
    if ("open" === this.io._readyState) this.onopen();
    return this;
  }

  /**
   * Alias for connect()
   */
  public open(): this {
    return this.connect();
  }

  /**
   * Sends a `message` event.
   *
   * @return self
   * @public
   */
  public send(...args: any[]): this {
    args.unshift("message");
    this.emit.apply(this, args);
    return this;
  }

  /**
   * Override `emit`.
   * If the event is in `events`, it's emitted normally.
   *
   * @return self
   * @public
   */
  public emit<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: EventParams<EmitEvents, Ev>
  ): this {
    if (RESERVED_EVENTS.hasOwnProperty(ev)) {
      throw new Error('"' + ev + '" is a reserved event name');
    }

    args.unshift(ev);
    const packet: any = {
      type: PacketType.EVENT,
      data: args,
    };

    packet.options = {};
    packet.options.compress = this.flags.compress !== false;

    // event ack callback
    if ("function" === typeof args[args.length - 1]) {
      const id = this.ids++;
      debug("emitting packet with ack id %d", id);

      const ack = args.pop() as Function;
      this._registerAckCallback(id, ack);
      packet.id = id;
    }

    const isTransportWritable =
      this.io.engine &&
      this.io.engine.transport &&
      this.io.engine.transport.writable;

    const discardPacket =
      this.flags.volatile && (!isTransportWritable || !this.connected);
    if (discardPacket) {
      debug("discard packet as the transport is not currently writable");
    } else if (this.connected) {
      this.notifyOutgoingListeners(packet);
      this.packet(packet);
    } else {
      this.sendBuffer.push(packet);
    }

    this.flags = {};

    return this;
  }

  /**
   * @private
   */
  private _registerAckCallback(id: number, ack: Function) {
    const timeout = this.flags.timeout;
    if (timeout === undefined) {
      this.acks[id] = ack;
      return;
    }

    // @ts-ignore
    const timer = this.io.setTimeoutFn(() => {
      delete this.acks[id];
      for (let i = 0; i < this.sendBuffer.length; i++) {
        if (this.sendBuffer[i].id === id) {
          debug("removing packet with ack id %d from the buffer", id);
          this.sendBuffer.splice(i, 1);
        }
      }
      debug("event with ack id %d has timed out after %d ms", id, timeout);
      ack.call(this, new Error("operation has timed out"));
    }, timeout);

    this.acks[id] = (...args) => {
      // @ts-ignore
      this.io.clearTimeoutFn(timer);
      ack.apply(this, [null, ...args]);
    };
  }

  /**
   * Sends a packet.
   *
   * @param packet
   * @private
   */
  private packet(packet: Partial<Packet>): void {
    packet.nsp = this.nsp;
    this.io._packet(packet);
  }

  /**
   * Called upon engine `open`.
   *
   * @private
   */
  private onopen(): void {
    debug("transport is open - connecting");
    if (typeof this.auth == "function") {
      this.auth((data) => {
        this.packet({ type: PacketType.CONNECT, data });
      });
    } else {
      this.packet({ type: PacketType.CONNECT, data: this.auth });
    }
  }

  /**
   * Called upon engine or manager `error`.
   *
   * @param err
   * @private
   */
  private onerror(err: Error): void {
    if (!this.connected) {
      this.emitReserved("connect_error", err);
    }
  }

  /**
   * Called upon engine `close`.
   *
   * @param reason
   * @param description
   * @private
   */
  private onclose(
    reason: Socket.DisconnectReason,
    description?: DisconnectDescription
  ): void {
    debug("close (%s)", reason);
    this.connected = false;
    delete this.id;
    this.emitReserved("disconnect", reason, description);
  }

  /**
   * Called with socket packet.
   *
   * @param packet
   * @private
   */
  private onpacket(packet: Packet): void {
    const sameNamespace = packet.nsp === this.nsp;

    if (!sameNamespace) return;

    switch (packet.type) {
      case PacketType.CONNECT:
        if (packet.data && packet.data.sid) {
          const id = packet.data.sid;
          this.onconnect(id);
        } else {
          this.emitReserved(
            "connect_error",
            new Error(
              "It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"
            )
          );
        }
        break;

      case PacketType.EVENT:
      case PacketType.BINARY_EVENT:
        this.onevent(packet);
        break;

      case PacketType.ACK:
      case PacketType.BINARY_ACK:
        this.onack(packet);
        break;

      case PacketType.DISCONNECT:
        this.ondisconnect();
        break;

      case PacketType.CONNECT_ERROR:
        this.destroy();
        const err = new Error(packet.data.message);
        // @ts-ignore
        err.data = packet.data.data;
        this.emitReserved("connect_error", err);
        break;
    }
  }

  /**
   * Called upon a server event.
   *
   * @param packet
   * @private
   */
  private onevent(packet: Packet): void {
    const args: Array<any> = packet.data || [];
    debug("emitting event %j", args);

    if (null != packet.id) {
      debug("attaching ack callback to event");
      args.push(this.ack(packet.id));
    }

    if (this.connected) {
      this.emitEvent(args);
    } else {
      this.receiveBuffer.push(Object.freeze(args));
    }
  }

  private emitEvent(args: ReadonlyArray<any>): void {
    if (this._anyListeners && this._anyListeners.length) {
      const listeners = this._anyListeners.slice();
      for (const listener of listeners) {
        listener.apply(this, args);
      }
    }
    super.emit.apply(this, args);
  }

  /**
   * Produces an ack callback to emit with an event.
   *
   * @private
   */
  private ack(id: number): (...args: any[]) => void {
    const self = this;
    let sent = false;
    return function (...args: any[]) {
      // prevent double callbacks
      if (sent) return;
      sent = true;
      debug("sending ack %j", args);

      self.packet({
        type: PacketType.ACK,
        id: id,
        data: args,
      });
    };
  }

  /**
   * Called upon a server acknowlegement.
   *
   * @param packet
   * @private
   */
  private onack(packet: Packet): void {
    const ack = this.acks[packet.id];
    if ("function" === typeof ack) {
      debug("calling ack %s with %j", packet.id, packet.data);
      ack.apply(this, packet.data);
      delete this.acks[packet.id];
    } else {
      debug("bad ack %s", packet.id);
    }
  }

  /**
   * Called upon server connect.
   *
   * @private
   */
  private onconnect(id: string): void {
    debug("socket connected with id %s", id);
    this.id = id;
    this.connected = true;
    this.emitBuffered();
    this.emitReserved("connect");
  }

  /**
   * Emit buffered events (received and emitted).
   *
   * @private
   */
  private emitBuffered(): void {
    this.receiveBuffer.forEach((args) => this.emitEvent(args));
    this.receiveBuffer = [];

    this.sendBuffer.forEach((packet) => {
      this.notifyOutgoingListeners(packet);
      this.packet(packet);
    });
    this.sendBuffer = [];
  }

  /**
   * Called upon server disconnect.
   *
   * @private
   */
  private ondisconnect(): void {
    debug("server disconnect (%s)", this.nsp);
    this.destroy();
    this.onclose("io server disconnect");
  }

  /**
   * Called upon forced client/server side disconnections,
   * this method ensures the manager stops tracking us and
   * that reconnections don't get triggered for this.
   *
   * @private
   */
  private destroy(): void {
    if (this.subs) {
      // clean subscriptions to avoid reconnections
      this.subs.forEach((subDestroy) => subDestroy());
      this.subs = undefined;
    }
    this.io["_destroy"](this);
  }

  /**
   * Disconnects the socket manually.
   *
   * @return self
   * @public
   */
  public disconnect(): this {
    if (this.connected) {
      debug("performing disconnect (%s)", this.nsp);
      this.packet({ type: PacketType.DISCONNECT });
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
   * Alias for disconnect()
   *
   * @return self
   * @public
   */
  public close(): this {
    return this.disconnect();
  }

  /**
   * Sets the compress flag.
   *
   * @param compress - if `true`, compresses the sending data
   * @return self
   * @public
   */
  public compress(compress: boolean): this {
    this.flags.compress = compress;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event message will be dropped when this socket is not
   * ready to send messages.
   *
   * @returns self
   * @public
   */
  public get volatile(): this {
    this.flags.volatile = true;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
   * given number of milliseconds have elapsed without an acknowledgement from the server:
   *
   * ```
   * socket.timeout(5000).emit("my-event", (err) => {
   *   if (err) {
   *     // the server did not acknowledge the event in the given delay
   *   }
   * });
   * ```
   *
   * @returns self
   * @public
   */
  public timeout(timeout: number): this {
    this.flags.timeout = timeout;
    return this;
  }

  /**
   * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
   * callback.
   *
   * @param listener
   * @public
   */
  public onAny(listener: (...args: any[]) => void): this {
    this._anyListeners = this._anyListeners || [];
    this._anyListeners.push(listener);
    return this;
  }

  /**
   * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
   * callback. The listener is added to the beginning of the listeners array.
   *
   * @param listener
   * @public
   */
  public prependAny(listener: (...args: any[]) => void): this {
    this._anyListeners = this._anyListeners || [];
    this._anyListeners.unshift(listener);
    return this;
  }

  /**
   * Removes the listener that will be fired when any event is emitted.
   *
   * @param listener
   * @public
   */
  public offAny(listener?: (...args: any[]) => void): this {
    if (!this._anyListeners) {
      return this;
    }
    if (listener) {
      const listeners = this._anyListeners;
      for (let i = 0; i < listeners.length; i++) {
        if (listener === listeners[i]) {
          listeners.splice(i, 1);
          return this;
        }
      }
    } else {
      this._anyListeners = [];
    }
    return this;
  }

  /**
   * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
   * e.g. to remove listeners.
   *
   * @public
   */
  public listenersAny() {
    return this._anyListeners || [];
  }

  /**
   * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
   * callback.
   *
   * @param listener
   *
   * <pre><code>
   *
   * socket.onAnyOutgoing((event, ...args) => {
   *   console.log(event);
   * });
   *
   * </pre></code>
   *
   * @public
   */
  public onAnyOutgoing(listener: (...args: any[]) => void): this {
    this._anyOutgoingListeners = this._anyOutgoingListeners || [];
    this._anyOutgoingListeners.push(listener);
    return this;
  }

  /**
   * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
   * callback. The listener is added to the beginning of the listeners array.
   *
   * @param listener
   *
   * <pre><code>
   *
   * socket.prependAnyOutgoing((event, ...args) => {
   *   console.log(event);
   * });
   *
   * </pre></code>
   *
   * @public
   */
  public prependAnyOutgoing(listener: (...args: any[]) => void): this {
    this._anyOutgoingListeners = this._anyOutgoingListeners || [];
    this._anyOutgoingListeners.unshift(listener);
    return this;
  }

  /**
   * Removes the listener that will be fired when any event is emitted.
   *
   * @param listener
   *
   * <pre><code>
   *
   * const handler = (event, ...args) => {
   *   console.log(event);
   * }
   *
   * socket.onAnyOutgoing(handler);
   *
   * // then later
   * socket.offAnyOutgoing(handler);
   *
   * </pre></code>
   *
   * @public
   */
  public offAnyOutgoing(listener?: (...args: any[]) => void): this {
    if (!this._anyOutgoingListeners) {
      return this;
    }
    if (listener) {
      const listeners = this._anyOutgoingListeners;
      for (let i = 0; i < listeners.length; i++) {
        if (listener === listeners[i]) {
          listeners.splice(i, 1);
          return this;
        }
      }
    } else {
      this._anyOutgoingListeners = [];
    }
    return this;
  }

  /**
   * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
   * e.g. to remove listeners.
   *
   * @public
   */
  public listenersAnyOutgoing() {
    return this._anyOutgoingListeners || [];
  }

  /**
   * Notify the listeners for each packet sent
   *
   * @param packet
   *
   * @private
   */
  private notifyOutgoingListeners(packet: Packet) {
    if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
      const listeners = this._anyOutgoingListeners.slice();
      for (const listener of listeners) {
        listener.apply(this, packet.data);
      }
    }
  }
}

export namespace Socket {
  export type DisconnectReason =
    | "io server disconnect"
    | "io client disconnect"
    | "ping timeout"
    | "transport close"
    | "transport error";
}
