import cluster from "node:cluster";
import { Adapter, BroadcastOptions, Room } from "socket.io-adapter";
import { randomBytes } from "node:crypto";

const randomId = () => randomBytes(8).toString("hex");
const debug = require("debug")("socket.io-cluster-adapter");

const MESSAGE_SOURCE = "_sio_adapter";
const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Event types, for messages between nodes
 */

enum EventType {
  WORKER_INIT = 1,
  WORKER_PING,
  WORKER_EXIT,
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

interface Request {
  type: EventType;
  resolve: Function;
  timeout: NodeJS.Timeout;
  expected: number;
  current: number;
  responses: any[];
}

interface AckRequest {
  type: EventType.BROADCAST;
  clientCountCallback: (clientCount: number) => void;
  ack: (...args: any[]) => void;
}

export interface ClusterAdapterOptions {
  /**
   * after this timeout the adapter will stop waiting from responses to request
   * @default 5000
   */
  requestsTimeout: number;
}

function ignoreError() {}

/**
 * Returns a function that will create a ClusterAdapter instance.
 *
 * @param opts - additional options
 *
 * @public
 */
export function createAdapter(opts: Partial<ClusterAdapterOptions> = {}) {
  return function (nsp) {
    return new ClusterAdapter(nsp, opts);
  };
}

export class ClusterAdapter extends Adapter {
  public requestsTimeout: number;

  private workerIds: Set<number> = new Set();
  private requests: Map<string, Request> = new Map();
  private ackRequests: Map<string, AckRequest> = new Map();

  /**
   * Adapter constructor.
   *
   * @param nsp - the namespace
   * @param opts - additional options
   *
   * @public
   */
  constructor(nsp: any, opts: Partial<ClusterAdapterOptions> = {}) {
    super(nsp);
    this.requestsTimeout = opts.requestsTimeout || 5000;

    this.publish({
      type: EventType.WORKER_INIT,
      data: cluster.worker.id,
    });

    process.on("message", this.onMessage.bind(this));
  }

  public async onMessage(message: any) {
    const isValidSource = message?.source === MESSAGE_SOURCE;
    if (!isValidSource) {
      return;
    }

    if (message.type === EventType.WORKER_EXIT) {
      this.workerIds.delete(message.data);
      debug("workers count is now %d", this.workerIds.size);
      return;
    }

    if (message.nsp !== this.nsp.name) {
      debug("ignore other namespace");
      return;
    }

    switch (message.type) {
      case EventType.WORKER_INIT:
        this.workerIds.add(message.data);
        debug("workers count is now %d", this.workerIds.size);
        this.publish({
          type: EventType.WORKER_PING,
          data: cluster.worker.id,
        });
        break;
      case EventType.WORKER_PING:
        this.workerIds.add(message.data);
        debug("workers count is now %d", this.workerIds.size);
        break;
      case EventType.BROADCAST: {
        debug("broadcast with opts %j", message.data.opts);

        const withAck = message.data.requestId !== undefined;
        if (withAck) {
          super.broadcastWithAck(
            message.data.packet,
            ClusterAdapter.deserializeOptions(message.data.opts),
            (clientCount) => {
              debug("waiting for %d client acknowledgements", clientCount);
              this.publish({
                type: EventType.BROADCAST_CLIENT_COUNT,
                data: {
                  requestId: message.data.requestId,
                  clientCount,
                },
              });
            },
            (arg) => {
              debug("received acknowledgement with value %j", arg);
              this.publish({
                type: EventType.BROADCAST_ACK,
                data: {
                  requestId: message.data.requestId,
                  packet: arg,
                },
              });
            }
          );
        } else {
          super.broadcast(
            message.data.packet,
            ClusterAdapter.deserializeOptions(message.data.opts)
          );
        }
        break;
      }

      case EventType.BROADCAST_CLIENT_COUNT: {
        const request = this.ackRequests.get(message.data.requestId);
        request?.clientCountCallback(message.data.clientCount);
        break;
      }

      case EventType.BROADCAST_ACK: {
        const request = this.ackRequests.get(message.data.requestId);
        request?.ack(message.data.packet);
        break;
      }

      case EventType.SOCKETS_JOIN: {
        debug("calling addSockets with opts %j", message.data.opts);
        super.addSockets(
          ClusterAdapter.deserializeOptions(message.data.opts),
          message.data.rooms
        );
        break;
      }
      case EventType.SOCKETS_LEAVE: {
        debug("calling delSockets with opts %j", message.data.opts);
        super.delSockets(
          ClusterAdapter.deserializeOptions(message.data.opts),
          message.data.rooms
        );
        break;
      }
      case EventType.DISCONNECT_SOCKETS: {
        debug("calling disconnectSockets with opts %j", message.data.opts);
        super.disconnectSockets(
          ClusterAdapter.deserializeOptions(message.data.opts),
          message.data.close
        );
        break;
      }
      case EventType.FETCH_SOCKETS: {
        debug("calling fetchSockets with opts %j", message.data.opts);
        const localSockets = await super.fetchSockets(
          ClusterAdapter.deserializeOptions(message.data.opts)
        );

        this.publish({
          type: EventType.FETCH_SOCKETS_RESPONSE,
          data: {
            requestId: message.data.requestId,
            workerId: message.data.workerId,
            sockets: localSockets.map((socket) => ({
              id: socket.id,
              handshake: socket.handshake,
              rooms: [...socket.rooms],
              data: socket.data,
            })),
          },
        });
        break;
      }
      case EventType.FETCH_SOCKETS_RESPONSE: {
        const request = this.requests.get(message.data.requestId);

        if (!request) {
          return;
        }

        request.current++;
        message.data.sockets.forEach((socket: any) =>
          request.responses.push(socket)
        );

        if (request.current === request.expected) {
          clearTimeout(request.timeout);
          request.resolve(request.responses);
          this.requests.delete(message.data.requestId);
        }
        break;
      }
      case EventType.SERVER_SIDE_EMIT: {
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
          debug("calling acknowledgement with %j", arg);
          this.publish({
            type: EventType.SERVER_SIDE_EMIT_RESPONSE,
            data: {
              requestId: message.data.requestId,
              workerId: message.data.workerId,
              packet: arg,
            },
          });
        };

        packet.push(callback);
        this.nsp._onServerSideEmit(packet);
        break;
      }
      case EventType.SERVER_SIDE_EMIT_RESPONSE: {
        const request = this.requests.get(message.data.requestId);

        if (!request) {
          return;
        }

        request.current++;
        request.responses.push(message.data.packet);

        if (request.current === request.expected) {
          clearTimeout(request.timeout);
          request.resolve(null, request.responses);
          this.requests.delete(message.data.requestId);
        }
      }
    }
  }

  private async publish(message: any) {
    // to be able to ignore unrelated messages on the cluster message bus
    message.source = MESSAGE_SOURCE;
    // to be able to ignore messages from other namespaces
    message.nsp = this.nsp.name;

    debug(
      "publish event of type %s for namespace %s",
      message.type,
      message.nsp
    );

    process.send(message, null, {}, ignoreError);
  }

  /**
   * Transform ES6 Set into plain arrays.
   *
   * Note: we manually serialize ES6 Sets so that using `serialization: "advanced"` is not needed when using plaintext
   * packets (reference: https://nodejs.org/api/child_process.html#child_process_advanced_serialization)
   */
  private static serializeOptions(opts: BroadcastOptions) {
    return {
      rooms: [...opts.rooms],
      except: opts.except ? [...opts.except] : [],
      flags: opts.flags,
    };
  }

  private static deserializeOptions(opts: any): BroadcastOptions {
    return {
      rooms: new Set(opts.rooms),
      except: new Set(opts.except),
      flags: opts.flags,
    };
  }

  public broadcast(packet: any, opts: BroadcastOptions) {
    const onlyLocal = opts?.flags?.local;
    if (!onlyLocal) {
      this.publish({
        type: EventType.BROADCAST,
        data: {
          packet,
          opts: ClusterAdapter.serializeOptions(opts),
        },
      });
    }

    // packets with binary contents are modified by the broadcast method, hence the nextTick()
    process.nextTick(() => {
      super.broadcast(packet, opts);
    });
  }

  public broadcastWithAck(
    packet: any,
    opts: BroadcastOptions,
    clientCountCallback: (clientCount: number) => void,
    ack: (...args: any[]) => void
  ) {
    const onlyLocal = opts?.flags?.local;
    if (!onlyLocal) {
      const requestId = randomId();

      this.publish({
        type: EventType.BROADCAST,
        data: {
          packet,
          requestId,
          opts: ClusterAdapter.serializeOptions(opts),
        },
      });

      this.ackRequests.set(requestId, {
        type: EventType.BROADCAST,
        clientCountCallback,
        ack,
      });

      // we have no way to know at this level whether the server has received an acknowledgement from each client, so we
      // will simply clean up the ackRequests map after the given delay
      setTimeout(() => {
        this.ackRequests.delete(requestId);
      }, opts.flags!.timeout);
    }

    // packets with binary contents are modified by the broadcast method, hence the nextTick()
    process.nextTick(() => {
      super.broadcastWithAck(packet, opts, clientCountCallback, ack);
    });
  }

  public serverCount(): Promise<number> {
    return Promise.resolve(1 + this.workerIds.size);
  }

  addSockets(opts: BroadcastOptions, rooms: Room[]) {
    super.addSockets(opts, rooms);

    const onlyLocal = opts.flags?.local;
    if (onlyLocal) {
      return;
    }

    this.publish({
      type: EventType.SOCKETS_JOIN,
      data: {
        opts: ClusterAdapter.serializeOptions(opts),
        rooms,
      },
    });
  }

  delSockets(opts: BroadcastOptions, rooms: Room[]) {
    super.delSockets(opts, rooms);

    const onlyLocal = opts.flags?.local;
    if (onlyLocal) {
      return;
    }

    this.publish({
      type: EventType.SOCKETS_LEAVE,
      data: {
        opts: ClusterAdapter.serializeOptions(opts),
        rooms,
      },
    });
  }

  disconnectSockets(opts: BroadcastOptions, close: boolean) {
    super.disconnectSockets(opts, close);

    const onlyLocal = opts.flags?.local;
    if (onlyLocal) {
      return;
    }

    this.publish({
      type: EventType.DISCONNECT_SOCKETS,
      data: {
        opts: ClusterAdapter.serializeOptions(opts),
        close,
      },
    });
  }

  private getExpectedResponseCount() {
    return this.workerIds.size;
  }

  async fetchSockets(opts: BroadcastOptions): Promise<any[]> {
    const localSockets = await super.fetchSockets(opts);
    const expectedResponseCount = this.getExpectedResponseCount();

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
      }, this.requestsTimeout);

      const storedRequest = {
        type: EventType.FETCH_SOCKETS,
        resolve,
        timeout,
        current: 0,
        expected: expectedResponseCount,
        responses: localSockets,
      };
      this.requests.set(requestId, storedRequest);

      this.publish({
        type: EventType.FETCH_SOCKETS,
        data: {
          requestId,
          workerId: cluster.worker.id,
          opts: ClusterAdapter.serializeOptions(opts),
        },
      });
    });
  }

  public serverSideEmit(packet: any[]): void {
    const withAck = typeof packet[packet.length - 1] === "function";

    if (withAck) {
      this.serverSideEmitWithAck(packet).catch(() => {
        // ignore errors
      });
      return;
    }

    this.publish({
      type: EventType.SERVER_SIDE_EMIT,
      data: {
        packet,
      },
    });
  }

  private async serverSideEmitWithAck(packet: any[]) {
    const ack = packet.pop();
    const expectedResponseCount = this.getExpectedResponseCount();

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
    }, this.requestsTimeout);

    const storedRequest = {
      type: EventType.FETCH_SOCKETS,
      resolve: ack,
      timeout,
      current: 0,
      expected: expectedResponseCount,
      responses: [],
    };
    this.requests.set(requestId, storedRequest);

    this.publish({
      type: EventType.SERVER_SIDE_EMIT,
      data: {
        requestId, // the presence of this attribute defines whether an acknowledgement is needed
        workerId: cluster.worker.id,
        packet,
      },
    });
  }
}

export function setupPrimary() {
  cluster.on("message", (worker, message) => {
    const isValidSource = message?.source === MESSAGE_SOURCE;
    if (!isValidSource) {
      return;
    }

    switch (message.type) {
      case EventType.FETCH_SOCKETS_RESPONSE:
      case EventType.SERVER_SIDE_EMIT_RESPONSE:
        const workerId = message.data.workerId;
        // emit back to the requester
        if (hasOwnProperty.call(cluster.workers, workerId)) {
          cluster.workers[workerId].send(message, null, ignoreError);
        }
        break;
      default:
        const emitterIdAsString = "" + worker.id;
        // emit to all workers but the requester
        for (const workerId in cluster.workers) {
          if (
            hasOwnProperty.call(cluster.workers, workerId) &&
            workerId !== emitterIdAsString
          ) {
            cluster.workers[workerId].send(message, null, ignoreError);
          }
        }
    }
  });

  cluster.on("exit", (worker) => {
    // notify all active workers
    for (const workerId in cluster.workers) {
      if (hasOwnProperty.call(cluster.workers, workerId)) {
        cluster.workers[workerId].send(
          {
            source: MESSAGE_SOURCE,
            type: EventType.WORKER_EXIT,
            data: worker.id,
          },
          null,
          ignoreError
        );
      }
    }
  });
}
