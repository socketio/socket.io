
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
  var opts = {};
  opts.entries = [path];
  opts.builtins = false;
  browserify(opts).bundle({ standalone: 'io' }, fn);
}
