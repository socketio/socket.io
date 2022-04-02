import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import session from "express-session";

const port = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);

const sessionMiddleware = session({
  secret: "changeit",
  resave: true,
  saveUninitialized: true,
});

app.use(sessionMiddleware);

app.get("/", (req, res) => {
  res.sendFile("./index.html", { root: process.cwd() });
});

app.post("/incr", (req, res) => {
  const session = req.session;
  session.count = (session.count || 0) + 1;
  res.status(200).end("" + session.count);
});

app.post("/logout", (req, res) => {
  const sessionId = req.session.id;
  req.session.destroy(() => {
    // disconnect all Socket.IO connections linked to this session ID
    io.to(sessionId).disconnectSockets();
    res.status(204).end();
  });
});

const io = new Server(httpServer, {
  allowRequest: (req, callback) => {
    // with HTTP long-polling, we have access to the HTTP response here, but this is not
    // the case with WebSocket, so we provide a dummy response object
    const fakeRes = {
      getHeader() {
        return [];
      },
      setHeader(key, values) {
        req.cookieHolder = values[0];
      },
      writeHead() {},
    };
    sessionMiddleware(req, fakeRes, () => {
      if (req.session) {
        // trigger the setHeader() above
        fakeRes.writeHead();
        // manually save the session (normally triggered by res.end())
        req.session.save();
      }
      callback(null, true);
    });
  },
});

io.engine.on("initial_headers", (headers, req) => {
  if (req.cookieHolder) {
    headers["set-cookie"] = req.cookieHolder;
    delete req.cookieHolder;
  }
});

io.on("connect", (socket) => {
  const req = socket.request;

  socket.join(req.session.id);

  socket.on("incr", (cb) => {
    req.session.reload((err) => {
      if (err) {
        // session has expired
        return socket.disconnect();
      }
      req.session.count = (req.session.count || 0) + 1;
      req.session.save(() => {
        cb(req.session.count);
      });
    });
  });
});

httpServer.listen(port, () => {
  console.log(`application is running at: http://localhost:${port}`);
});
