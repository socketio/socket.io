
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var protocolVersions = require('./websocket/');

/**
 * Export the constructor.
 */

exports = module.exports = WebSocket;

/**
 * HTTP interface constructor. Interface compatible with all transports that
 * depend on request-response cycles.
 *
 * @api public
 */

function WebSocket (mng, data, req) {
  var version = req.headers['sec-websocket-version'];
  if (typeof version !== 'undefined' && typeof protocolVersions[version] !== 'undefined') {
    return new protocolVersions[version](mng, data, req);
  }
  return new protocolVersions['default'](mng, data, req);
};
