
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var ws = require('websocket.io');

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

function WebSocket (engine, req) {
  if (!engine.ws) {
    engine.ws = new ws.Server
  }
};
