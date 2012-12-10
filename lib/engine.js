
/**
 * Module dependencies.
 */

var engine;

try {
  engine = require('engine.io-client');
} catch(e){
  engine = require('engine.io');
}

/**
 * Module exports.
 */

module.exports = engine;
