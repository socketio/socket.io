/**
 * Test dependencies.
 */

var assert = require('assert');
var Parser = require('../lib/transports/websocket/hybi-16.js').Parser;
require('./hybi-common');

/**
 * Tests.
 */

module.exports = {
  'can parse unmasked text message': function() {
    var p = new Parser();
    var packet = '81 05 48 65 6c 6c 6f';

    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal('Hello', data);
    });

    p.add(getBufferFromHexString(packet));
    assert.ok(gotData);
  },
  'can parse close message': function() {
    var p = new Parser();
    var packet = '88 00';

    var gotClose = false;
    p.on('close', function(data) {
      gotClose = true;
    });

    p.add(getBufferFromHexString(packet));
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

    p.add(getBufferFromHexString(packet));
    assert.ok(gotData);
  },
  'can parse a masked text message longer than 125 bytes': function() {
    var p = new Parser();
    var message = 'A';
    for (var i = 0; i < 300; ++i) message += (i % 5).toString();
    var packet = '81 FE ' + pack(4, message.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(message, '34 83 a8 68'));

    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal(message, data);
    });

    p.add(getBufferFromHexString(packet));
    assert.ok(gotData);
  },
  'can parse a really long masked text message': function() {
    var p = new Parser();
    var message = 'A';
    for (var i = 0; i < 64*1024; ++i) message += (i % 5).toString();
    var packet = '81 FF ' + pack(16, message.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(message, '34 83 a8 68'));

    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal(message, data);
    });

    p.add(getBufferFromHexString(packet));
    assert.ok(gotData);
  },
  'can parse a fragmented masked text message of 300 bytes': function() {
    var p = new Parser();
    var message = 'A';
    for (var i = 0; i < 300; ++i) message += (i % 5).toString();
    var msgpiece1 = message.substr(0, 150);
    var msgpiece2 = message.substr(150);
    var packet1 = '01 FE ' + pack(4, msgpiece1.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(msgpiece1, '34 83 a8 68'));
    var packet2 = '80 FE ' + pack(4, msgpiece2.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(msgpiece2, '34 83 a8 68'));

    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal(message, data);
    });

    p.add(getBufferFromHexString(packet1));
    p.add(getBufferFromHexString(packet2));
    assert.ok(gotData);
  },
  'can parse a ping message': function() {
    var p = new Parser();
    var message = 'Hello';
    var packet = '89 FE ' + pack(4, message.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(message, '34 83 a8 68'));

    var gotPing = false;
    p.on('ping', function(data) {
      gotPing = true;
      assert.equal(message, data);
    });

    p.add(getBufferFromHexString(packet));
    assert.ok(gotPing);
  },
  'can parse a ping with no data': function() {
    var p = new Parser();
    var packet = '89 00';

    var gotPing = false;
    p.on('ping', function(data) {
      gotPing = true;
    });

    p.add(getBufferFromHexString(packet));
    assert.ok(gotPing);
  },
  'can parse a fragmented masked text message of 300 bytes with a ping in the middle': function() {
    var p = new Parser();
    var message = 'A';
    for (var i = 0; i < 300; ++i) message += (i % 5).toString();

    var msgpiece1 = message.substr(0, 150);
    var packet1 = '01 FE ' + pack(4, msgpiece1.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(msgpiece1, '34 83 a8 68'));

    var pingMessage = 'Hello';
    var pingPacket = '89 FE ' + pack(4, pingMessage.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(pingMessage, '34 83 a8 68'));

    var msgpiece2 = message.substr(150);
    var packet2 = '80 FE ' + pack(4, msgpiece2.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(msgpiece2, '34 83 a8 68'));

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

    p.add(getBufferFromHexString(packet1));
    p.add(getBufferFromHexString(pingPacket));
    p.add(getBufferFromHexString(packet2));
    assert.ok(gotData);
    assert.ok(gotPing);
  },
  'can parse a fragmented masked text message of 300 bytes with a ping in the middle, which is delievered over sevaral tcp packets': function() {
    var p = new Parser();
    var message = 'A';
    for (var i = 0; i < 300; ++i) message += (i % 5).toString();

    var msgpiece1 = message.substr(0, 150);
    var packet1 = '01 FE ' + pack(4, msgpiece1.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(msgpiece1, '34 83 a8 68'));

    var pingMessage = 'Hello';
    var pingPacket = '89 FE ' + pack(4, pingMessage.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(pingMessage, '34 83 a8 68'));

    var msgpiece2 = message.substr(150);
    var packet2 = '80 FE ' + pack(4, msgpiece2.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(msgpiece2, '34 83 a8 68'));

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
    buffers = buffers.concat(splitBuffer(getBufferFromHexString(packet1)));
    buffers = buffers.concat(splitBuffer(getBufferFromHexString(pingPacket)));
    buffers = buffers.concat(splitBuffer(getBufferFromHexString(packet2)));
    for (var i = 0; i < buffers.length; ++i) {
      p.add(buffers[i]);
    }
    assert.ok(gotData);
    assert.ok(gotPing);
  },
  'can parse a 100 byte long masked binary message': function() {
    var p = new Parser();
    var length = 100;
    var message = new Buffer(length);
    for (var i = 0; i < length; ++i) message[i] = i % 256;
    var originalMessage = getHexStringFromBuffer(message);
    var packet = '82 ' + getHybiLengthAsHexString(length, true) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(message, '34 83 a8 68'));

    var gotData = false;
    p.on('binary', function(data) {
      gotData = true;
      assert.equal(originalMessage, getHexStringFromBuffer(data));
    });

    p.add(getBufferFromHexString(packet));
    assert.ok(gotData);
  },
  'can parse a 256 byte long masked binary message': function() {
    var p = new Parser();
    var length = 256;
    var message = new Buffer(length);
    for (var i = 0; i < length; ++i) message[i] = i % 256;
    var originalMessage = getHexStringFromBuffer(message);
    var packet = '82 ' + getHybiLengthAsHexString(length, true) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(message, '34 83 a8 68'));

    var gotData = false;
    p.on('binary', function(data) {
      gotData = true;
      assert.equal(originalMessage, getHexStringFromBuffer(data));
    });

    p.add(getBufferFromHexString(packet));
    assert.ok(gotData);
  },
  'can parse a 200kb long masked binary message': function() {
    var p = new Parser();
    var length = 200 * 1024;
    var message = new Buffer(length);
    for (var i = 0; i < length; ++i) message[i] = i % 256;
    var originalMessage = getHexStringFromBuffer(message);
    var packet = '82 ' + getHybiLengthAsHexString(length, true) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(message, '34 83 a8 68'));

    var gotData = false;
    p.on('binary', function(data) {
      gotData = true;
      assert.equal(originalMessage, getHexStringFromBuffer(data));
    });

    p.add(getBufferFromHexString(packet));
    assert.ok(gotData);
  },
  'can parse a 200kb long unmasked binary message': function() {
    var p = new Parser();
    var length = 200 * 1024;
    var message = new Buffer(length);
    for (var i = 0; i < length; ++i) message[i] = i % 256;
    var originalMessage = getHexStringFromBuffer(message);
    var packet = '82 ' + getHybiLengthAsHexString(length, false) + ' ' + getHexStringFromBuffer(message);

    var gotData = false;
    p.on('binary', function(data) {
      gotData = true;
      assert.equal(originalMessage, getHexStringFromBuffer(data));
    });

    p.add(getBufferFromHexString(packet));
    assert.ok(gotData);
  },
};

