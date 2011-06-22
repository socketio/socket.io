
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var http = require('http')
  , https = require('https')
  , client = require('socket.io-client');

/**
 * Version.
 */

exports.version = '0.7.2';

/**
 * Supported protocol version.
 */

exports.protocol = 1;

/**
 * Client that we serve.
 */

exports.clientVersion = client.version;

/**
 * Attaches a manager
 *
 * @api public
 */

exports.listen = function (server, options, fn) {
  if ('function' == typeof options) {
    fn = options;
    options = {};
  }

  if ('undefined' == typeof server) {
    // create a server that listens on port 80
    server = 80;
  }

  if ('number' == typeof server) {
    // if a port number is passed
    var port = server;

    if (options && options.key)
      server = https.createServer(options, server);
    else
      server = http.createServer();

    // default response
    server.on('request', function (req, res) {
      res.writeHead(200);
      res.end('Welcome to socket.io.');
    });

    server.listen(port, fn);
  }

  // otherwise assume a http/s server
  return new exports.Manager(server);
};

/**
 * Manager constructor.
 *
 * @api public
 */

exports.Manager = require('./manager');

/**
 * Transport constructor.
 *
 * @api public
 */

exports.Transport = require('./transport');

/**
 * Socket constructor.
 *
 * @api public
 */

exports.Socket = require('./socket');

/**
 * Store constructor.
 *
 * @api public
 */

exports.Store = require('./store');

/**
 * Parser.
 *
 * @api public
 */

exports.parser = require('./parser');
