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
