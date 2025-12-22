if (process.env.EIO_CLIENT === "3") {
  // we need the WebSocket object provided by the "ws" library to test the SSL certs and HTTP headers so we hide the now built-in WebSocket constructor
  // ref: https://nodejs.org/api/globals.html#class-websocket
  global.WebSocket = null;
}

const { listen, uServer } = require("..");
const { Socket } =
  process.env.EIO_CLIENT === "3"
    ? require("engine.io-client-v3")
    : require("engine.io-client");

switch (process.env.EIO_WS_ENGINE) {
  case "uws":
    console.log(
      "[WARN] testing with uWebSockets.js instead of Node.js built-in HTTP server",
    );
    break;
  case "eiows":
    console.log("[WARN] testing with eiows instead of ws");
    break;
}

/**
 * Listen shortcut that fires a callback on an ephemeral port.
 */

exports.listen = (opts, fn) => {
  if ("function" === typeof opts) {
    fn = opts;
    opts = {};
  }

  opts.allowEIO3 = true;

  if (process.env.EIO_WS_ENGINE === "uws") {
    const { App, us_socket_local_port } = require("uWebSockets.js");
    const engine = new uServer(opts);
    const app = App();
    engine.attach(app, opts);

    app.listen(0, (listenSocket) => {
      const port = us_socket_local_port(listenSocket);
      process.nextTick(() => {
        fn(port);
      });
    });

    return engine;
  }

  if (process.env.EIO_WS_ENGINE === "eiows") {
    opts.wsEngine = require("eiows").Server;
  }

  const e = listen(0, opts, () => {
    fn(e.httpServer.address().port);
  });

  return e;
};

exports.ClientSocket = Socket;

exports.createPartialDone = (done, count) => {
  let i = 0;
  return () => {
    if (++i === count) {
      done();
    } else if (i > count) {
      done(new Error(`partialDone() called too many times: ${i} > ${count}`));
    }
  };
};
