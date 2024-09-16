import { Adapter } from "./in-memory-adapter";
import type {
  BroadcastFlags,
  BroadcastOptions,
  Room,
} from "./in-memory-adapter";
import { debug as debugModule } from "debug";
import { randomBytes } from "crypto";

const debug = debugModule("socket.io-adapter");
const EMITTER_UID = "emitter";
const DEFAULT_TIMEOUT = 5000;

function randomId() {
  return randomBytes(8).toString("hex");
}

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

/**
 * The unique ID of a server
 */
export type ServerId = string;

/**
 * The unique ID of a message (for the connection state recovery feature)
 */
export type Offset = string;

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
  ADAPTER_CLOSE,
}

export type ClusterMessage = {
  uid: ServerId;
  nsp: string;
} & (
  | {
      type:
        | MessageType.INITIAL_HEARTBEAT
        | MessageType.HEARTBEAT
        | MessageType.ADAPTER_CLOSE;
    }
  | {
      type: MessageType.BROADCAST;
      data: {
        opts: { rooms: string[]; except: string[]; flags: BroadcastFlags };
        packet: unknown;
        requestId?: string;
      };
    }
  | {
      type: MessageType.SOCKETS_JOIN | MessageType.SOCKETS_LEAVE;
      data: {
        opts: { rooms: string[]; except: string[]; flags: BroadcastFlags };
        rooms: string[];
      };
    }
  | {
      type: MessageType.DISCONNECT_SOCKETS;
      data: {
        opts: { rooms: string[]; except: string[]; flags: BroadcastFlags };
        close?: boolean;
      };
    }
  | {
      type: MessageType.FETCH_SOCKETS;
      data: {
        opts: { rooms: string[]; except: string[]; flags: BroadcastFlags };
        requestId: string;
      };
    }
  | {
      type: MessageType.SERVER_SIDE_EMIT;
      data: {
        requestId?: string;
        packet: any[];
      };
    }
);

interface ClusterRequest {
  type: MessageType;
  resolve: Function;
  timeout: NodeJS.Timeout;
  expected: number;
  current: number;
  responses: any[];
}

export type ClusterResponse = {
  uid: ServerId;
  nsp: string;
} & (
  | {
      type: MessageType.FETCH_SOCKETS_RESPONSE;
      data: {
        requestId: string;
        sockets: unknown[];
      };
    }
  | {
      type: MessageType.SERVER_SIDE_EMIT_RESPONSE;
      data: {
        requestId: string;
        packet: unknown;
      };
    }
  | {
      type: MessageType.BROADCAST_CLIENT_COUNT;
      data: {
        requestId: string;
        clientCount: number;
      };
    }
  | {
      type: MessageType.BROADCAST_ACK;
      data: {
        requestId: string;
        packet: unknown;
      };
    }
);

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
 * - implement {@link ClusterAdapter#doPublish} and {@link ClusterAdapter#doPublishResponse}
 * - call {@link ClusterAdapter#onMessage} and {@link ClusterAdapter#onResponse}
 */
export abstract class ClusterAdapter extends Adapter {
  protected readonly uid: ServerId;

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
  protected onMessage(message: ClusterMessage, offset?: string) {
    if (message.uid === this.uid) {
      return debug("[%s] ignore message from self", this.uid);
    }

    debug(
      "[%s] new event of type %d from %s",
      this.uid,
      message.type,
      message.uid,
    );

    switch (message.type) {
      case MessageType.BROADCAST: {
        const withAck = message.data.requestId !== undefined;
        if (withAck) {
          super.broadcastWithAck(
            message.data.packet,
            decodeOptions(message.data.opts),
            (clientCount) => {
              debug(
                "[%s] waiting for %d client acknowledgements",
                this.uid,
                clientCount,
              );
              this.publishResponse(message.uid, {
                type: MessageType.BROADCAST_CLIENT_COUNT,
                data: {
                  requestId: message.data.requestId,
                  clientCount,
                },
              });
            },
            (arg) => {
              debug(
                "[%s] received acknowledgement with value %j",
                this.uid,
                arg,
              );
              this.publishResponse(message.uid, {
                type: MessageType.BROADCAST_ACK,
                data: {
                  requestId: message.data.requestId,
                  packet: arg,
                },
              });
            },
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
        super.addSockets(decodeOptions(message.data.opts), message.data.rooms);
        break;

      case MessageType.SOCKETS_LEAVE:
        super.delSockets(decodeOptions(message.data.opts), message.data.rooms);
        break;

      case MessageType.DISCONNECT_SOCKETS:
        super.disconnectSockets(
          decodeOptions(message.data.opts),
          message.data.close,
        );
        break;

      case MessageType.FETCH_SOCKETS: {
        debug(
          "[%s] calling fetchSockets with opts %j",
          this.uid,
          message.data.opts,
        );
        super
          .fetchSockets(decodeOptions(message.data.opts))
          .then((localSockets) => {
            this.publishResponse(message.uid, {
              type: MessageType.FETCH_SOCKETS_RESPONSE,
              data: {
                requestId: message.data.requestId,
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
          });
        break;
      }

      case MessageType.SERVER_SIDE_EMIT: {
        const packet = message.data.packet;
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
          debug("[%s] calling acknowledgement with %j", this.uid, arg);
          this.publishResponse(message.uid, {
            type: MessageType.SERVER_SIDE_EMIT_RESPONSE,
            data: {
              requestId: message.data.requestId,
              packet: arg,
            },
          });
        };

        this.nsp._onServerSideEmit([...packet, callback]);
        break;
      }

      // @ts-ignore
      case MessageType.BROADCAST_CLIENT_COUNT:
      // @ts-ignore
      case MessageType.BROADCAST_ACK:
      // @ts-ignore
      case MessageType.FETCH_SOCKETS_RESPONSE:
      // @ts-ignore
      case MessageType.SERVER_SIDE_EMIT_RESPONSE:
        // extending classes may not make a distinction between a ClusterMessage and a ClusterResponse payload and may
        // always call the onMessage() method
        this.onResponse(message);
        break;

      default:
        debug("[%s] unknown message type: %s", this.uid, message.type);
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

    debug(
      "[%s] received response %s to request %s",
      this.uid,
      response.type,
      requestId,
    );

    switch (response.type) {
      case MessageType.BROADCAST_CLIENT_COUNT: {
        this.ackRequests
          .get(requestId)
          ?.clientCountCallback(response.data.clientCount);
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
        response.data.sockets.forEach((socket) =>
          request.responses.push(socket),
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
        // @ts-ignore
        debug("[%s] unknown response type: %s", this.uid, response.type);
    }
  }

  override async broadcast(packet: any, opts: BroadcastOptions) {
    const onlyLocal = opts.flags?.local;

    if (!onlyLocal) {
      try {
        const offset = await this.publishAndReturnOffset({
          type: MessageType.BROADCAST,
          data: {
            packet,
            opts: encodeOptions(opts),
          },
        });
        this.addOffsetIfNecessary(packet, opts, offset);
      } catch (e) {
        return debug(
          "[%s] error while broadcasting message: %s",
          this.uid,
          e.message,
        );
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
    offset: Offset,
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
    ack: (...args: any[]) => void,
  ) {
    const onlyLocal = opts?.flags?.local;
    if (!onlyLocal) {
      const requestId = randomId();

      this.ackRequests.set(requestId, {
        clientCountCallback,
        ack,
      });

      this.publish({
        type: MessageType.BROADCAST,
        data: {
          packet,
          requestId,
          opts: encodeOptions(opts),
        },
      });

      // we have no way to know at this level whether the server has received an acknowledgement from each client, so we
      // will simply clean up the ackRequests map after the given delay
      setTimeout(() => {
        this.ackRequests.delete(requestId);
      }, opts.flags!.timeout);
    }

    super.broadcastWithAck(packet, opts, clientCountCallback, ack);
  }

  override async addSockets(opts: BroadcastOptions, rooms: Room[]) {
    const onlyLocal = opts.flags?.local;

    if (!onlyLocal) {
      try {
        await this.publishAndReturnOffset({
          type: MessageType.SOCKETS_JOIN,
          data: {
            opts: encodeOptions(opts),
            rooms,
          },
        });
      } catch (e) {
        debug("[%s] error while publishing message: %s", this.uid, e.message);
      }
    }

    super.addSockets(opts, rooms);
  }

  override async delSockets(opts: BroadcastOptions, rooms: Room[]) {
    const onlyLocal = opts.flags?.local;

    if (!onlyLocal) {
      try {
        await this.publishAndReturnOffset({
          type: MessageType.SOCKETS_LEAVE,
          data: {
            opts: encodeOptions(opts),
            rooms,
          },
        });
      } catch (e) {
        debug("[%s] error while publishing message: %s", this.uid, e.message);
      }
    }

    super.delSockets(opts, rooms);
  }

  override async disconnectSockets(opts: BroadcastOptions, close: boolean) {
    const onlyLocal = opts.flags?.local;

    if (!onlyLocal) {
      try {
        await this.publishAndReturnOffset({
          type: MessageType.DISCONNECT_SOCKETS,
          data: {
            opts: encodeOptions(opts),
            close,
          },
        });
      } catch (e) {
        debug("[%s] error while publishing message: %s", this.uid, e.message);
      }
    }

    super.disconnectSockets(opts, close);
  }

  async fetchSockets(opts: BroadcastOptions): Promise<any[]> {
    const [localSockets, serverCount] = await Promise.all([
      super.fetchSockets(opts),
      this.serverCount(),
    ]);
    const expectedResponseCount = serverCount - 1;

    if (opts.flags?.local || expectedResponseCount <= 0) {
      return localSockets;
    }

    const requestId = randomId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const storedRequest = this.requests.get(requestId);
        if (storedRequest) {
          reject(
            new Error(
              `timeout reached: only ${storedRequest.current} responses received out of ${storedRequest.expected}`,
            ),
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
      '[%s] waiting for %d responses to "serverSideEmit" request',
      this.uid,
      expectedResponseCount,
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
            `timeout reached: only ${storedRequest.current} responses received out of ${storedRequest.expected}`,
          ),
          storedRequest.responses,
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

  protected publish(
    message: DistributiveOmit<ClusterMessage, "nsp" | "uid">,
  ): void {
    this.publishAndReturnOffset(message).catch((err) => {
      debug("[%s] error while publishing message: %s", this.uid, err);
    });
  }

  protected publishAndReturnOffset(
    message: DistributiveOmit<ClusterMessage, "nsp" | "uid">,
  ) {
    (message as ClusterMessage).uid = this.uid;
    (message as ClusterMessage).nsp = this.nsp.name;
    return this.doPublish(message as ClusterMessage);
  }

  /**
   * Send a message to the other members of the cluster.
   *
   * @param message
   * @protected
   * @return an offset, if applicable
   */
  protected abstract doPublish(message: ClusterMessage): Promise<Offset>;

  protected publishResponse(
    requesterUid: ServerId,
    response: Omit<ClusterResponse, "nsp" | "uid">,
  ) {
    (response as ClusterResponse).uid = this.uid;
    (response as ClusterResponse).nsp = this.nsp.name;
    this.doPublishResponse(requesterUid, response as ClusterResponse).catch(
      (err) => {
        debug("[%s] error while publishing response: %s", this.uid, err);
      },
    );
  }

  /**
   * Send a response to the given member of the cluster.
   *
   * @param requesterUid
   * @param response
   * @protected
   */
  protected abstract doPublishResponse(
    requesterUid: ServerId,
    response: ClusterResponse,
  ): Promise<void>;
}

interface CustomClusterRequest {
  type: MessageType;
  resolve: Function;
  timeout: NodeJS.Timeout;
  missingUids: Set<string>;
  responses: any[];
}

export abstract class ClusterAdapterWithHeartbeat extends ClusterAdapter {
  private readonly _opts: Required<ClusterAdapterOptions>;

  private heartbeatTimer: NodeJS.Timeout;
  private nodesMap: Map<ServerId, number> = new Map(); // uid => timestamp of last message
  private readonly cleanupTimer: NodeJS.Timeout | undefined;
  private customRequests: Map<string, CustomClusterRequest> = new Map();

  protected constructor(nsp, opts: ClusterAdapterOptions) {
    super(nsp);
    this._opts = Object.assign(
      {
        heartbeatInterval: 5_000,
        heartbeatTimeout: 10_000,
      },
      opts,
    );
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      this.nodesMap.forEach((lastSeen, uid) => {
        const nodeSeemsDown = now - lastSeen > this._opts.heartbeatTimeout;
        if (nodeSeemsDown) {
          debug("[%s] node %s seems down", this.uid, uid);
          this.removeNode(uid);
        }
      });
    }, 1_000);
  }

  override init() {
    this.publish({
      type: MessageType.INITIAL_HEARTBEAT,
    });
  }

  private scheduleHeartbeat() {
    if (this.heartbeatTimer) {
      this.heartbeatTimer.refresh();
    } else {
      this.heartbeatTimer = setTimeout(() => {
        this.publish({
          type: MessageType.HEARTBEAT,
        });
      }, this._opts.heartbeatInterval);
    }
  }

  override close() {
    this.publish({
      type: MessageType.ADAPTER_CLOSE,
    });
    clearTimeout(this.heartbeatTimer);
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  override onMessage(message: ClusterMessage, offset?: string) {
    if (message.uid === this.uid) {
      return debug("[%s] ignore message from self", this.uid);
    }

    if (message.uid && message.uid !== EMITTER_UID) {
      // we track the UID of each sender, in order to know how many servers there are in the cluster
      this.nodesMap.set(message.uid, Date.now());
    }

    debug(
      "[%s] new event of type %d from %s",
      this.uid,
      message.type,
      message.uid,
    );

    switch (message.type) {
      case MessageType.INITIAL_HEARTBEAT:
        this.publish({
          type: MessageType.HEARTBEAT,
        });
        break;
      case MessageType.HEARTBEAT:
        // nothing to do
        break;
      case MessageType.ADAPTER_CLOSE:
        this.removeNode(message.uid);
        break;
      default:
        super.onMessage(message, offset);
    }
  }

  override serverCount(): Promise<number> {
    return Promise.resolve(1 + this.nodesMap.size);
  }

  override publish(message: DistributiveOmit<ClusterMessage, "nsp" | "uid">) {
    this.scheduleHeartbeat();

    return super.publish(message);
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
    const expectedResponseCount = this.nodesMap.size;

    debug(
      '[%s] waiting for %d responses to "serverSideEmit" request',
      this.uid,
      expectedResponseCount,
    );

    if (expectedResponseCount <= 0) {
      return ack(null, []);
    }

    const requestId = randomId();

    const timeout = setTimeout(() => {
      const storedRequest = this.customRequests.get(requestId);
      if (storedRequest) {
        ack(
          new Error(
            `timeout reached: missing ${storedRequest.missingUids.size} responses`,
          ),
          storedRequest.responses,
        );
        this.customRequests.delete(requestId);
      }
    }, DEFAULT_TIMEOUT);

    const storedRequest = {
      type: MessageType.SERVER_SIDE_EMIT,
      resolve: ack,
      timeout,
      missingUids: new Set([...this.nodesMap.keys()]),
      responses: [],
    };
    this.customRequests.set(requestId, storedRequest);

    this.publish({
      type: MessageType.SERVER_SIDE_EMIT,
      data: {
        requestId, // the presence of this attribute defines whether an acknowledgement is needed
        packet,
      },
    });
  }

  override async fetchSockets(opts: BroadcastOptions): Promise<any[]> {
    const [localSockets, serverCount] = await Promise.all([
      super.fetchSockets({
        rooms: opts.rooms,
        except: opts.except,
        flags: {
          local: true,
        },
      }),
      this.serverCount(),
    ]);
    const expectedResponseCount = serverCount - 1;

    if (opts.flags?.local || expectedResponseCount <= 0) {
      return localSockets as any[];
    }

    const requestId = randomId();

    return new Promise<any[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const storedRequest = this.customRequests.get(requestId);
        if (storedRequest) {
          reject(
            new Error(
              `timeout reached: missing ${storedRequest.missingUids.size} responses`,
            ),
          );
          this.customRequests.delete(requestId);
        }
      }, opts.flags.timeout || DEFAULT_TIMEOUT);

      const storedRequest = {
        type: MessageType.FETCH_SOCKETS,
        resolve,
        timeout,
        missingUids: new Set([...this.nodesMap.keys()]),
        responses: localSockets as any[],
      };
      this.customRequests.set(requestId, storedRequest);

      this.publish({
        type: MessageType.FETCH_SOCKETS,
        data: {
          opts: encodeOptions(opts),
          requestId,
        },
      });
    });
  }

  override onResponse(response: ClusterResponse) {
    const requestId = response.data.requestId;

    debug(
      "[%s] received response %s to request %s",
      this.uid,
      response.type,
      requestId,
    );

    switch (response.type) {
      case MessageType.FETCH_SOCKETS_RESPONSE: {
        const request = this.customRequests.get(requestId);

        if (!request) {
          return;
        }

        (response.data.sockets as any[]).forEach((socket) =>
          request.responses.push(socket),
        );

        request.missingUids.delete(response.uid);
        if (request.missingUids.size === 0) {
          clearTimeout(request.timeout);
          request.resolve(request.responses);
          this.customRequests.delete(requestId);
        }
        break;
      }

      case MessageType.SERVER_SIDE_EMIT_RESPONSE: {
        const request = this.customRequests.get(requestId);

        if (!request) {
          return;
        }

        request.responses.push(response.data.packet);

        request.missingUids.delete(response.uid);
        if (request.missingUids.size === 0) {
          clearTimeout(request.timeout);
          request.resolve(null, request.responses);
          this.customRequests.delete(requestId);
        }
        break;
      }

      default:
        super.onResponse(response);
    }
  }

  private removeNode(uid: ServerId) {
    this.customRequests.forEach((request, requestId) => {
      request.missingUids.delete(uid);
      if (request.missingUids.size === 0) {
        clearTimeout(request.timeout);
        if (request.type === MessageType.FETCH_SOCKETS) {
          request.resolve(request.responses);
        } else if (request.type === MessageType.SERVER_SIDE_EMIT) {
          request.resolve(null, request.responses);
        }
        this.customRequests.delete(requestId);
      }
    });

    this.nodesMap.delete(uid);
  }
}
