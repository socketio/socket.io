import { Adapter, BroadcastOptions, Room } from "./index";
import { debug as debugModule } from "debug";
import { randomBytes } from "crypto";

const debug = debugModule("socket.io-adapter");
const EMITTER_UID = "emitter";
const DEFAULT_TIMEOUT = 5000;

function randomId() {
  return randomBytes(8).toString("hex");
}

export interface ClusterAdapterOptions {
  /**
   * The number of ms between two heartbeats.
   * @default 5_000
   */
  heartbeatInterval?: number;
  /**
   * The number of ms without heartbeat before we consider a node down.
   * @default 10_000
   */
  heartbeatTimeout?: number;
}

export enum MessageType {
  INITIAL_HEARTBEAT = 1,
  HEARTBEAT,
  BROADCAST,
  SOCKETS_JOIN,
  SOCKETS_LEAVE,
  DISCONNECT_SOCKETS,
  FETCH_SOCKETS,
  FETCH_SOCKETS_RESPONSE,
  SERVER_SIDE_EMIT,
  SERVER_SIDE_EMIT_RESPONSE,
  BROADCAST_CLIENT_COUNT,
  BROADCAST_ACK,
}

export interface ClusterMessage {
  uid: string;
  type: MessageType;
  data?: Record<string, unknown>;
}

interface ClusterRequest {
  type: MessageType;
  resolve: Function;
  timeout: NodeJS.Timeout;
  expected: number;
  current: number;
  responses: any[];
}

interface ClusterResponse {
  type: MessageType;
  data: {
    requestId: string;
    [key: string]: unknown;
  };
}

interface ClusterAckRequest {
  clientCountCallback: (clientCount: number) => void;
  ack: (...args: any[]) => void;
}

function encodeOptions(opts: BroadcastOptions) {
  return {
    rooms: [...opts.rooms],
    except: [...opts.except],
    flags: opts.flags,
  };
}

function decodeOptions(opts): BroadcastOptions {
  return {
    rooms: new Set(opts.rooms),
    except: new Set(opts.except),
    flags: opts.flags,
  };
}

/**
 * A cluster-ready adapter. Any extending class must:
 *
 * - implement {@link ClusterAdapter#publishMessage} and {@link ClusterAdapter#publishResponse}
 * - call {@link ClusterAdapter#onMessage} and {@link ClusterAdapter#onResponse}
 */
export abstract class ClusterAdapter extends Adapter {
  protected readonly uid: string;

  private requests: Map<string, ClusterRequest> = new Map();
  private ackRequests: Map<string, ClusterAckRequest> = new Map();

  protected constructor(nsp) {
    super(nsp);
    this.uid = randomId();
  }

  /**
   * Called when receiving a message from another member of the cluster.
   *
   * @param message
   * @param offset
   * @protected
   */
  protected async onMessage(message: ClusterMessage, offset?: string) {
    if (message.uid === this.uid) {
      return debug("ignore message from self");
    }

    debug("new event of type %d from %s", message.type, message.uid);

    switch (message.type) {
      case MessageType.BROADCAST: {
        const withAck = message.data.requestId !== undefined;
        if (withAck) {
          super.broadcastWithAck(
            message.data.packet,
            decodeOptions(message.data.opts),
            (clientCount) => {
              debug("waiting for %d client acknowledgements", clientCount);
              this.publishResponse(message.uid, {
                type: MessageType.BROADCAST_CLIENT_COUNT,
                data: {
                  requestId: message.data.requestId as string,
                  clientCount,
                },
              });
            },
            (arg) => {
              debug("received acknowledgement with value %j", arg);
              this.publishResponse(message.uid, {
                type: MessageType.BROADCAST_ACK,
                data: {
                  requestId: message.data.requestId as string,
                  packet: arg,
                },
              });
            }
          );
        } else {
          const packet = message.data.packet;
          const opts = decodeOptions(message.data.opts);

          this.addOffsetIfNecessary(packet, opts, offset);

          super.broadcast(packet, opts);
        }
        break;
      }

      case MessageType.SOCKETS_JOIN:
        super.addSockets(
          decodeOptions(message.data.opts),
          message.data.rooms as string[]
        );
        break;

      case MessageType.SOCKETS_LEAVE:
        super.delSockets(
          decodeOptions(message.data.opts),
          message.data.rooms as string[]
        );
        break;

      case MessageType.DISCONNECT_SOCKETS:
        super.disconnectSockets(
          decodeOptions(message.data.opts),
          message.data.close as boolean
        );
        break;

      case MessageType.FETCH_SOCKETS: {
        debug("calling fetchSockets with opts %j", message.data.opts);
        const localSockets = await super.fetchSockets(
          decodeOptions(message.data.opts)
        );

        this.publishResponse(message.uid, {
          type: MessageType.FETCH_SOCKETS_RESPONSE,
          data: {
            requestId: message.data.requestId as string,
            sockets: localSockets.map((socket) => {
              // remove sessionStore from handshake, as it may contain circular references
              const { sessionStore, ...handshake } = socket.handshake;
              return {
                id: socket.id,
                handshake,
                rooms: [...socket.rooms],
                data: socket.data,
              };
            }),
          },
        });
        break;
      }

      case MessageType.SERVER_SIDE_EMIT: {
        const packet = message.data.packet as unknown[];
        const withAck = message.data.requestId !== undefined;
        if (!withAck) {
          this.nsp._onServerSideEmit(packet);
          return;
        }
        let called = false;
        const callback = (arg: any) => {
          // only one argument is expected
          if (called) {
            return;
          }
          called = true;
          debug("calling acknowledgement with %j", arg);
          this.publishResponse(message.uid, {
            type: MessageType.SERVER_SIDE_EMIT_RESPONSE,
            data: {
              requestId: message.data.requestId as string,
              packet: arg,
            },
          });
        };

        packet.push(callback);
        this.nsp._onServerSideEmit(packet);
        break;
      }

      default:
        debug("unknown message type: %s", message.type);
    }
  }

  /**
   * Called when receiving a response from another member of the cluster.
   *
   * @param response
   * @protected
   */
  protected onResponse(response: ClusterResponse) {
    const requestId = response.data.requestId;

    debug("received response %s to request %s", response.type, requestId);

    switch (response.type) {
      case MessageType.BROADCAST_CLIENT_COUNT: {
        this.ackRequests
          .get(requestId)
          ?.clientCountCallback(response.data.clientCount as number);
        break;
      }

      case MessageType.BROADCAST_ACK: {
        this.ackRequests.get(requestId)?.ack(response.data.packet);
        break;
      }

      case MessageType.FETCH_SOCKETS_RESPONSE: {
        const request = this.requests.get(requestId);

        if (!request) {
          return;
        }

        request.current++;
        (response.data.sockets as any[]).forEach((socket) =>
          request.responses.push(socket)
        );

        if (request.current === request.expected) {
          clearTimeout(request.timeout);
          request.resolve(request.responses);
          this.requests.delete(requestId);
        }
        break;
      }

      case MessageType.SERVER_SIDE_EMIT_RESPONSE: {
        const request = this.requests.get(requestId);

        if (!request) {
          return;
        }

        request.current++;
        request.responses.push(response.data.packet);

        if (request.current === request.expected) {
          clearTimeout(request.timeout);
          request.resolve(null, request.responses);
          this.requests.delete(requestId);
        }
        break;
      }

      default:
        debug("unknown response type: %s", response.type);
    }
  }

  override async broadcast(packet: any, opts: BroadcastOptions) {
    const onlyLocal = opts.flags?.local;

    if (!onlyLocal) {
      try {
        const offset = await this.publish({
          type: MessageType.BROADCAST,
          data: {
            packet,
            opts: encodeOptions(opts),
          },
        });
        this.addOffsetIfNecessary(packet, opts, offset);
      } catch (e) {
        return debug("error while broadcasting message: %s", e.message);
      }
    }

    super.broadcast(packet, opts);
  }

  /**
   * Adds an offset at the end of the data array in order to allow the client to receive any missed packets when it
   * reconnects after a temporary disconnection.
   *
   * @param packet
   * @param opts
   * @param offset
   * @private
   */
  private addOffsetIfNecessary(
    packet: any,
    opts: BroadcastOptions,
    offset: string
  ) {
    if (!this.nsp.server.opts.connectionStateRecovery) {
      return;
    }
    const isEventPacket = packet.type === 2;
    // packets with acknowledgement are not stored because the acknowledgement function cannot be serialized and
    // restored on another server upon reconnection
    const withoutAcknowledgement = packet.id === undefined;
    const notVolatile = opts.flags?.volatile === undefined;

    if (isEventPacket && withoutAcknowledgement && notVolatile) {
      packet.data.push(offset);
    }
  }

  override broadcastWithAck(
    packet: any,
    opts: BroadcastOptions,
    clientCountCallback: (clientCount: number) => void,
    ack: (...args: any[]) => void
  ) {
    const onlyLocal = opts?.flags?.local;
    if (!onlyLocal) {
      const requestId = randomId();

      this.publish({
        type: MessageType.BROADCAST,
        data: {
          packet,
          requestId,
          opts: encodeOptions(opts),
        },
      });

      this.ackRequests.set(requestId, {
        clientCountCallback,
        ack,
      });

      // we have no way to know at this level whether the server has received an acknowledgement from each client, so we
      // will simply clean up the ackRequests map after the given delay
      setTimeout(() => {
        this.ackRequests.delete(requestId);
      }, opts.flags!.timeout);
    }

    super.broadcastWithAck(packet, opts, clientCountCallback, ack);
  }

  override addSockets(opts: BroadcastOptions, rooms: Room[]) {
    super.addSockets(opts, rooms);

    const onlyLocal = opts.flags?.local;
    if (onlyLocal) {
      return;
    }

    this.publish({
      type: MessageType.SOCKETS_JOIN,
      data: {
        opts: encodeOptions(opts),
        rooms,
      },
    });
  }

  override delSockets(opts: BroadcastOptions, rooms: Room[]) {
    super.delSockets(opts, rooms);

    const onlyLocal = opts.flags?.local;
    if (onlyLocal) {
      return;
    }

    this.publish({
      type: MessageType.SOCKETS_LEAVE,
      data: {
        opts: encodeOptions(opts),
        rooms,
      },
    });
  }

  override disconnectSockets(opts: BroadcastOptions, close: boolean) {
    super.disconnectSockets(opts, close);

    const onlyLocal = opts.flags?.local;
    if (onlyLocal) {
      return;
    }

    this.publish({
      type: MessageType.DISCONNECT_SOCKETS,
      data: {
        opts: encodeOptions(opts),
        close,
      },
    });
  }

  async fetchSockets(opts: BroadcastOptions): Promise<any[]> {
    const [localSockets, serverCount] = await Promise.all([
      super.fetchSockets(opts),
      this.serverCount(),
    ]);
    const expectedResponseCount = serverCount - 1;

    if (opts.flags?.local || expectedResponseCount === 0) {
      return localSockets;
    }

    const requestId = randomId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const storedRequest = this.requests.get(requestId);
        if (storedRequest) {
          reject(
            new Error(
              `timeout reached: only ${storedRequest.current} responses received out of ${storedRequest.expected}`
            )
          );
          this.requests.delete(requestId);
        }
      }, opts.flags.timeout || DEFAULT_TIMEOUT);

      const storedRequest = {
        type: MessageType.FETCH_SOCKETS,
        resolve,
        timeout,
        current: 0,
        expected: expectedResponseCount,
        responses: localSockets,
      };
      this.requests.set(requestId, storedRequest);

      this.publish({
        type: MessageType.FETCH_SOCKETS,
        data: {
          opts: encodeOptions(opts),
          requestId,
        },
      });
    });
  }

  override async serverSideEmit(packet: any[]) {
    const withAck = typeof packet[packet.length - 1] === "function";

    if (!withAck) {
      return this.publish({
        type: MessageType.SERVER_SIDE_EMIT,
        data: {
          packet,
        },
      });
    }

    const ack = packet.pop();
    const expectedResponseCount = (await this.serverCount()) - 1;

    debug(
      'waiting for %d responses to "serverSideEmit" request',
      expectedResponseCount
    );

    if (expectedResponseCount <= 0) {
      return ack(null, []);
    }

    const requestId = randomId();

    const timeout = setTimeout(() => {
      const storedRequest = this.requests.get(requestId);
      if (storedRequest) {
        ack(
          new Error(
            `timeout reached: only ${storedRequest.current} responses received out of ${storedRequest.expected}`
          ),
          storedRequest.responses
        );
        this.requests.delete(requestId);
      }
    }, DEFAULT_TIMEOUT);

    const storedRequest = {
      type: MessageType.SERVER_SIDE_EMIT,
      resolve: ack,
      timeout,
      current: 0,
      expected: expectedResponseCount,
      responses: [],
    };
    this.requests.set(requestId, storedRequest);

    this.publish({
      type: MessageType.SERVER_SIDE_EMIT,
      data: {
        requestId, // the presence of this attribute defines whether an acknowledgement is needed
        packet,
      },
    });
  }

  protected publish(message: Omit<ClusterMessage, "uid">) {
    return this.publishMessage({
      uid: this.uid,
      ...message,
    });
  }

  /**
   * Send a message to the other members of the cluster.
   *
   * @param message
   * @protected
   * @return an offset, if applicable
   */
  protected abstract publishMessage(message: ClusterMessage): Promise<string>;

  /**
   * Send a response to the given member of the cluster.
   *
   * @param requesterUid
   * @param response
   * @protected
   */
  protected abstract publishResponse(
    requesterUid: string,
    response: ClusterResponse
  );
}

export abstract class ClusterAdapterWithHeartbeat extends ClusterAdapter {
  private readonly _opts: Required<ClusterAdapterOptions>;

  private heartbeatTimer: NodeJS.Timeout;
  private nodesMap: Map<string, number> = new Map(); // uid => timestamp of last message

  protected constructor(nsp, opts: ClusterAdapterOptions) {
    super(nsp);
    this._opts = Object.assign(
      {
        heartbeatInterval: 5_000,
        heartbeatTimeout: 10_000,
      },
      opts
    );
  }

  override init(): Promise<void> | void {
    this.publish({
      type: MessageType.INITIAL_HEARTBEAT,
    });
  }

  private scheduleHeartbeat() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }
    this.heartbeatTimer = setTimeout(() => {
      this.publish({
        type: MessageType.HEARTBEAT,
      });
    }, this._opts.heartbeatInterval);
  }

  override close(): Promise<void> | void {
    clearTimeout(this.heartbeatTimer);
  }

  override async onMessage(message: ClusterMessage, offset?: string) {
    if (message.uid === this.uid) {
      return debug("ignore message from self");
    }

    if (message.uid && message.uid !== EMITTER_UID) {
      // we track the UID of each sender, in order to know how many servers there are in the cluster
      this.nodesMap.set(message.uid, Date.now());
    }

    switch (message.type) {
      case MessageType.INITIAL_HEARTBEAT:
        this.publish({
          type: MessageType.HEARTBEAT,
        });
        break;
      case MessageType.HEARTBEAT:
        // nothing to do
        break;
      default:
        super.onMessage(message, offset);
    }
  }

  override serverCount(): Promise<number> {
    const now = Date.now();
    this.nodesMap.forEach((lastSeen, uid) => {
      const nodeSeemsDown = now - lastSeen > this._opts.heartbeatTimeout;
      if (nodeSeemsDown) {
        debug("node %s seems down", uid);
        this.nodesMap.delete(uid);
      }
    });
    return Promise.resolve(1 + this.nodesMap.size);
  }

  override publish(message: Omit<ClusterMessage, "uid">) {
    this.scheduleHeartbeat();

    return super.publish(message);
  }
}
