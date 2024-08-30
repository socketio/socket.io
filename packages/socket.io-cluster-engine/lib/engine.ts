import { Server, type ServerOptions, Socket, type Transport } from "engine.io";
import { randomBytes } from "node:crypto";
import { setTimeout, clearTimeout } from "node:timers";
import { type IncomingMessage } from "node:http";
import { type Packet } from "engine.io-parser";
import debugModule from "debug";

const debug = debugModule("engine");

const kDelayed = Symbol("delayed");
const kDelayedTimer = Symbol("delayedTimer");
const kBuffer = Symbol("buffer");
const kPacketListener = Symbol("packetListener");
const kNoopTimer = Symbol("noopTimer");
const kSenderId = Symbol("senderId");

type Brand<K, T> = K & { __brand: T };

type NodeId = Brand<string, "NodeId">;
type SessionId = Brand<string, "SessionId">;
type RequestId = Brand<number, "RequestId">;

function randomId() {
  return randomBytes(3).toString("hex");
}

enum MessageType {
  ACQUIRE_LOCK = 0,
  ACQUIRE_LOCK_RESPONSE,
  DRAIN,
  PACKET,
  UPGRADE,
  UPGRADE_RESPONSE,
  CLOSE,
}

export type Message = {
  senderId: NodeId;
} & (
  | {
      requestId: RequestId;
      type: MessageType.ACQUIRE_LOCK;
      data: {
        sid: SessionId;
        transportName: string;
        type: "read" | "write";
      };
    }
  | {
      recipientId: NodeId;
      requestId: RequestId;
      type: MessageType.ACQUIRE_LOCK_RESPONSE;
      data: {
        success: boolean;
      };
    }
  | {
      recipientId: NodeId;
      type: MessageType.DRAIN;
      data: {
        sid: SessionId;
        packets: Packet[];
      };
    }
  | {
      recipientId: NodeId;
      type: MessageType.PACKET;
      data: {
        sid: SessionId;
        packet: Packet;
      };
    }
  | {
      requestId: RequestId;
      recipientId: NodeId;
      type: MessageType.UPGRADE;
      data: {
        sid: SessionId;
        success: boolean;
      };
    }
  | {
      requestId: RequestId;
      recipientId: NodeId;
      type: MessageType.UPGRADE_RESPONSE;
      data: {
        takeOver: boolean;
        packets: Packet[];
      };
    }
  | {
      recipientId: NodeId;
      type: MessageType.CLOSE;
      data: {
        sid: SessionId;
        reason: string;
      };
    }
);

type ClusterRequest = {
  timer: NodeJS.Timer;
  onSuccess: (...args: any[]) => void;
  onError: () => void;
};

function isClientLockable(
  client: Socket,
  transportName: string,
  lockType: "read" | "write"
) {
  switch (transportName) {
    case "polling":
      return (
        client.transport.name === "polling" &&
        (lockType === "write" || !client.transport.writable)
      );
    case "websocket":
    case "webtransport":
      return (
        client.transport.name === "polling" &&
        !client.upgrading &&
        !client.upgraded
      );
  }
}

function isValidSessionId(str: string) {
  return typeof str === "string" && str.length === 20;
}

interface ClusterEngineOptions {
  /**
   * The maximum waiting time for responses from other nodes, in ms.
   *
   * @default 1000
   */
  responseTimeout?: number;
  /**
   * The delay between two "noop" packets when the client upgrades, in ms.
   *
   * @default 200
   */
  noopUpgradeInterval?: number;
  /**
   * The maximum waiting time for a successful upgrade, in ms.
   *
   * @default 300
   */
  delayedConnectionTimeout?: number;
}

// @ts-expect-error onWebSocket() method is private in parent class
export abstract class ClusterEngine extends Server {
  private readonly _opts: Required<ClusterEngineOptions>;
  protected readonly _nodeId = randomId() as NodeId;
  private readonly _requests = new Map<RequestId, ClusterRequest>();
  private readonly _remoteTransports = new Map<SessionId, Transport>();
  private _requestCount = 0;

  constructor(opts?: ServerOptions & ClusterEngineOptions) {
    super(opts);
    this._opts = Object.assign(
      {
        responseTimeout: 1000,
        noopUpgradeInterval: 200,
        delayedConnectionTimeout: 300,
      },
      opts
    );
  }

  protected onMessage(message: Message) {
    if (message.senderId === this._nodeId) {
      return;
    }
    debug("received: %j", message);

    switch (message.type) {
      case MessageType.ACQUIRE_LOCK: {
        const sid = message.data.sid;
        const client = this.clients[sid];
        if (!client) {
          return;
        }

        const transportName = message.data.transportName;
        const success = isClientLockable(
          client,
          transportName,
          message.data.type
        );

        this.publishMessage({
          requestId: message.requestId,
          senderId: this._nodeId,
          recipientId: message.senderId,
          type: MessageType.ACQUIRE_LOCK_RESPONSE,
          data: {
            success,
          },
        });

        switch (transportName) {
          case "polling": {
            if (message.data.type === "read") {
              this._forwardFlushWhenPolling(client, sid, message.senderId);
            }
            break;
          }
          case "websocket":
          case "webtransport": {
            client.upgrading = true;
            client[kNoopTimer] = setTimeout(() => {
              debug("writing a noop packet to polling for fast upgrade");
              // @ts-expect-error sendPacket() is private
              client.sendPacket("noop");
            }, this._opts.noopUpgradeInterval);
          }
        }
        break;
      }

      case MessageType.ACQUIRE_LOCK_RESPONSE: {
        const requestId = message.requestId;
        const request = this._requests.get(requestId);
        if (!request) {
          return;
        }
        this._requests.delete(requestId);
        clearTimeout(request.timer);
        if (message.data.success) {
          request.onSuccess(message.senderId);
        } else {
          request.onError();
        }
        break;
      }

      case MessageType.DRAIN: {
        const transport = this._remoteTransports.get(message.data.sid);
        if (!transport) {
          return;
        }
        if (transport.name === "polling") {
          // HTTP long-polling can only be drained once
          this._remoteTransports.delete(message.data.sid);
        }
        transport.send(message.data.packets);
        break;
      }

      case MessageType.PACKET: {
        const client = this.clients[message.data.sid];
        if (!client) {
          return;
        }
        if (client[kDelayed]) {
          client[kBuffer].push(message.data.packet);
        } else {
          // @ts-expect-error onPacket() is private
          client.onPacket(message.data.packet);
        }
        break;
      }

      case MessageType.UPGRADE: {
        const sid = message.data.sid;
        const client = this.clients[sid];
        if (!client) {
          return;
        }

        clearInterval(client[kNoopTimer]);
        client.upgrading = false;

        if (message.data.success) {
          client.upgraded = true;
          client.emit("upgrade");

          if (client[kDelayed]) {
            client[kDelayed] = false;
            clearTimeout(client[kDelayedTimer]);
            client.close(true);
            delete this.clients[sid];

            this.publishMessage({
              requestId: message.requestId,
              senderId: this._nodeId,
              recipientId: message.senderId,
              type: MessageType.UPGRADE_RESPONSE,
              data: {
                takeOver: true,
                packets: client[kBuffer],
              },
            });
          } else {
            this._forwardFlushWhenWebSocket(client, sid, message.senderId);

            this.publishMessage({
              requestId: message.requestId,
              senderId: this._nodeId,
              recipientId: message.senderId,
              type: MessageType.UPGRADE_RESPONSE,
              data: {
                takeOver: false,
                packets: [],
              },
            });
          }
        }
        break;
      }

      case MessageType.UPGRADE_RESPONSE: {
        const requestId = message.requestId;
        const request = this._requests.get(requestId);
        if (!request) {
          return;
        }
        this._requests.delete(requestId);
        clearTimeout(request.timer);
        request.onSuccess(message.data.takeOver, message.data.packets);
        break;
      }

      case MessageType.CLOSE: {
        const client = this.clients[message.data.sid];
        if (!client) {
          return;
        }
        this._doConnect(client);
        // @ts-expect-error onClose() is private
        client.onClose(message.data.reason);
        break;
      }
    }
  }

  private _forwardFlushWhenPolling(
    client: Socket,
    sid: SessionId,
    senderId: NodeId
  ) {
    // @ts-expect-error req is private
    client.transport.req = true;
    client.transport.writable = true;
    const oldSend = client.transport.send;

    client.transport.send = (packets) => {
      this.publishMessage({
        senderId: this._nodeId,
        recipientId: senderId,
        type: MessageType.DRAIN,
        data: {
          sid,
          packets,
        },
      });
      // @ts-expect-error req is private
      client.transport.req = null;
      client.transport.writable = false;
      client.transport.send = oldSend;
    };

    // @ts-expect-error flush() is private
    client.flush();
  }

  private _forwardFlushWhenWebSocket(
    client: Socket,
    sid: SessionId,
    senderId: NodeId
  ) {
    client.transport.writable = true;
    client.transport.send = (packets) => {
      this.publishMessage({
        senderId: this._nodeId,
        recipientId: senderId,
        type: MessageType.DRAIN,
        data: {
          sid,
          packets,
        },
      });
    };

    // @ts-expect-error flush() is private
    client.flush();
  }

  override verify(
    req: IncomingMessage & { _query: Record<string, string> },
    upgrade: boolean,
    fn: (errorCode?: number, context?: any) => void
  ): void {
    super.verify(req, upgrade, (errorCode: number, errorContext: any) => {
      if (errorCode !== Server.errors.UNKNOWN_SID) {
        return fn(errorCode, errorContext);
      }

      const sid = req._query.sid as SessionId;
      if (!isValidSessionId(sid)) {
        return fn(errorCode, errorContext);
      }

      const transportName = req._query.transport;
      const lockType = req.method === "GET" ? "read" : "write";

      const onSuccess = async (senderId: NodeId) => {
        if (upgrade) {
          req[kSenderId] = senderId;
          fn();
        } else {
          const transport = this.createTransport(transportName, req);
          this._hookTransport(sid, transport, lockType, senderId);
          transport.onRequest(req);
        }
      };

      this._acquireLock(sid, transportName, lockType, onSuccess, () =>
        fn(errorCode, errorContext)
      );
    });
  }

  private _acquireLock(
    sid: SessionId,
    transportName: string,
    lockType: "read" | "write",
    onSuccess: (senderId: NodeId) => void,
    onError: () => void
  ) {
    const requestId = ++this._requestCount as RequestId;

    const timer = setTimeout(() => {
      this._requests.delete(requestId);
      onError();
    }, this._opts.responseTimeout);

    this._requests.set(requestId, {
      timer,
      onSuccess,
      onError,
    });

    this.publishMessage({
      requestId,
      senderId: this._nodeId,
      type: MessageType.ACQUIRE_LOCK,
      data: {
        sid,
        transportName,
        type: lockType,
      },
    });
  }

  private _hookTransport(
    sid: SessionId,
    transport: Transport,
    lockType: "read" | "write",
    senderId: NodeId
  ) {
    if (lockType === "read") {
      this._remoteTransports.set(sid, transport);
    }

    transport.on("packet", async (packet: Packet) =>
      this._onPacket(sid, senderId, packet)
    );
    transport.once("error", () =>
      this._onClose(sid, senderId, "transport error")
    );
    transport.once("close", () =>
      this._onClose(sid, senderId, "transport close")
    );
  }

  private _tryUpgrade(
    transport: Transport,
    onSuccess: () => void,
    onError: () => void
  ) {
    debug("starting upgrade process");

    const upgradeTimeoutTimer = setTimeout(() => {
      debug("client did not complete upgrade - closing transport");
      transport.close();
      transport.removeAllListeners();
      onError();
    }, this.opts.upgradeTimeout);

    transport.on("packet", (packet) => {
      if (packet.type === "ping" && packet.data === "probe") {
        debug("got probe ping packet, sending pong");
        transport.send([{ type: "pong", data: "probe" }]);
      } else if (packet.type === "upgrade") {
        clearTimeout(upgradeTimeoutTimer);
        transport.removeAllListeners();
        onSuccess();
      } else {
        transport.removeAllListeners();
        transport.close();
        onError();
      }
    });

    transport.on("error", () => {
      transport.removeAllListeners();
      onError();
    });

    transport.on("close", () => {
      transport.removeAllListeners();
      onError();
    });
  }

  private _onPacket(sid: SessionId, senderId: NodeId, packet: Packet) {
    this.publishMessage({
      senderId: this._nodeId,
      recipientId: senderId,
      type: MessageType.PACKET,
      data: {
        sid,
        packet,
      },
    });
  }

  private _onClose(
    sid: SessionId,
    senderId: NodeId,
    reason: "transport error" | "transport close"
  ) {
    this.publishMessage({
      senderId: this._nodeId,
      recipientId: senderId,
      type: MessageType.CLOSE,
      data: {
        sid,
        reason,
      },
    });
  }

  override onWebSocket(req: any, socket: any, websocket: any) {
    const sid = req._query.sid;
    if (!sid || this.clients[sid]) {
      // @ts-expect-error onWebSocket() is private
      return super.onWebSocket(req, socket, websocket);
    }

    websocket.on("error", () => {});
    req.websocket = websocket;

    const transport = this.createTransport(req._query.transport, req);
    const senderId = req[kSenderId];

    this._tryUpgrade(
      transport,
      () => this._onUpgradeSuccess(sid, transport, req, senderId),
      () => {
        debug("upgrade failure");
      }
    );
  }

  private _onUpgradeSuccess(
    sid: SessionId,
    transport: Transport,
    req: any,
    senderId: NodeId
  ) {
    debug("upgrade success");
    this._hookTransport(sid, transport, "read", senderId);

    const requestId = ++this._requestCount as RequestId;

    const onSuccess = (takeOver: boolean, packets: Packet[]) => {
      if (takeOver) {
        this._remoteTransports.delete(sid);

        const send = transport.send;
        transport.send = () => {};
        const socket = new Socket(sid, this, transport, req, 4);
        transport.send = send;

        this.clients[sid] = socket;
        this.clientsCount++;

        socket.once("close", () => {
          delete this.clients[sid];
          this.clientsCount--;
        });

        super.emit("connection", socket);
        socket.emit("upgrade");
        for (const packet of packets) {
          // @ts-expect-error onPacket() is private
          socket.onPacket(packet);
        }
      }
    };

    const onError = () => {
      transport.close();
    };

    const timer = setTimeout(() => {
      this._requests.delete(requestId);
      onError();
    }, this._opts.responseTimeout);

    this._requests.set(requestId, {
      timer,
      onSuccess,
      onError,
    });

    this.publishMessage({
      requestId,
      senderId: this._nodeId,
      recipientId: senderId,
      type: MessageType.UPGRADE,
      data: {
        sid,
        success: true,
      },
    });
  }

  override emit(ev: string, ...args: any[]): boolean {
    if (ev !== "connection") {
      return super.emit(ev, ...args);
    }

    const socket = args[0] as Socket;

    if (socket.transport.name === "websocket") {
      return super.emit(ev, ...args);
    }

    debug("delaying connection");

    socket[kDelayed] = true;
    socket[kBuffer] = [];

    socket[kPacketListener] = (packet: Packet) => {
      socket[kBuffer].push(packet);
    };

    socket.on("packet", socket[kPacketListener]);

    socket[kDelayedTimer] = setTimeout(
      () => this._doConnect(socket),
      this._opts.delayedConnectionTimeout
    );
  }

  private _doConnect(socket: Socket) {
    if (!socket[kDelayed] || socket.readyState !== "open") {
      return;
    }
    debug(
      "the client has not upgraded yet, so the connection process is completed here"
    );
    socket[kDelayed] = false;
    socket.off("packet", socket[kPacketListener]);
    clearTimeout(socket[kDelayedTimer]);

    super.emit("connection", socket);

    socket[kBuffer].forEach((packet: Packet) => {
      // @ts-expect-error onPacket() method is private
      socket.onPacket(packet);
    });
    delete socket[kBuffer];

    if (socket.upgraded) {
      socket.emit("upgrade");
    }
  }

  abstract publishMessage(message: Message): void;
}
