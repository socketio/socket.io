/**
 * Test dependencies.
 */

var assert = require('assert');
var Parser = require('../lib/transports/websocket/default.js').Parser;
require('./hybi-common');

/**
 * Tests.
 */

module.exports = {
  'can parse message': function() {
    var p = new Parser();
    var packet = '00 48 65 6c 6c 6f ff';

    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal('Hello', data);
    });

    p.add(getBufferFromHexString(packet));
    assert.ok(gotData);
  },
  'can parse message from multiple chunks': function() {
    var p = new Parser();
    var packet1 = '00 48 65';
    var packet2 = '6c 6c 6f ff';

    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal('Hello', data);
    });

    p.add(getBufferFromHexString(packet1));
    p.add(getBufferFromHexString(packet2));
    assert.ok(gotData);
  },
  'can parse multibyte UTF-8 from multiple chunks': function() {
    var p = new Parser();
    var packet1 = '00 c3';
    var packet2 = 'b6 ff';

    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal('ö', data);
    });

    p.add(getBufferFromHexString(packet1));
    p.add(getBufferFromHexString(packet2));
    assert.ok(gotData);
  },
  'can parse message containing 4 byte UTF-8': function() {
    var p = new Parser();
    var packet = '00 f0 9d 9b a2 ff';

    var gotData = false;
    p.on('data', function(data) {
      gotData = true;
      assert.equal(1, data.length); // Parsed as replacement character
    });

    p.add(getBufferFromHexString(packet));
    assert.ok(gotData);
  },
};

