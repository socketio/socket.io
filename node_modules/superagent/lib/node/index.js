
/*!
 * superagent
 * Copyright (c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Stream = require('stream').Stream
  , formidable = require('formidable')
  , Response = require('./response')
  , parse = require('url').parse
  , format = require('url').format
  , methods = require('methods')
  , utils = require('./utils')
  , Part = require('./part')
  , mime = require('mime')
  , https = require('https')
  , http = require('http')
  , fs = require('fs')
  , qs = require('qs');

/**
 * Expose the request function.
 */

exports = module.exports = request;

/**
 * Expose `Part`.
 */

exports.Part = Part;

/**
 * Noop.
 */

function noop(){};

/**
 * Expose `Response`.
 */

exports.Response = Response;

/**
 * Define "form" mime type.
 */

mime.define({
  'application/x-www-form-urlencoded': ['form', 'urlencoded', 'form-data']
});

/**
 * Protocol map.
 */

exports.protocols = {
    'http:': http
  , 'https:': https
};

/**
 * Check if `obj` is an object.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isObject(obj) {
  return null != obj && 'object' == typeof obj;
}

/**
 * Default serialization map.
 * 
 *     superagent.serialize['application/xml'] = function(obj){
 *       return 'generated xml here';
 *     };
 * 
 */

exports.serialize = {
    'application/x-www-form-urlencoded': qs.stringify
  , 'application/json': JSON.stringify
};

/**
 * Default parsers.
 * 
 *     superagent.parse['application/xml'] = function(res, fn){
 *       fn(null, result);
 *     };
 * 
 */

exports.parse = require('./parsers');

/**
 * Initialize a new `Request` with the given `method` and `url`.
 *
 * @param {String} method
 * @param {String|Object} url
 * @api public
 */

function Request(method, url) {
  var self = this;
  if ('string' != typeof url) url = format(url);
  this.method = method;
  this.url = url;
  this.header = {};
  this.writable = true;
  this._redirects = 0;
  this.redirects(5);
  this._buffer = true;
  this.attachments = [];
  this.on('response', function(res){
    self.callback(null, res);
  });
}

/**
 * Inherit from `Stream.prototype`.
 */

Request.prototype.__proto__ = Stream.prototype;

/**
 * Queue the given `file` as an attachment
 * with optional `filename`.
 *
 * @param {String} file
 * @param {String} filename
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.attach = function(file, filename){
  this.attachments.push({
      name: file
    , part: new Part(this)
    , filename: filename
  });
  return this;
};

/**
 * Set the max redirects to `n`.
 *
 * @param {Number} n
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.redirects = function(n){
  this._maxRedirects = n;
  return this;
};

/**
 * Return a new `Part` for this request.
 *
 * @return {Part}
 * @api public
 */

Request.prototype.part = function(){
  return new Part(this);
};

/**
 * Set header `field` to `val`, or multiple fields with one object.
 *
 * Examples:
 *
 *      req.get('/')
 *        .set('Accept', 'application/json')
 *        .set('X-API-Key', 'foobar')
 *        .end(callback);
 *
 *      req.get('/')
 *        .set({ Accept: 'application/json', 'X-API-Key': 'foobar' })
 *        .end(callback);
 *
 * @param {String|Object} field
 * @param {String} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.set = function(field, val){
  if (isObject(field)) {
    for (var key in field) {
      this.set(key, field[key]);
    }
    return this;
  }
  this.request().setHeader(field, val);
  return this;
};

/**
 * Get request header `field`.
 *
 * @param {String} field
 * @return {String}
 * @api public
 */

Request.prototype.get = function(field){
  return this.request().getHeader(field);
};

/**
 * Set _Content-Type_ response header passed through `mime.lookup()`.
 *
 * Examples:
 *
 *      request.post('/')
 *        .type('xml')
 *        .send(xmlstring)
 *        .end(callback);
 *      
 *      request.post('/')
 *        .type('json')
 *        .send(jsonstring)
 *        .end(callback);
 *
 *      request.post('/')
 *        .type('application/json')
 *        .send(jsonstring)
 *        .end(callback);
 *
 * @param {String} type
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.type = function(type){
  return this.set('Content-Type', ~type.indexOf('/')
    ? type
    : mime.lookup(type));
};

/**
 * Add `obj` to the query-string, later formatted
 * in `.end()`.
 *
 * @param {Object} obj
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.query = function(obj){
  var req = this.request();
  var query = qs.stringify(obj);
  if (!query.length) return this;
  req.path += (~req.path.indexOf('?') ? '&' : '?') + query;
  return this;
};

/**
 * Send `data`, defaulting the `.type()` to "json" when
 * an object is given.
 *
 * Examples:
 *
 *       // manual json
 *       request.post('/user')
 *         .type('json')
 *         .send('{"name":"tj"}')
 *         .end(callback)
 *       
 *       // auto json
 *       request.post('/user')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *       
 *       // manual x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send('name=tj')
 *         .end(callback)
 *       
 *       // auto x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // string defaults to x-www-form-urlencoded
 *       request.post('/user')
 *         .send('name=tj')
 *         .send('foo=bar')
 *         .send('bar=baz')
 *         .end(callback)
 *
 * @param {String|Object} data
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.send = function(data){
  if ('GET' == this.method) return this.query(data);
  var obj = isObject(data);
  var req = this.request();
  var type = req.getHeader('Content-Type');

  // merge
  if (obj && isObject(this._data)) {
    for (var key in data) {
      this._data[key] = data[key];
    }
  // string
  } else if ('string' == typeof data) {
    // default to x-www-form-urlencoded
    if (!type) this.type('form');
    type = req.getHeader('Content-Type');

    // concat &
    if ('application/x-www-form-urlencoded' == type) {
      this._data = this._data
        ? this._data + '&' + data
        : data;
    } else {
      this._data = (this._data || '') + data;
    }
  } else {
    this._data = data;
  }

  if (!obj) return this;

  // default to json
  if (!type) this.type('json');
  return this;
};

/**
 * Write raw `data` / `encoding` to the socket.
 *
 * @param {Buffer|String} data
 * @param {String} encoding
 * @return {Boolean}
 * @api public
 */

Request.prototype.write = function(data, encoding){
  return this.request().write(data, encoding);
};

/**
 * Pipe the request body to `stream`.
 *
 * @param {Stream} stream
 * @param {Object} options
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.pipe = function(stream, options){
  this.preventBuffer();
  return this.end().req.on('response', function(res){
    res.pipe(stream, options);
  });
};

/**
 * Prevent buffering.
 *
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.preventBuffer = function(){
  this._buffer = false;
  return this;
};

/**
 * Redirect to `url
 *
 * @param {IncomingMessage} res
 * @return {Request} for chaining
 * @api private
 */

Request.prototype.redirect = function(res){
  var url = res.headers.location;
  delete this.req;
  this.method = 'HEAD' == this.method
    ? this.method
    : 'GET';
  this._data = null;
  this.url = url;
  this.emit('redirect', res);
  this.end(this._callback);
  return this;
};

/**
 * Set Authorization field value with `user` and `pass`.
 *
 * @param {String} user
 * @param {String} pass
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.auth = function(user, pass){
  var str = new Buffer(user + ':' + pass).toString('base64');
  return this.set('Authorization', 'Basic ' + str);
};

/**
 * Write the field `name` and `val`.
 *
 * @param {String} name
 * @param {String} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.field = function(name, val){
  this.part()
    .name(name)
    .write(val);
  return this;
};

/**
 * Return an http[s] request.
 *
 * @return {OutgoingMessage}
 * @api private
 */

Request.prototype.request = function(){
  if (this.req) return this.req;
  var self = this
    , options = {}
    , data = this._data
    , url = this.url;

  // default to http://
  if (0 != url.indexOf('http')) url = 'http://' + url;
  url = parse(url, true);

  // options
  options.method = this.method;
  options.port = url.port;
  options.path = url.pathname;
  options.host = url.hostname;

  // initiate request
  var mod = exports.protocols[url.protocol];

  // request
  var req = this.req = mod.request(options);

  // expose events
  req.on('drain', function(){ self.emit('drain'); });
  req.on('error', function(err){ self.emit('error', err); });

  // auth
  if (url.auth) {
    var auth = url.auth.split(':');
    this.auth(auth[0], auth[1]);
  }

  // query
  this.query(url.query);

  return req;
};

/**
 * Invoke the callback with `err` and `res`
 * and handle arity check.
 *
 * @param {Error} err
 * @param {Response} res
 * @api private
 */

Request.prototype.callback = function(err, res){
  var fn = this._callback;
  if (2 == fn.length) return fn(err, res);
  fn(res); // TODO: emit error
};

/**
 * Initiate request, invoking callback `fn(err, res)`
 * with an instanceof `Response`.
 *
 * @param {Function} fn
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.end = function(fn){
  var self = this
    , data = this._data
    , req = this.request()
    , buffer = this._buffer
    , method = this.method;

  // store callback
  this._callback = fn || noop;

  // body
  switch (method) {
    case 'GET':
    case 'HEAD':
      break;
    default:
      if (req._headerSent) break;
      // serialize stuff
      if ('string' != typeof data) {
        var serialize = exports.serialize[req.getHeader('Content-Type')];
        if (serialize) data = serialize(data);
      }

      // content-length
      if (data && !req.getHeader('Content-Length')) {
        this.set('Content-Length', Buffer.byteLength(data));
      }
  }

  // response
  req.on('response', function(res){
    var max = self._maxRedirects
      , type = res.headers['content-type'] || ''
      , multipart = ~type.indexOf('multipart')
      , redirect = isRedirect(res.statusCode);

    // redirect
    if (redirect && self._redirects++ != max) {
      return self.redirect(res);
    }

    // zlib support
    if (/^(deflate|gzip)$/.test(res.headers['content-encoding'])) {
      utils.unzip(req, res);
    }

    // don't buffer multipart
    if (multipart) buffer = false;

    // TODO: make all parsers take callbacks
    if (multipart) {
      var form = new formidable.IncomingForm;

      form.parse(res, function(err, fields, files){
        if (err) throw err;
        // TODO: handle error
        // TODO: emit formidable events, parse json etc
        var response = new Response(req, res);
        response.body = fields;
        response.files = files;
        self.emit('end');
        self.callback(null, response);
      });
      return;
    }

    // buffered response
    // TODO: optional
    if (buffer) {
      res.text = '';
      res.setEncoding('utf8');
      res.on('data', function(chunk){ res.text += chunk; });
    }

    // parser
    var parse = exports.parse[utils.type(res.headers['content-type'] || '')];
    if (parse) {
      parse(res, function(err, obj){
        // TODO: handle error
        res.body = obj;
      });
    }

    // end event
    self.res = res;
    res.on('end', function(){
      // TODO: unless buffering emit earlier to stream
      self.emit('response', new Response(self.req, self.res));
      self.emit('end');
    });
  });

  if (this.attachments.length) return this.writeAttachments();

  // multi-part boundary
  if (this._boundary) this.writeFinalBoundary();

  req.end(data);
  return this;
};

/**
 * Write the final boundary.
 *
 * @api private
 */

Request.prototype.writeFinalBoundary = function(){
  this.request().write('\r\n--' + this._boundary + '--');
};

/**
 * Write the attachments in sequence.
 *
 * @api private
 */

Request.prototype.writeAttachments = function(){
  var files = this.attachments
    , req = this.request()
    , self = this;

  function next() {
    var file = files.shift();
    if (!file) {
      self.writeFinalBoundary();
      return req.end();
    }

    // custom filename
    if (file.filename) {
      file.part.type(file.name);
      file.part.set('Content-Disposition', 'attachment; filename="' + file.filename + '"');
    } else {
      file.part.filename(file.name);
    }

    var stream = fs.createReadStream(file.name);

    // TODO: pipe
    // TODO: handle errors
    stream.on('data', function(data){
      file.part.write(data);
    }).on('error', function(err){
      self.emit('error', err);
    }).on('end', next);
  }

  next();
};

/**
 * Expose `Request`.
 */

exports.Request = Request;

/**
 * Issue a request:
 *
 * Examples:
 *
 *    request('GET', '/users').end(callback)
 *    request('/users').end(callback)
 *    request('/users', callback)
 *
 * @param {String} method
 * @param {String|Function} url or callback
 * @return {Request}
 * @api public
 */

function request(method, url) {
  // callback
  if ('function' == typeof url) {
    return new Request('GET', method).end(url);
  }

  // url first
  if (1 == arguments.length) {
    return new Request('GET', method);
  }

  return new Request(method, url);
}

// generate HTTP verb methods

methods.forEach(function(method){
  var name = 'delete' == method
    ? 'del'
    : method;

  method = method.toUpperCase();
  request[name] = function(url, fn){
    var req = request(method, url);
    fn && req.end(fn);
    return req;
  };
});

/**
 * Check if we should follow the redirect `code`.
 *
 * @param {Number} code
 * @return {Boolean}
 * @api private
 */

function isRedirect(code) {
  return ~[301, 302, 303, 305, 307].indexOf(code);
}
