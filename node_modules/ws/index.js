/*!
 * ws: a node.js websocket client
 * Copyright(c) 2011 Einar Otto Stangvik <einaros@gmail.com>
 * MIT Licensed
 */

module.exports = require('./lib/WebSocket');
module.exports.Server = require('./lib/WebSocketServer');
module.exports.Sender = require('./lib/Sender');
module.exports.Receiver = require('./lib/Receiver');
