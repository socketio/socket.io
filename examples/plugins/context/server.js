#!/usr/bin/env node

'use strict';

/*!
 *
 *
 * A simple drop-in to make the current directory available
 * via http://*:8080
 *
 *
 * Copyright (c) 2011 Vladimir Dronnikov (dronnikov@gmail.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

var Fs = require('fs');

var pwd = process.cwd();
var ENOENT = require('constants').ENOENT;

function mime(url) {
  if (url.slice(-5) === '.html') return 'text/html';
  if (url.slice(-4) === '.css') return 'text/css';
  if (url.slice(-3) === '.js') return 'text/javascript';
  return 'text/plain';
}

var http = require('http').createServer(function(req, res) {
  if (req.url === '/') req.url = '/index.html';
  Fs.readFile(pwd + req.url, function(err, data) {
    if (err) {
      if (err.errno === ENOENT) {
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(500);
        res.end(err.stack);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': mime(req.url),
        'Content-Length': data.length
      });
      res.end(data);
    }
  });
}); http.listen(3000);
console.log('Listening to http://*:3000. Use Ctrl+C to stop.');

var io = require('socket.io');
io.use('context');
var ws = io.Context(http, {
  name: '/foo',
  'log level': 3,
  authorization: function(data, next) {
    data.session = {
      user: {
        id: 'dvv'
      }
    };
    next(null, true);
  }
});

ws.on('connection', function(client) {

  //
  // define a function in the context
  //
  client.update({
    timer: function(interval) {
      if (!interval && this.interval) {
        clearInterval(this.interval);
        delete this.interval;
        this.deep.tick('timer stopped');
        return;
      }
      if (interval && !this.interval) {
        this.interval = setInterval(function() {
          this.deep.tick('tick');
        }.bind(this), interval);
        this.deep.tick('timer started');
      }
    },
    updateEveryone: function() {
      client.namespace.update({that: 'is available to everyone'});
    }
  });

  client.emit('ready', function(x) {
    console.log('READY CONFIRMED', x, this.id);
  });

});
