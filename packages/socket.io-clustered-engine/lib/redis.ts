import { ClusterEngine, type Message } from "./engine";
import { encode, decode } from "@msgpack/msgpack";
import { type ServerOptions } from "engine.io";
import cluster from "node:cluster";
import { randomUUID } from "node:crypto";
import debugModule from "debug";

const debug = debugModule("engine:redis");
const MESSAGE_SOURCE = "_eio";
const kNodeId = Symbol("nodeId");

function ignoreError() {}

interface PrimaryWithRedisOptions {
  /**
   * The prefix for the Redis Pub/Sub channels.
   *
   * @default "engine.io"
   */
  channelPrefix?: string;
}

function channelName(prefix: string, nodeId?: string) {
  if (nodeId) {
    return prefix + "#" + nodeId + "#";
  } else {
    return prefix + "#";
  }
}

export function setupPrimaryWithRedis(
  pubClient: any,
  subClient: any,
  opts?: PrimaryWithRedisOptions
) {
  const primaryId = randomUUID();
  const prefix = opts?.channelPrefix || "engine.io";
  const channels = [channelName(prefix), channelName(prefix, primaryId)];

  debug("subscribing to redis channels: %s", channels);
  SUBSCRIBE(subClient, channels, (buffer: Buffer) => {
    let message: Message & { _source?: string; _primaryId?: string };
    try {
      message = decode(buffer) as Message;
    } catch (e) {
      debug("ignore malformed buffer");
      return;
    }

    if (message._source !== MESSAGE_SOURCE) {
      debug("ignore message from unknown source");
      return;
    }

    if (message._primaryId === primaryId) {
      debug("ignore message from self");
      return;
    }

    debug("received message: %j", message);

    // @ts-expect-error recipientId is not defined for all messages
    const recipientId = (message as Message).recipientId;
    if (recipientId) {
      for (const worker of Object.values(cluster.workers)) {
        if (worker[kNodeId] === recipientId) {
          debug("forward message to worker %d", worker.id);
          worker.send(message, null, ignoreError);
          return;
        }
      }
    }

    debug("forward message to all workers");
    for (const worker of Object.values(cluster.workers)) {
      worker.send(message, null, ignoreError);
    }
  });

  cluster.on(
    "message",
    (
      sourceWorker,
      message: Message & { _source?: string; _primaryId?: string }
    ) => {
      if (message._source !== MESSAGE_SOURCE) {
        debug("ignore message from unknown source");
        return;
      }

      if (!sourceWorker[kNodeId]) {
        sourceWorker[kNodeId] = (message as Message).senderId;
      }

      // @ts-expect-error recipientId is not defined for all messages
      let recipientId = message.recipientId;
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

      // @ts-expect-error recipientId is not defined for all messages
      const channel = channelName(prefix, message.recipientId);
      message._primaryId = primaryId;

      debug("publish message to channel %s", channel);
      pubClient.publish(channel, encode(message));
    }
  );
}

interface RedisEngineOptions extends ServerOptions {
  /**
   * The prefix for the Redis Pub/Sub channels.
   *
   * @default "engine.io"
   */
  channelPrefix?: string;
}

export class RedisEngine extends ClusterEngine {
  private readonly _pubClient: any;
  private readonly _channelPrefix: string;

  constructor(pubClient: any, subClient: any, opts?: RedisEngineOptions) {
    super(opts);
    this._pubClient = pubClient;
    this._channelPrefix = opts?.channelPrefix || "engine.io";
    const channels = [
      channelName(this._channelPrefix),
      channelName(this._channelPrefix, this._nodeId),
    ];

    debug("subscribing to redis channels: %s", channels);
    SUBSCRIBE(subClient, channels, (buffer: Buffer) => {
      let message: Message & { _source?: string; _primaryId?: string };
      try {
        message = decode(buffer) as Message;
      } catch (e) {
        debug("ignore malformed buffer");
        return;
      }

      if (message._source !== MESSAGE_SOURCE) {
        debug("ignore message from unknown source");
        return;
      }

      debug("received message: %j", message);
      this.onMessage(message);
    });
  }

  publishMessage(message: Message & { _source?: string }): void {
    // @ts-expect-error recipientId is not defined for all messages
    const channel = channelName(this._channelPrefix, message.recipientId);

    message._source = MESSAGE_SOURCE;

    debug("publish message to channel %s", channel);
    this._pubClient.publish(channel, Buffer.from(encode(message)));
  }
}

const RETURN_BUFFERS = true;

function SUBSCRIBE(
  redisClient: any,
  channels: string[],
  listener: (message: Buffer) => void
) {
  if (isRedisClient(redisClient)) {
    redisClient.subscribe(channels, listener, RETURN_BUFFERS);
  } else {
    redisClient.subscribe(channels);
    redisClient.on("messageBuffer", (_channel: Buffer, message: Buffer) =>
      listener(message)
    );
  }
}

/**
 * Whether the redis client comes from the 'redis' or the 'ioredis' package
 * @param redisClient
 */
function isRedisClient(redisClient: any) {
  return typeof redisClient.sSubscribe === "function";
}
