
/*!
 * Socket.IO
 * Copyright (c) 2010-2011 Guillermo Rauch <guillermo@learnboost.com>
 * MIT Licensed
 */

/**
 * Listener creation shorcut
 *
 * @param {Server} node HTTP server
 * @param {Object} options
 * @api public
 */

exports.listen = function(server, options){
  return new exports.Listener(server, options);
};

/**
 * Listener constructor
 *
 * @api public
 */

exports.Listener = require('./listener');

/**
 * Version
 */

exports.version = '0.6.17';
