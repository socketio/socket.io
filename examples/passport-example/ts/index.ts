import express = require("express");
import { createServer } from "http";
import { Server } from "socket.io";
import session from "express-session";
import { type Request, type Response } from "express";
import bodyParser = require("body-parser");
import passport = require("passport");
import { Strategy as LocalStrategy } from "passport-local";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
    }
  }
}

const port = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);

const sessionMiddleware = session({
  secret: "changeit",
  resave: true,
  saveUninitialized: true,
});

app.use(sessionMiddleware);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());
app.use(passport.session());

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get("/", (req, res) => {
  if (!req.user) {
    return res.redirect("/login");
  }
  res.sendFile(join(__dirname, "index.html"));
});

app.get("/login", (req, res) => {
  if (req.user) {
    return res.redirect("/");
  }
  res.sendFile(join(__dirname, "login.html"));
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/",
  }),
);

app.post("/logout", (req, res) => {
  const sessionId = req.session.id;
  req.session.destroy(() => {
    // disconnect all Socket.IO connections linked to this session ID
    io.to(`session:${sessionId}`).disconnectSockets();
    res.status(204).end();
  });
});

passport.use(
  new LocalStrategy((username, password, done) => {
    if (username === "john" && password === "changeit") {
      console.log("authentication OK");
      return done(null, { id: 1, username });
    } else {
      console.log("wrong credentials");
      return done(null, false);
    }
  }),
);

passport.serializeUser((user, cb) => {
  console.log(`serializeUser ${user.id}`);
  cb(null, user);
});

passport.deserializeUser((user: Express.User, cb) => {
  console.log(`deserializeUser ${user.id}`);
  cb(null, user);
});

const io = new Server(httpServer);

function onlyForHandshake(
  middleware: (req: Request, res: Response, next: any) => void,
) {
  return (
    req: Request & { _query: Record<string, string> },
    res: Response,
    next: (err?: Error) => void,
  ) => {
    const isHandshake = req._query.sid === undefined;
    if (isHandshake) {
      middleware(req, res, next);
    } else {
      next();
    }
  };
}

io.engine.use(onlyForHandshake(sessionMiddleware));
io.engine.use(onlyForHandshake(passport.session()));
io.engine.use(
  onlyForHandshake((req, res, next) => {
    if (req.user) {
      next();
    } else {
      res.writeHead(401);
      res.end();
    }
  }),
);

io.on("connection", (socket) => {
  const req = socket.request as Request & { user: Express.User };

  socket.join(`session:${req.session.id}`);
  socket.join(`user:${req.user.id}`);

  socket.on("whoami", (cb) => {
    cb(req.user.username);
  });
});

httpServer.listen(port, () => {
  console.log(`application is running at: http://localhost:${port}`);
});
