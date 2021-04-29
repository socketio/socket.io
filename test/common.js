const eio = require("..");
const eioc =
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

  if (process.env.EIO_WS_ENGINE) {
    opts.wsEngine = require(process.env.EIO_WS_ENGINE).Server;
  }

  const e = eio.listen(0, opts, () => {
    fn(e.httpServer.address().port);
  });

  return e;
};

exports.eioc = eioc;

/**
 * Sprintf util.
 */

require("s").extend();

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
