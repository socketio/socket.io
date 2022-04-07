import cluster from "cluster";
import { createServer } from "http";
import { setupMaster } from "@socket.io/sticky";
import { cpus } from "os";

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  const httpServer = createServer();

  setupMaster(httpServer, {
    loadBalancingMethod: "least-connection",
  });

  httpServer.listen(3000);

  for (let i = 0; i < cpus().length; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  console.log(`Worker ${process.pid} started`);

  import("./index.js");
}
