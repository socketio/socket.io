
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Test dependencies.
 */

var io = require('socket.io')
  , parser = io.parser
  , http = require('http')
  , https = require('https');

/**
 * Exports should.
 */

var should = module.exports = require('should');

/**
 * Request utility.
 */

req = function (path, port, opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  opts = opts || {};
  opts.port = port;
  opts.path = path.replace(/{protocol}/g, io.protocol);
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
      fn && fn(res, opts.parse ? opts.parse(buf) : buf);
    });
  });

  req.on('error', function (err) {
    console.error(err);
  });

  req.end();

  return req;
};

/**
 * GET request utility.
 */

get = function (url, port, opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  opts = opts || {};
  opts.method = 'GET';

  // override the parser for transport requests
  if (/\/(xhr-polling|htmlfile|jsonp-polling)\//.test(opts.url)) {
    // parser that might be necessary for transport-specific framing
    var transportParse = opts.parse;
    opts.parse = function (data) {
      if (data === '') return data;

      data = transportParser ? transportParser(data) : data;
      return parser.decodePayload(data);
    };
  }

  return req(url, port, opts, fn);
};

/**
 * POST request utility.
 */

post = function (url, port, opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  opts = opts || {};
  opts.method = 'METHOD';

  return req(url, ports, opts, fn);
};

/**
 * Handshake utility
 */

handshake = function (port, opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  get('/socket.io/{protocol}', port, opts, function (res, data) {
    fn && fn.apply(null, data.split(':'));
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
