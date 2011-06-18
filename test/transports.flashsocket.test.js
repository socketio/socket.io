
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Test dependencies.
 */

var sio = require('socket.io')
  , net = require('net')
  , assert = require('assert')
  , should = require('./common')
  , HTTPClient = should.HTTPClient
  , WebSocket = require('../support/node-websocket-client/lib/websocket').WebSocket
  , parser = sio.parser
  , ports = 15600;

/**
 * WebSocket socket.io client.
 *
 * @api private
 */

function FSClient (port, sid) {
  this.sid = sid;
  this.port = port;

  WebSocket.call(
      this
    , 'ws://localhost:' + port + '/socket.io/' 
        + sio.protocol + '/flashsocket/' + sid
  );
};

/**
 * Inherits from WebSocket.
 */

FSClient.prototype.__proto__ = WebSocket.prototype;

/**
 * Overrides message event emission.
 *
 * @api private
 */

FSClient.prototype.emit = function (name) {
  var args = arguments;

  if (name == 'message' || name == 'data') {
    args[1] = parser.decodePacket(args[1].toString());
  }

  return WebSocket.prototype.emit.apply(this, arguments);
};

/**
 * Writes a packet
 */

FSClient.prototype.packet = function (pack) {
  this.write(parser.encodePacket(pack));
  return this;
};

/**
 * Creates a flashsocket client.
 *
 * @api public
 */

function flashsocket (cl, sid) {
  return new FSClient(cl.port, sid);
};

/**
 * Creates a netConnection to a port
 *
 * @api public
 */

function netConnection (port, callback){
  var nclient = net.createConnection(port);
  nclient.on('data', function (data) {
    callback.call(nclient,false, data);
  });

  nclient.on('error', function (e){
    callback.call(nclient,e);
  });
  
  nclient.write('<policy-file-request/>\0');
}

/**
 * Tests.
 */

module.exports = {
  'flashsocket disabled by default': function(done){
     var cl = client(++ports)
      , io = create(cl);

    io.get('transports').indexOf('flashsocket').should.eql(-1);

    cl.end();
    io.server.close();
    done();
  }

, 'flash policy port': function (done){
     var cl = client(++ports)
      , io = create(cl)
      , port = ++ports;

    io.get('flash policy port').should.eql(843);
    io.set('flash policy port', port);
    io.get('flash policy port').should.eql(port);
    (!!io.flashPolicyServer).should.eql(false);

    netConnection(port, function (err, data){
      assert.ok(!!err)

      this.destroy();
      cl.end();
      io.server.close();
      done();
    })
    
  }

, 'start flash policy': function (done){
     var cl = client(++ports)
      , io = create(cl)
      , port = ++ports;

    io.set('flash policy port', port);
    io.set('transports', ['flashsocket']);
    (!!io.flashPolicyServer).should.eql(true);

    netConnection(port, function (err, data){
      assert.ok(!err);
      assert.ok(!!data);
      
      data.toString().indexOf('<cross-domain-policy>').should.be.above(0);

      this.destroy();
      cl.end();
      io.server.close();
      io.flashPolicyServer.close();
      done();
    })
    
  }

, 'change running flash server port': function (done){
     var cl = client(++ports)
      , io = create(cl)
      , port = ++ports
      , next = ++ports;

    io.set('flash policy port', port);
    io.set('transports', ['flashsocket']);
    io.set('flash policy port', next);
    io.flashPolicyServer.port.should.eql(next);

    netConnection(port, function (err, data){
      assert.ok(!!err);
      this.destroy();

      // should work
      netConnection(next, function (err, data){
        assert.ok(!err);
        assert.ok(!!data);

        data.toString().indexOf('<cross-domain-policy>').should.be.above(-1);
  
        this.destroy();
        cl.end();
        io.server.close();
        io.flashPolicyServer.close();
        done();
      });
    });
    
  }

, 'different origins': function(done){
     var cl = client(++ports)
      , io = create(cl)
      , port = ++ports;

    io.set('flash policy port', port);
    io.set('transports', ['flashsocket']);

    io.set('origins', 'google.com:80');
    io.flashPolicyServer.origins.indexOf('google.com:80').should.be.above(-1);
    io.flashPolicyServer.origins.indexOf('*.*').should.eql(-1);

    io.set('origins', ['foo.bar:80', 'socket.io:1337']);
    io.flashPolicyServer.origins.indexOf('google.com:80').should.eql(-1);
    io.flashPolicyServer.origins.indexOf('foo.bar:80').should.be.above(-1);
    io.flashPolicyServer.origins.indexOf('socket.io:1337').should.be.above(-1);
    io.flashPolicyServer.buffer.toString('utf8').indexOf('socket.io').should.be.above(-1);

    cl.end();
    io.server.close();
    io.flashPolicyServer.close();
    done();
  }

};