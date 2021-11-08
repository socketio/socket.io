const { listen, uServer } = require("..");
const { App, us_socket_local_port } = require("uWebSockets.js");
const { Socket } =
  process.env.EIO_CLIENT === "3"
    ? require("engine.io-client-v3")
    : require("engine.io-client");

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
    const engine = new uServer(opts);
    const app = App();
    engine.attach(app, opts);

    app.listen(0, listenSocket => {
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
