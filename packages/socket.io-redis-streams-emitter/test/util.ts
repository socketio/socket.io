import { createServer } from "node:http";
import { type AddressInfo } from "node:net";
import { createClient, createCluster } from "redis";
import { Redis, Cluster } from "ioredis";
import { Server, type Socket as ServerSocket } from "socket.io";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import { createAdapter } from "@socket.io/redis-streams-adapter";

export function times(count: number, fn: () => void) {
  let i = 0;
  return () => {
    i++;
    if (i === count) {
      fn();
    } else if (i > count) {
      throw new Error(`too many calls: ${i} instead of ${count}`);
    }
  };
}

export function sleep(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

const mode = process.env.REDIS_CLUSTER === "1" ? "cluster" : "standalone";
const lib = process.env.REDIS_LIB || "redis";

console.log(`[INFO] testing in ${mode} mode with ${lib}`);

export async function initRedisClient() {
  if (mode === "cluster") {
    if (lib === "ioredis") {
      return new Cluster([
        {
          host: "localhost",
          port: 7000,
        },
        {
          host: "localhost",
          port: 7001,
        },
        {
          host: "localhost",
          port: 7002,
        },
        {
          host: "localhost",
          port: 7003,
        },
        {
          host: "localhost",
          port: 7004,
        },
        {
          host: "localhost",
          port: 7005,
        },
      ]);
    } else {
      const redisClient = createCluster({
        rootNodes: [
          {
            url: "redis://localhost:7000",
          },
          {
            url: "redis://localhost:7001",
          },
          {
            url: "redis://localhost:7002",
          },
          {
            url: "redis://localhost:7003",
          },
          {
            url: "redis://localhost:7004",
          },
          {
            url: "redis://localhost:7005",
          },
        ],
      });

      await redisClient.connect();

      return redisClient;
    }
  } else {
    if (lib === "ioredis") {
      return new Redis();
    } else {
      const port = process.env.VALKEY === "1" ? 6389 : 6379;
      const redisClient = createClient({
        url: `redis://localhost:${port}`,
      });
      await redisClient.connect();

      return redisClient;
    }
  }
}

async function init() {
  const redisClient = await initRedisClient();

  const httpServer = createServer();
  const io = new Server(httpServer, {
    adapter: createAdapter(redisClient, {
      readCount: 1, // return as soon as possible
    }),
  });

  return new Promise<{
    io: Server;
    socket: ServerSocket;
    clientSocket: ClientSocket;
    cleanup: () => void;
  }>((resolve) => {
    httpServer.listen(() => {
      const port = (httpServer.address() as AddressInfo).port;
      const clientSocket = ioc(`http://localhost:${port}`);

      io.on("connection", async (socket) => {
        resolve({
          io,
          socket,
          clientSocket,
          cleanup: () => {
            io.close();
            clientSocket.disconnect();
            redisClient.quit();
          },
        });
      });
    });
  });
}

export async function setup() {
  const results = await Promise.all([init(), init(), init()]);

  const servers = results.map(({ io }) => io) as [Server, Server, Server];
  const serverSockets = results.map(({ socket }) => socket) as [
    ServerSocket,
    ServerSocket,
    ServerSocket,
  ];
  const clientSockets = results.map(({ clientSocket }) => clientSocket) as [
    ClientSocket,
    ClientSocket,
    ClientSocket,
  ];
  const cleanupMethods = results.map(({ cleanup }) => cleanup);

  return {
    servers,
    serverSockets,
    clientSockets,
    cleanup: () => {
      for (const cleanup of cleanupMethods) {
        cleanup();
      }
    },
  };
}
