
/**
 * Instrument.
 */

var fs = require('fs');

if (process.env.DEBUG) {
  require.extensions['.js'] = function(mod, filename){
    var js = fs.readFileSync(filename, 'utf8');

    // Profiling support
    js = js.replace(/^ *\/\/ *(start|end): *([^\n]+)/gm, function(_, type, expr){
      switch (type) {
        case 'start': return 'console.time(' + expr + ');';
        case 'end': return 'console.timeEnd(' + expr + ');';
      }
    });

    // Debugging
    js = js.replace(/^ *\/\/ *debug: *([^\n,]+) *([^\n]+)?/gm, function(_, fmt, args){
      fmt = fmt.replace(/"/g, '\\"');
      return 'console.error("  client\033[90m ' + fmt + '\033[0m"' + (args || '') + ');';
    });

    js = js.replace(/^ *\/\/ *assert: ([^,]+) *, *([^\n]+)/gm, function(_, expr, msg){
      return 'if (!(' + expr + ')) console.error("  client assert\033[31m %s. (%s)\033[0m", ' + msg + ', "' + expr + '");';
    });

    mod._compile(js, filename);
  };
}

/**
 * Expose `eio` global.
 */

eio = require('../');

/**
 * Expose client.
 */

eioc = require('engine.io-client');

/**
 * Expose `request` global.
 */

request = require('superagent');

/**
 * Expose `expect` global
 */

expect = require('expect.js');

/**
 * Listen shortcut that fires a callback on an epheemal port.
 */

listen = function (opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  var e = eio.listen(null, opts, function () {
    fn(e.httpServer.address().port);
  });

  return e;
}

/**
 * Sprintf util.
 */

require('s').extend();
