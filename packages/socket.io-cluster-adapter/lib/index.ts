import cluster from "node:cluster";
import {
  ClusterAdapterWithHeartbeat,
  ClusterAdapterOptions,
  ClusterMessage,
  ServerId,
  ClusterResponse,
  MessageType,
} from "socket.io-adapter";
import debugModule from "debug";

const debug = debugModule("socket.io-cluster-adapter");
const MESSAGE_SOURCE = "_sio_adapter";
const hasOwnProperty = Object.prototype.hasOwnProperty;

function ignoreError() {}

/**
 * Returns a function that will create a NodeClusterAdapter instance.
 *
 * @param opts - additional options
 *
 * @public
 * @see https://nodejs.org/api/cluster.html
 */
export function createAdapter(opts: Partial<ClusterAdapterOptions> = {}) {
  return function (nsp: any) {
    return new NodeClusterAdapter(nsp, opts);
  };
}

export class NodeClusterAdapter extends ClusterAdapterWithHeartbeat {
  constructor(nsp: any, opts: ClusterAdapterOptions = {}) {
    super(nsp, opts);
    process.on("message", (message: any) => {
      const isValidSource = message?.source === MESSAGE_SOURCE;
      if (!isValidSource) {
        debug("[%s] ignore unknown source", this.uid);
        return;
      }

      // note: this check should be done in the onMessage() handler
      if (message.nsp !== this.nsp.name) {
        debug("[%s] ignore other namespace", this.uid);
        return;
      }

      this.onMessage(message);
    });

    // until https://github.com/socketio/socket.io/commit/f3e1f5ebdf59158d0c8d1e20f8230275617fb355 is released
    this.init();
  }

  protected override doPublish(message: ClusterMessage & { source: string }) {
    message.source = MESSAGE_SOURCE;

    process.send(message, null, {}, ignoreError);

    return Promise.resolve(""); // connection state recovery is not supported
  }

  protected override doPublishResponse(
    requesterUid: ServerId,
    response: ClusterResponse & { source: string; requesterUid: string },
  ) {
    response.source = MESSAGE_SOURCE;
    response.requesterUid = requesterUid;

    process.send(response, null, {}, ignoreError);

    return Promise.resolve();
  }
}

const UIDS = Symbol("uids");

export function setupPrimary() {
  cluster.on("message", (worker, message) => {
    const isValidSource = message?.source === MESSAGE_SOURCE;
    if (!isValidSource) {
      return;
    }

    // store the requester's uids (one per namespace) so that the response can be sent specifically to them
    worker[UIDS] = worker[UIDS] || new Set();
    worker[UIDS].add(message.uid);

    switch (message.type) {
      case MessageType.FETCH_SOCKETS_RESPONSE:
      case MessageType.SERVER_SIDE_EMIT_RESPONSE:
        const requesterUid = message.requesterUid;
        for (const workerId in cluster.workers) {
          if (
            hasOwnProperty.call(cluster.workers, workerId) &&
            cluster.workers[workerId][UIDS]?.has(requesterUid)
          ) {
            cluster.workers[workerId].send(message, null, ignoreError);
            break;
          }
        }
        break;
      default:
        const emitterIdAsString = String(worker.id);
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
}
