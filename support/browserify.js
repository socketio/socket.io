
/**
 * Module dependencies.
 */

var browserify = require('browserify');
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
  var opts = {
    builtins: false,
    entries: [path]
  };
  browserify(opts).bundle({ standalone: 'eio' }, fn);
}
