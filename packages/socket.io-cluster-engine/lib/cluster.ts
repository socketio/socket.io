import cluster from "node:cluster";
import { type ServerOptions } from "engine.io";
import { ClusterEngine, type Message } from "./engine";
import debugModule from "debug";

const debug = debugModule("engine:cluster");
const MESSAGE_SOURCE = "_eio";
const kNodeId = Symbol("nodeId");

function ignoreError() {}

export function setupPrimary() {
  cluster.on("message", (sourceWorker, message: { _source?: string }) => {
    if (message._source !== MESSAGE_SOURCE) {
      debug("ignore message from unknown source");
      return;
    }

    if (!sourceWorker[kNodeId]) {
      sourceWorker[kNodeId] = (message as Message).senderId;
    }

    // @ts-expect-error recipientId is not defined for all messages
    let recipientId = (message as Message).recipientId;
    if (recipientId) {
      for (const worker of Object.values(cluster.workers)) {
        if (worker[kNodeId] === recipientId) {
          debug("forward message to worker %d", worker.id);
          worker.send(message, null, ignoreError);
          return;
        }
      }
    }

    debug("forward message to all other workers");
    for (const worker of Object.values(cluster.workers)) {
      if (worker.id !== sourceWorker.id) {
        worker.send(message, null, ignoreError);
      }
    }
  });
}

export class NodeClusterEngine extends ClusterEngine {
  constructor(opts?: ServerOptions) {
    super(opts);

    process.on("message", (message: Message & { _source?: string }) => {
      if (message._source !== MESSAGE_SOURCE) {
        debug("ignore message from unknown source");
        return;
      }

      debug("received message: %j", message);
      this.onMessage(message);
    });
  }

  override publishMessage(message: Message & { _source?: string }) {
    message._source = MESSAGE_SOURCE;

    debug("send message to primary");
    process.send(message, null, { swallowErrors: true }, ignoreError);
  }
}
