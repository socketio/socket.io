var assert = require('assert'); 
var Parser = require('../lib/transports/wsver/7.js').Parser;

function makeBufferFromHexString(byteStr) {
  var bytes = byteStr.split(' ');
  var buf = new Buffer(bytes.length);
  for (var i = 0; i < bytes.length; ++i) {
    buf[i] = parseInt(bytes[i], 16);
  }
  return buf;
}

function splitBuffer(buffer) {
  var b1 = new Buffer(Math.ceil(buffer.length / 2));
  var b2 = new Buffer(Math.floor(buffer.length / 2));
  buffer.copy(b1, 0, 0, b1.length);
  buffer.copy(b2, 0, b1.length, b1.length + b2.length);
  return [b1, b2];
}

function mask(str, maskString) {
  var buf = new Buffer(str);
  var mask = makeBufferFromHexString(maskString || '34 83 a8 68');
  for (var i = 0; i < buf.length; ++i) {
    buf[i] ^= mask[i % 4];    
  }
  return buf;
}

function unpack(buffer) {
  var n = 0;
  for (var i = 0; i < buffer.length; ++i) {
    n = (i == 0) ? buffer[i] : (n * 256) + buffer[i];
  }
  return n;
}

function pack(length, number) {
  return padl(number.toString(16), length, '0').replace(/(\d\d)/g, '$1 ').trim();
}

function padl(s,n,c) { 
  return new Array(1 + n - s.length).join(c) + s;
}

function dump(data) {
  var s = '';
  for (var i = 0; i < data.length; ++i) {
    s += padl(data[i].toString(16), 2, '0') + ' ';
  }
  return s.trim();
}

module.exports = {
  'can parse unmasked text message': function() {
    var p = new Parser();
    var packet = '81 05 48 65 6c 6c 6f';
  
    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal('Hello', data);
    });
  
    p.add(makeBufferFromHexString(packet));
    assert.ok(gotData);
  },
  'can parse close message': function() {
    var p = new Parser();
    var packet = '88 00';
  
    var gotClose = false;
    p.on('close', function(data) {
      gotClose = true;
    });
  
    p.add(makeBufferFromHexString(packet));
    assert.ok(gotClose);
  },
  'can parse masked text message': function() {
    var p = new Parser();
    var packet = '81 93 34 83 a8 68 01 b9 92 52 4f a1 c6 09 59 e6 8a 52 16 e6 cb 00 5b a1 d5';
  
    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal('5:::{"name":"echo"}', data);
    });
  
    p.add(makeBufferFromHexString(packet));
    assert.ok(gotData);
  },
  'can parse a masked text message longer than 125 bytes': function() {
    var p = new Parser();
    var message = 'A';
    for (var i = 0; i < 300; ++i) message += (i % 5).toString();
    var packet = '81 FE ' + pack(4, message.length) + ' 34 83 a8 68 ' + dump(mask(message, '34 83 a8 68'));
    
    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal(message, data);
    });
  
    p.add(makeBufferFromHexString(packet));
    assert.ok(gotData);
  },
  'can parse a really long masked text message': function() {
    var p = new Parser();
    var message = 'A';
    for (var i = 0; i < 64*1024; ++i) message += (i % 5).toString();
    var packet = '81 FF ' + pack(16, message.length) + ' 34 83 a8 68 ' + dump(mask(message, '34 83 a8 68'));

    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal(message, data);
    });
  
    p.add(makeBufferFromHexString(packet));
    assert.ok(gotData);
  },
  'can parse a fragmented masked text message of 300 bytes': function() {
    var p = new Parser();
    var message = 'A';
    for (var i = 0; i < 300; ++i) message += (i % 5).toString();
    var msgpiece1 = message.substr(0, 150);
    var msgpiece2 = message.substr(150);
    var packet1 = '01 FE ' + pack(4, msgpiece1.length) + ' 34 83 a8 68 ' + dump(mask(msgpiece1, '34 83 a8 68'));
    var packet2 = '81 FE ' + pack(4, msgpiece2.length) + ' 34 83 a8 68 ' + dump(mask(msgpiece2, '34 83 a8 68'));
  
    var gotData = false;
    p.on('data', function(data) {
      gotData = true;      
      assert.equal(message, data);
    });
  
    p.add(makeBufferFromHexString(packet1));
    p.add(makeBufferFromHexString(packet2));
    assert.ok(gotData);
  },
  'can parse a ping message': function() {
    var p = new Parser();
    var message = 'Hello';
    var packet = '89 FE ' + pack(4, message.length) + ' 34 83 a8 68 ' + dump(mask(message, '34 83 a8 68'));
    
    var gotPing = false;
    p.on('ping', function(data) {
      gotPing = true;
      assert.equal(message, data);
    });
    
    p.add(makeBufferFromHexString(packet));
    assert.ok(gotPing);
  },
  'can parse a ping with no data': function() {
    var p = new Parser();
    var packet = '89 00';
    
    var gotPing = false;
    p.on('ping', function(data) {
      gotPing = true;
    });
    
    p.add(makeBufferFromHexString(packet));
    assert.ok(gotPing);
  },
  'can parse a fragmented masked text message of 300 bytes with a ping in the middle': function() {
    var p = new Parser();
    var message = 'A';
    for (var i = 0; i < 300; ++i) message += (i % 5).toString();
  
    var msgpiece1 = message.substr(0, 150);
    var packet1 = '01 FE ' + pack(4, msgpiece1.length) + ' 34 83 a8 68 ' + dump(mask(msgpiece1, '34 83 a8 68'));
  
    var pingMessage = 'Hello';
    var pingPacket = '89 FE ' + pack(4, pingMessage.length) + ' 34 83 a8 68 ' + dump(mask(pingMessage, '34 83 a8 68'));
  
    var msgpiece2 = message.substr(150);
    var packet2 = '81 FE ' + pack(4, msgpiece2.length) + ' 34 83 a8 68 ' + dump(mask(msgpiece2, '34 83 a8 68'));
  
    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal(message, data);
    });
    var gotPing = false;
    p.on('ping', function(data) {
      gotPing = true;
      assert.equal(pingMessage, data);
    });
    
    p.add(makeBufferFromHexString(packet1));
    p.add(makeBufferFromHexString(pingPacket));
    p.add(makeBufferFromHexString(packet2));
    assert.ok(gotData);
    assert.ok(gotPing);
  },
  'can parse a fragmented masked text message of 300 bytes with a ping in the middle, which is delievered over sevaral tcp packets': function() {
    var p = new Parser();
    var message = 'A';
    for (var i = 0; i < 300; ++i) message += (i % 5).toString();
  
    var msgpiece1 = message.substr(0, 150);
    var packet1 = '01 FE ' + pack(4, msgpiece1.length) + ' 34 83 a8 68 ' + dump(mask(msgpiece1, '34 83 a8 68'));
  
    var pingMessage = 'Hello';
    var pingPacket = '89 FE ' + pack(4, pingMessage.length) + ' 34 83 a8 68 ' + dump(mask(pingMessage, '34 83 a8 68'));
  
    var msgpiece2 = message.substr(150);
    var packet2 = '81 FE ' + pack(4, msgpiece2.length) + ' 34 83 a8 68 ' + dump(mask(msgpiece2, '34 83 a8 68'));
  
    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal(message, data);
    });
    var gotPing = false;
    p.on('ping', function(data) {
      gotPing = true;
      assert.equal(pingMessage, data);
    });
    
    var buffers = [];
    buffers = buffers.concat(splitBuffer(makeBufferFromHexString(packet1)));
    buffers = buffers.concat(splitBuffer(makeBufferFromHexString(pingPacket)));
    buffers = buffers.concat(splitBuffer(makeBufferFromHexString(packet2)));
    for (var i = 0; i < buffers.length; ++i) {
      p.add(buffers[i]);
    }
    assert.ok(gotData);
    assert.ok(gotPing);
  },
};

