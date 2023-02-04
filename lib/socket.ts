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

type PrependTimeoutError<T extends any[]> = {
  [K in keyof T]: T[K] extends (...args: infer Params) => infer Result
    ? (err: Error, ...args: Params) => Result
    : T[K];
};

/**
 * Utility type to decorate the acknowledgement callbacks with a timeout error.
 *
 * This is needed because the timeout() flag breaks the symmetry between the sender and the receiver:
 *
 * @example
 * interface Events {
 *   "my-event": (val: string) => void;
 * }
 *
 * socket.on("my-event", (cb) => {
 *   cb("123"); // one single argument here
 * });
 *
 * socket.timeout(1000).emit("my-event", (err, val) => {
 *   // two arguments there (the "err" argument is not properly typed)
 * });
 *
 */
export type DecorateAcknowledgements<E> = {
  [K in keyof E]: E[K] extends (...args: infer Params) => infer Result
    ? (...args: PrependTimeoutError<Params>) => Result
    : E[K];
};

export type Last<T extends any[]> = T extends [...infer H, infer L] ? L : any;
export type AllButLast<T extends any[]> = T extends [...infer H, infer L]
  ? H
  : any[];
export type FirstArg<T> = T extends (arg: infer Param) => infer Result
  ? Param
  : any;

export interface SocketOptions {
  /**
   * the authentication payload sent when connecting to the Namespace
   */
  auth?: { [key: string]: any } | ((cb: (data: object) => void) => void);
  /**
   * The maximum number of retries. Above the limit, the packet will be discarded.
   *
   * Using `Infinity` means the delivery guarantee is "at-least-once" (instead of "at-most-once" by default), but a
   * smaller value like 10 should be sufficient in practice.
   */
  retries?: number;
  /**
   * The default timeout in milliseconds used when waiting for an acknowledgement.
   */
  ackTimeout?: number;
}

type QueuedPacket = {
  id: number;
  args: unknown[];
  flags: Flags;
  pending: boolean;
  tryCount: number;
};

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
  fromQueue?: boolean;
}

export type DisconnectDescription =
  | Error
  | {
      description: string;
      context?: unknown; // context should be typed as CloseEvent | XMLHttpRequest, but these types are not available on non-browser platforms
    };

interface SocketReservedEvents {
  connect: () => void;
  connect_error: (err: Error) => void;
  disconnect: (
    reason: Socket.DisconnectReason,
    description?: DisconnectDescription
  ) => void;
}

/**
 * A Socket is the fundamental class for interacting with the server.
 *
 * A Socket belongs to a certain Namespace (by default /) and uses an underlying {@link Manager} to communicate.
 *
 * @example
 * const socket = io();
 *
 * socket.on("connect", () => {
 *   console.log("connected");
 * });
 *
 * // send an event to the server
 * socket.emit("foo", "bar");
 *
 * socket.on("foobar", () => {
 *   // an event was received from the server
 * });
 *
 * // upon disconnection
 * socket.on("disconnect", (reason) => {
 *   console.log(`disconnected due to ${reason}`);
 * });
 */
export class Socket<
  ListenEvents extends EventsMap = DefaultEventsMap,
  EmitEvents extends EventsMap = ListenEvents
> extends Emitter<ListenEvents, EmitEvents, SocketReservedEvents> {
  public readonly io: Manager<ListenEvents, EmitEvents>;

  /**
   * A unique identifier for the session.
   *
   * @example
   * const socket = io();
   *
   * console.log(socket.id); // undefined
   *
   * socket.on("connect", () => {
   *   console.log(socket.id); // "G5p5..."
   * });
   */
  public id: string;

  /**
   * The session ID used for connection state recovery, which must not be shared (unlike {@link id}).
   *
   * @private
   */
  private _pid: string;

  /**
   * The offset of the last received packet, which will be sent upon reconnection to allow for the recovery of the connection state.
   *
   * @private
   */
  private _lastOffset: string;

  /**
   * Whether the socket is currently connected to the server.
   *
   * @example
   * const socket = io();
   *
   * socket.on("connect", () => {
   *   console.log(socket.connected); // true
   * });
   *
   * socket.on("disconnect", () => {
   *   console.log(socket.connected); // false
   * });
   */
  public connected: boolean = false;
  /**
   * Whether the connection state was recovered after a temporary disconnection. In that case, any missed packets will
   * be transmitted by the server.
   */
  public recovered: boolean = false;
  /**
   * Credentials that are sent when accessing a namespace.
   *
   * @example
   * const socket = io({
   *   auth: {
   *     token: "abcd"
   *   }
   * });
   *
   * // or with a function
   * const socket = io({
   *   auth: (cb) => {
   *     cb({ token: localStorage.token })
   *   }
   * });
   */
  public auth: { [key: string]: any } | ((cb: (data: object) => void) => void);
  /**
   * Buffer for packets received before the CONNECT packet
   */
  public receiveBuffer: Array<ReadonlyArray<any>> = [];
  /**
   * Buffer for packets that will be sent once the socket is connected
   */
  public sendBuffer: Array<Packet> = [];
  /**
   * The queue of packets to be sent with retry in case of failure.
   *
   * Packets are sent one by one, each waiting for the server acknowledgement, in order to guarantee the delivery order.
   * @private
   */
  private _queue: Array<QueuedPacket> = [];

  private readonly nsp: string;
  private readonly _opts: SocketOptions;

  private ids: number = 0;
  private acks: object = {};
  private flags: Flags = {};
  private subs?: Array<VoidFunction>;
  private _anyListeners: Array<(...args: any[]) => void>;
  private _anyOutgoingListeners: Array<(...args: any[]) => void>;

  /**
   * `Socket` constructor.
   */
  constructor(io: Manager, nsp: string, opts?: Partial<SocketOptions>) {
    super();
    this.io = io;
    this.nsp = nsp;
    if (opts && opts.auth) {
      this.auth = opts.auth;
    }
    this._opts = Object.assign({}, opts);
    if (this.io._autoConnect) this.open();
  }

  /**
   * Whether the socket is currently disconnected
   *
   * @example
   * const socket = io();
   *
   * socket.on("connect", () => {
   *   console.log(socket.disconnected); // false
   * });
   *
   * socket.on("disconnect", () => {
   *   console.log(socket.disconnected); // true
   * });
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
   * Whether the Socket will try to reconnect when its Manager connects or reconnects.
   *
   * @example
   * const socket = io();
   *
   * console.log(socket.active); // true
   *
   * socket.on("disconnect", (reason) => {
   *   if (reason === "io server disconnect") {
   *     // the disconnection was initiated by the server, you need to manually reconnect
   *     console.log(socket.active); // false
   *   }
   *   // else the socket will automatically try to reconnect
   *   console.log(socket.active); // true
   * });
   */
  public get active(): boolean {
    return !!this.subs;
  }

  /**
   * "Opens" the socket.
   *
   * @example
   * const socket = io({
   *   autoConnect: false
   * });
   *
   * socket.connect();
   */
  public connect(): this {
    if (this.connected) return this;

    this.subEvents();
    if (!this.io["_reconnecting"]) this.io.open(); // ensure open
    if ("open" === this.io._readyState) this.onopen();
    return this;
  }

  /**
   * Alias for {@link connect()}.
   */
  public open(): this {
    return this.connect();
  }

  /**
   * Sends a `message` event.
   *
   * This method mimics the WebSocket.send() method.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
   *
   * @example
   * socket.send("hello");
   *
   * // this is equivalent to
   * socket.emit("message", "hello");
   *
   * @return self
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
   * @example
   * socket.emit("hello", "world");
   *
   * // all serializable datastructures are supported (no need to call JSON.stringify)
   * socket.emit("hello", 1, "2", { 3: ["4"], 5: Uint8Array.from([6]) });
   *
   * // with an acknowledgement from the server
   * socket.emit("hello", "world", (val) => {
   *   // ...
   * });
   *
   * @return self
   */
  public emit<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: EventParams<EmitEvents, Ev>
  ): this {
    if (RESERVED_EVENTS.hasOwnProperty(ev)) {
      throw new Error('"' + ev.toString() + '" is a reserved event name');
    }

    args.unshift(ev);

    if (this._opts.retries && !this.flags.fromQueue && !this.flags.volatile) {
      this._addToQueue(args);
      return this;
    }

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
    const timeout = this.flags.timeout ?? this._opts.ackTimeout;
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
   * Emits an event and waits for an acknowledgement
   *
   * @example
   * // without timeout
   * const response = await socket.emitWithAck("hello", "world");
   *
   * // with a specific timeout
   * try {
   *   const response = await socket.timeout(1000).emitWithAck("hello", "world");
   * } catch (err) {
   *   // the server did not acknowledge the event in the given delay
   * }
   *
   * @return a Promise that will be fulfilled when the server acknowledges the event
   */
  public emitWithAck<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: AllButLast<EventParams<EmitEvents, Ev>>
  ): Promise<FirstArg<Last<EventParams<EmitEvents, Ev>>>> {
    // the timeout flag is optional
    const withErr =
      this.flags.timeout !== undefined || this._opts.ackTimeout !== undefined;
    return new Promise((resolve, reject) => {
      args.push((arg1, arg2) => {
        if (withErr) {
          return arg1 ? reject(arg1) : resolve(arg2);
        } else {
          return resolve(arg1);
        }
      });
      this.emit(ev, ...(args as any[] as EventParams<EmitEvents, Ev>));
    });
  }

  /**
   * Add the packet to the queue.
   * @param args
   * @private
   */
  private _addToQueue(args: unknown[]) {
    let ack;
    if (typeof args[args.length - 1] === "function") {
      ack = args.pop();
    }

    const packet = {
      id: this.ids++,
      tryCount: 0,
      pending: false,
      args,
      flags: Object.assign({ fromQueue: true }, this.flags),
    };

    args.push((err, ...responseArgs) => {
      if (packet !== this._queue[0]) {
        // the packet has already been acknowledged
        return;
      }
      const hasError = err !== null;
      if (hasError) {
        if (packet.tryCount > this._opts.retries) {
          debug(
            "packet [%d] is discarded after %d tries",
            packet.id,
            packet.tryCount
          );
          this._queue.shift();
          if (ack) {
            ack(err);
          }
        }
      } else {
        debug("packet [%d] was successfully sent", packet.id);
        this._queue.shift();
        if (ack) {
          ack(null, ...responseArgs);
        }
      }
      packet.pending = false;
      return this._drainQueue();
    });

    this._queue.push(packet);
    this._drainQueue();
  }

  /**
   * Send the first packet of the queue, and wait for an acknowledgement from the server.
   * @private
   */
  private _drainQueue() {
    debug("draining queue");
    if (this._queue.length === 0) {
      return;
    }
    const packet = this._queue[0];
    if (packet.pending) {
      debug(
        "packet [%d] has already been sent and is waiting for an ack",
        packet.id
      );
      return;
    }
    packet.pending = true;
    packet.tryCount++;
    debug("sending packet [%d] (try n°%d)", packet.id, packet.tryCount);
    const currentId = this.ids;
    this.ids = packet.id; // the same id is reused for consecutive retries, in order to allow deduplication on the server side
    this.flags = packet.flags;

    this.emit.apply(this, packet.args);
    this.ids = currentId; // restore offset
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
        this._sendConnectPacket(data as Record<string, unknown>);
      });
    } else {
      this._sendConnectPacket(this.auth);
    }
  }

  /**
   * Sends a CONNECT packet to initiate the Socket.IO session.
   *
   * @param data
   * @private
   */
  private _sendConnectPacket(data: Record<string, unknown>) {
    this.packet({
      type: PacketType.CONNECT,
      data: this._pid
        ? Object.assign({ pid: this._pid, offset: this._lastOffset }, data)
        : data,
    });
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
          this.onconnect(packet.data.sid, packet.data.pid);
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
    if (this._pid && args.length && typeof args[args.length - 1] === "string") {
      this._lastOffset = args[args.length - 1];
    }
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
  private onconnect(id: string, pid: string) {
    debug("socket connected with id %s", id);
    this.id = id;
    this.recovered = pid && this._pid === pid;
    this._pid = pid; // defined only if connection state recovery is enabled
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
   * Disconnects the socket manually. In that case, the socket will not try to reconnect.
   *
   * If this is the last active Socket instance of the {@link Manager}, the low-level connection will be closed.
   *
   * @example
   * const socket = io();
   *
   * socket.on("disconnect", (reason) => {
   *   // console.log(reason); prints "io client disconnect"
   * });
   *
   * socket.disconnect();
   *
   * @return self
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
   * Alias for {@link disconnect()}.
   *
   * @return self
   */
  public close(): this {
    return this.disconnect();
  }

  /**
   * Sets the compress flag.
   *
   * @example
   * socket.compress(false).emit("hello");
   *
   * @param compress - if `true`, compresses the sending data
   * @return self
   */
  public compress(compress: boolean): this {
    this.flags.compress = compress;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event message will be dropped when this socket is not
   * ready to send messages.
   *
   * @example
   * socket.volatile.emit("hello"); // the server may or may not receive it
   *
   * @returns self
   */
  public get volatile(): this {
    this.flags.volatile = true;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
   * given number of milliseconds have elapsed without an acknowledgement from the server:
   *
   * @example
   * socket.timeout(5000).emit("my-event", (err) => {
   *   if (err) {
   *     // the server did not acknowledge the event in the given delay
   *   }
   * });
   *
   * @returns self
   */
  public timeout(
    timeout: number
  ): Socket<ListenEvents, DecorateAcknowledgements<EmitEvents>> {
    this.flags.timeout = timeout;
    return this;
  }

  /**
   * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
   * callback.
   *
   * @example
   * socket.onAny((event, ...args) => {
   *   console.log(`got ${event}`);
   * });
   *
   * @param listener
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
   * @example
   * socket.prependAny((event, ...args) => {
   *   console.log(`got event ${event}`);
   * });
   *
   * @param listener
   */
  public prependAny(listener: (...args: any[]) => void): this {
    this._anyListeners = this._anyListeners || [];
    this._anyListeners.unshift(listener);
    return this;
  }

  /**
   * Removes the listener that will be fired when any event is emitted.
   *
   * @example
   * const catchAllListener = (event, ...args) => {
   *   console.log(`got event ${event}`);
   * }
   *
   * socket.onAny(catchAllListener);
   *
   * // remove a specific listener
   * socket.offAny(catchAllListener);
   *
   * // or remove all listeners
   * socket.offAny();
   *
   * @param listener
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
   */
  public listenersAny() {
    return this._anyListeners || [];
  }

  /**
   * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
   * callback.
   *
   * Note: acknowledgements sent to the server are not included.
   *
   * @example
   * socket.onAnyOutgoing((event, ...args) => {
   *   console.log(`sent event ${event}`);
   * });
   *
   * @param listener
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
   * Note: acknowledgements sent to the server are not included.
   *
   * @example
   * socket.prependAnyOutgoing((event, ...args) => {
   *   console.log(`sent event ${event}`);
   * });
   *
   * @param listener
   */
  public prependAnyOutgoing(listener: (...args: any[]) => void): this {
    this._anyOutgoingListeners = this._anyOutgoingListeners || [];
    this._anyOutgoingListeners.unshift(listener);
    return this;
  }

  /**
   * Removes the listener that will be fired when any event is emitted.
   *
   * @example
   * const catchAllListener = (event, ...args) => {
   *   console.log(`sent event ${event}`);
   * }
   *
   * socket.onAnyOutgoing(catchAllListener);
   *
   * // remove a specific listener
   * socket.offAnyOutgoing(catchAllListener);
   *
   * // or remove all listeners
   * socket.offAnyOutgoing();
   *
   * @param [listener] - the catch-all listener (optional)
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
    | "transport error"
    | "parse error";
}
