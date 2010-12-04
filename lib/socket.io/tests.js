var io = require('socket.io')
  , Encode = require('socket.io/data').encode
  , Decoder = require('socket.io/data').Decoder
  , decodeMessage = require('socket.io/data').decodeMessage
  , encodeMessage = require('socket.io/data').encodeMessage
  , WebSocket = require('./../../support/node-websocket-client/lib/websocket').WebSocket;

module.exports = {

  server: function(callback){
    return require('http').createServer(callback || function(){});
  },

  socket: function(server, options){
    if (!options) options = {};
    options.log = false;
    return io.listen(server, options);
  },

  encode: function(msg, atts){
    var atts = atts || {};
    if (typeof msg == 'object') atts['j'] = null;
    msg = typeof msg == 'object' ? JSON.stringify(msg) : msg;
    return Encode(['1', encodeMessage(msg, atts)]);
  },

  decode: function(data, fn){
    var decoder = new Decoder();
    decoder.on('data', function(type, msg){
      fn(type == '1' ? decodeMessage(msg) : msg, type);
    });
    decoder.add(data);
  },

  client: function(server, sessid){
    sessid = sessid ? '/' + sessid : '';
    return new WebSocket('ws://localhost:' + server._port + '/socket.io/websocket' + sessid, 'borf');
  }

};

for (var i in module.exports)
  global[i] = module.exports[i];
