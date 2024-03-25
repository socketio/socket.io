import { Server } from "socket.io";
import { Server as Engine } from "engine.io";

const engine = new Engine({
  pingInterval: 2000
});

const io = new Server();

io.bind(engine);

io.on("connection", (socket) => {
  // ...
});

let once = true;

export default function handler(req, res) {
  if (once) {
    once = false;
    const server = req.socket.server;

    // the default listener closes the websocket connection if the path does not match "/_next/webpack-hmr"
    // see https://github.com/vercel/next.js/blob/f9d73cc2fa710a7ba90ee28f7783a8f05ea62b3a/packages/next/src/server/lib/router-server.ts#L669-L671
    const defaultListener = server.listeners("upgrade")[0];
    server.removeAllListeners("upgrade");

    server.on("upgrade", (req, socket, head) => {
      if (req.url.startsWith("/api/socket.io")) {
        engine.handleUpgrade(req, socket, head);
      } else {
        defaultListener.call(server, req, socket, head);
      }
    });
  }

  engine.handleRequest(req, res);
}

export const config = {
  api: {
    bodyParser: false, // prevents body parsing
    externalResolver: true, // prevents "this may result in stalled requests" warnings
  },
}
