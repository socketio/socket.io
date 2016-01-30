
/**
 * Module dependencies.
 */

var webpack = require('webpack');
var concat = require('concat-stream');
var path = require.resolve('../');

/**
 * Module exports.
 */

module.exports = build;

/**
 * Make the build.
 *
 * @api public
 */


function build(fn){
  var bundle = webpack({
    entry: "../index.js",
    output: {
        path: "../",
        filename: "engine.io.js"
    }
  }, function(err, stats) {
    if (err) {
      fn(err);
    } else{
      fn(null, stats.toString({ source: true }));
    }
  });
}

/**
 * Populates `global`.
 *
 * @api private
 */

function glob(){
  return 'typeof self !== "undefined" ? self : '
    + 'typeof window !== "undefined" ? window : '
    + 'typeof global !== "undefined" ? global : {}';
}
