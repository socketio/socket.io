var Benchmark = require('benchmark');
var parser = require('../index');

function test(packet, deferred) {
  var encoder = new parser.Encoder();
  var decoder = new parser.Decoder();
  encoder.encode(packet, function(encodedPackets) {
    var decoder = new parser.Decoder();
    decoder.on('decoded', function(packet) {
      deferred.resolve();
    });

    decoder.add(encodedPackets[0]);
  });
}

var dataObject = {
  'a': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  'b': 'xxxyyyzzzalsdfalskdjfalksdjfalksdjfalksdjfjjfjfjfjjfjfjfj',
  'data': {
    'is': 'cool',
    'or': {
      'is': {
        'it': true
      }
    }
   }
};
var bigArray = [];
for (var i = 0; i < 250; i++) {
  bigArray.push(dataObject);
}



module.exports = function(callback) {
  var suite = new Benchmark.Suite();

  suite.add('small json parse', {defer: true, fn: function(deferred) {
    var packet = {
      type: parser.EVENT,
      nsp: '/bench',
      data: dataObject
    };
    test(packet, deferred);
  }})
  .add('big json parse', {defer: true, fn: function(deferred) {
    var packet = {
      type: parser.EVENT,
      nsp: '/bench',
      data: bigArray
    };
    test(packet, deferred);
  }})
  .add('json with small binary parse', {defer: true, fn: function(deferred) {
    var packet = {
      type: parser.EVENT,
      nsp: '/bench',
      data: {'a': [1, 2, 3], 'b': 'xxxyyyzzz', 'data': new Buffer(1000)}
    };
    test(packet, deferred);
  }})
  .add('json with big binary parse', {defer: true, fn: function(deferred) {
    var bigBinaryData = {
      bin1: new Buffer(10000),
      arr: bigArray,
      bin2: new Buffer(10000),
      bin3: new Buffer(10000)
    };
    var packet = {
      type: parser.EVENT,
      nsp: '/bench',
      data: bigBinaryData
    };
    test(packet, deferred);
  }})
  .on('complete', function() {
    callback(this);
  })
  .run({'async': true});
};
