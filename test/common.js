const eio = require("..");

/**
 * Listen shortcut that fires a callback on an ephemeral port.
 */

exports.listen = (opts, fn) => {
  if ("function" === typeof opts) {
    fn = opts;
    opts = {};
  }

  const e = eio.listen(0, opts, () => {
    fn(e.httpServer.address().port);
  });

  return e;
};

/**
 * Sprintf util.
 */

require("s").extend();
