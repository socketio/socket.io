'use strict';

/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var WebSocket = require('./websocket');

/**
 * Export the constructor.
 */

exports = module.exports = FlashSocket;

/**
 * Flash flavor of WebSocket interface.
 *
 * @api public
 */

function FlashSocket() {
  WebSocket.apply(this, arguments);
  this.name = 'flashsocket';
};

/**
 * Inherits from WebSocket.
 */

FlashSocket.prototype.__proto__ = WebSocket.prototype;

/**
 * Start the flash policy file server
 *
 * @param {Manager} manager
 * @param {Array} array of allowed origins
 * @api public
 */

FlashSocket.startPolicyServer = function(manager, origins) {

  //
  // cache the answer
  //
  if (!origins) origins = ['*:*'];

  var policy = new Buffer(
    '<?xml version="1.0"?>\n<!DOCTYPE cross-domain-policy SYSTEM' +
    ' "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n<cross-domain-policy>\n' +
    origins.map(function(origin) {
      var parts = origin.split(':');
      return '<allow-access-from domain="' + parts[0] + '" to-ports="'+ parts[1] +'"/>';
    }) +
    '<allow-access-from domain="*" to-ports="*"/>\n' +
    '</cross-domain-policy>\n'
  );

  function answer(stream) {
    if (stream && (stream.readyState === 'open' || socket.readyState === 'writeOnly')) {
      stream.end(policy);
    }
  }

  //
  // always start inline server, since ports may be closed by firewall
  //
  manager.server.on('connection', function(stream) {
    stream.once('data', function (data) {
      // only check the initial data
      // N.B. if we ever will throw here, we should check for data != null first
      if (data[0] === 60 && data.toString() === '<policy-file-request/>\0') {
        manager.log.debug('answering flash policy request inline');
        answer(stream);
      }
    });
  });
  manager.log.info('inline flash policy server started');

  //
  // try to listen to well known flash policy ports,
  // to provide faster answers
  //
  var server = require('net').createServer(function(stream) {
    stream.on('error', function(err) {
      if (stream && stream.end) {
        stream.end();
        stream.destroy();
      }
    });
    manager.log.debug('answering flash policy request');
    answer(stream);
  });

  function tryListen(port) {
    if (!port) return;
    try {
      server.listen(port);
      manager.log.info('standard flash policy server started on port', port);
      return true;
    } catch(err) {
      if (err.errno !== 13) throw err;
      manager.log.warn('your node instance does not have sufficient privileges to bind to port', port);
    }
  }

  tryListen(843)
    || tryListen(manager.get('flash policy server port'))
    || manager.log.warn('standard flash policy server not started');
};
