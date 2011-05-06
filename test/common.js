
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Test dependencies.
 */

var io = require('socket.io')
  , should = module.exports = require('should')
  , http = require('http')
  , https = require('https');

/**
 * Get utility.
 */

get = function (opts, fn) {
  opts = opts || {};
  opts.path = opts.path.replace(/{protocol}/g, io.protocol);
  opts.headers = {
      'Host': 'localhost'
    , 'Connection': 'Keep-Alive'
  };

  var req = (opts.secure ? https : http).request(opts, function (res) {
    var buf = '';

    res.on('data', function (chunk) {
      buf += chunk;
    });

    res.on('end', function () {
      fn(res, buf);
    });
  });

  req.end();
  return req;
};

/**
 * Handshake utility
 */

handshake = function (port, fn) {
  get({
      port: port
    , path: '/socket.io/{protocol}'
  }, function (res, data) {
    fn.apply(null, data.split(':'));
  });
};

/**
 * Silence logging.
 */

var old = io.listen;

io.listen = function () {
  console.log('');
  return old.apply(this, arguments);
};
