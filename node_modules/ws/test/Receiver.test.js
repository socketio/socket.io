var assert = require('assert')
  , Receiver = require('../lib/Receiver');
require('should');
require('./hybi-common');

describe('Receiver', function() {
  it('can parse unmasked text message', function() {
    var p = new Receiver();
    var packet = '81 05 48 65 6c 6c 6f';

    var gotData = false;
    p.ontext = function(data) {
      gotData = true;
      assert.equal('Hello', data);
    };

    p.add(getBufferFromHexString(packet));
    gotData.should.be.ok;
  });
  it('can parse close message', function() {
    var p = new Receiver();
    var packet = '88 00';

    var gotClose = false;
    p.onclose = function(data) {
      gotClose = true;
    };

    p.add(getBufferFromHexString(packet));
    gotClose.should.be.ok;
  });
  it('can parse masked text message', function() {
    var p = new Receiver();
    var packet = '81 93 34 83 a8 68 01 b9 92 52 4f a1 c6 09 59 e6 8a 52 16 e6 cb 00 5b a1 d5';

    var gotData = false;
    p.ontext = function(data) {
      gotData = true;
      assert.equal('5:::{"name":"echo"}', data);
    };

    p.add(getBufferFromHexString(packet));
    gotData.should.be.ok;
  });
  it('can parse a masked text message longer than 125 bytes', function() {
    var p = new Receiver();
    var message = 'A';
    for (var i = 0; i < 300; ++i) message += (i % 5).toString();
    var packet = '81 FE ' + pack(4, message.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(message, '34 83 a8 68'));

    var gotData = false;
    p.ontext = function(data) {
      gotData = true;
      assert.equal(message, data);
    };

    p.add(getBufferFromHexString(packet));
    gotData.should.be.ok;
  });
  it('can parse a really long masked text message', function() {
    var p = new Receiver();
    var message = 'A';
    for (var i = 0; i < 64*1024; ++i) message += (i % 5).toString();
    var packet = '81 FF ' + pack(16, message.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(message, '34 83 a8 68'));

    var gotData = false;
    p.ontext = function(data) {
      gotData = true;
      assert.equal(message, data);
    };

    p.add(getBufferFromHexString(packet));
    gotData.should.be.ok;
  });
  it('can parse a fragmented masked text message of 300 bytes', function() {
    var p = new Receiver();
    var message = 'A';
    for (var i = 0; i < 300; ++i) message += (i % 5).toString();
    var msgpiece1 = message.substr(0, 150);
    var msgpiece2 = message.substr(150);
    var packet1 = '01 FE ' + pack(4, msgpiece1.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(msgpiece1, '34 83 a8 68'));
    var packet2 = '80 FE ' + pack(4, msgpiece2.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(msgpiece2, '34 83 a8 68'));

    var gotData = false;
    p.ontext = function(data) {
      gotData = true;
      assert.equal(message, data);
    };

    p.add(getBufferFromHexString(packet1));
    p.add(getBufferFromHexString(packet2));
    gotData.should.be.ok;
  });
  it('can parse a ping message', function() {
    var p = new Receiver();
    var message = 'Hello';
    var packet = '89 ' + getHybiLengthAsHexString(message.length, true) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(message, '34 83 a8 68'));

    var gotPing = false;
    p.onping = function(data) {
      gotPing = true;
      assert.equal(message, data);
    };

    p.add(getBufferFromHexString(packet));
    gotPing.should.be.ok;
  });
  it('can parse a ping with no data', function() {
    var p = new Receiver();
    var packet = '89 00';

    var gotPing = false;
    p.onping = function(data) {
      gotPing = true;
    };

    p.add(getBufferFromHexString(packet));
    gotPing.should.be.ok;
  });
  it('can parse a fragmented masked text message of 300 bytes with a ping in the middle', function() {
    var p = new Receiver();
    var message = 'A';
    for (var i = 0; i < 300; ++i) message += (i % 5).toString();

    var msgpiece1 = message.substr(0, 150);
    var packet1 = '01 FE ' + pack(4, msgpiece1.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(msgpiece1, '34 83 a8 68'));

    var pingMessage = 'Hello';
    var pingPacket = '89 ' + getHybiLengthAsHexString(pingMessage.length, true) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(pingMessage, '34 83 a8 68'));

    var msgpiece2 = message.substr(150);
    var packet2 = '80 FE ' + pack(4, msgpiece2.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(msgpiece2, '34 83 a8 68'));

    var gotData = false;
    p.ontext = function(data) {
      gotData = true;
      assert.equal(message, data);
    };
    var gotPing = false;
    p.onping = function(data) {
      gotPing = true;
      assert.equal(pingMessage, data);
    };

    p.add(getBufferFromHexString(packet1));
    p.add(getBufferFromHexString(pingPacket));
    p.add(getBufferFromHexString(packet2));
    gotData.should.be.ok;
    gotPing.should.be.ok;
  });
  it('can parse a fragmented masked text message of 300 bytes with a ping in the middle, which is delievered over sevaral tcp packets', function() {
    var p = new Receiver();
    var message = 'A';
    for (var i = 0; i < 300; ++i) message += (i % 5).toString();

    var msgpiece1 = message.substr(0, 150);
    var packet1 = '01 FE ' + pack(4, msgpiece1.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(msgpiece1, '34 83 a8 68'));

    var pingMessage = 'Hello';
    var pingPacket = '89 ' + getHybiLengthAsHexString(pingMessage.length, true) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(pingMessage, '34 83 a8 68'));

    var msgpiece2 = message.substr(150);
    var packet2 = '80 FE ' + pack(4, msgpiece2.length) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(msgpiece2, '34 83 a8 68'));

    var gotData = false;
    p.ontext = function(data) {
      gotData = true;
      assert.equal(message, data);
    };
    var gotPing = false;
    p.onping = function(data) {
      gotPing = true;
      assert.equal(pingMessage, data);
    };

    var buffers = [];
    buffers = buffers.concat(splitBuffer(getBufferFromHexString(packet1)));
    buffers = buffers.concat(splitBuffer(getBufferFromHexString(pingPacket)));
    buffers = buffers.concat(splitBuffer(getBufferFromHexString(packet2)));
    for (var i = 0; i < buffers.length; ++i) {
      p.add(buffers[i]);
    }
    gotData.should.be.ok;
    gotPing.should.be.ok;
  });
  it('can parse a 100 byte long masked binary message', function() {
    var p = new Receiver();
    var length = 100;
    var message = new Buffer(length);
    for (var i = 0; i < length; ++i) message[i] = i % 256;
    var originalMessage = getHexStringFromBuffer(message);
    var packet = '82 ' + getHybiLengthAsHexString(length, true) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(message, '34 83 a8 68'));

    var gotData = false;
    p.onbinary = function(data) {
      gotData = true;
      assert.equal(originalMessage, getHexStringFromBuffer(data));
    };

    p.add(getBufferFromHexString(packet));
    gotData.should.be.ok;
  });
  it('can parse a 256 byte long masked binary message', function() {
    var p = new Receiver();
    var length = 256;
    var message = new Buffer(length);
    for (var i = 0; i < length; ++i) message[i] = i % 256;
    var originalMessage = getHexStringFromBuffer(message);
    var packet = '82 ' + getHybiLengthAsHexString(length, true) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(message, '34 83 a8 68'));

    var gotData = false;
    p.onbinary = function(data) {
      gotData = true;
      assert.equal(originalMessage, getHexStringFromBuffer(data));
    };

    p.add(getBufferFromHexString(packet));
    gotData.should.be.ok;
  });
  it('can parse a 200kb long masked binary message', function() {
    var p = new Receiver();
    var length = 200 * 1024;
    var message = new Buffer(length);
    for (var i = 0; i < length; ++i) message[i] = i % 256;
    var originalMessage = getHexStringFromBuffer(message);
    var packet = '82 ' + getHybiLengthAsHexString(length, true) + ' 34 83 a8 68 ' + getHexStringFromBuffer(mask(message, '34 83 a8 68'));

    var gotData = false;
    p.onbinary = function(data) {
      gotData = true;
      assert.equal(originalMessage, getHexStringFromBuffer(data));
    };

    p.add(getBufferFromHexString(packet));
    gotData.should.be.ok;
  });
  it('can parse a 200kb long unmasked binary message', function() {
    var p = new Receiver();
    var length = 200 * 1024;
    var message = new Buffer(length);
    for (var i = 0; i < length; ++i) message[i] = i % 256;
    var originalMessage = getHexStringFromBuffer(message);
    var packet = '82 ' + getHybiLengthAsHexString(length, false) + ' ' + getHexStringFromBuffer(message);

    var gotData = false;
    p.onbinary = function(data) {
      gotData = true;
      assert.equal(originalMessage, getHexStringFromBuffer(data));
    };

    p.add(getBufferFromHexString(packet));
    gotData.should.be.ok;
  });
});

