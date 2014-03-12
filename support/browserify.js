
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
  opts.builtins = false;
  opts.entries = [path];
  var bundle = {};
  bundle.standalone = 'io';
  bundle.insertGlobalVars = ['global'];
  browserify(opts).bundle(bundle, fn);
}
