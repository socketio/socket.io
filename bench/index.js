const Benchmark = require('benchmark');
const parser = require('..');

function test(packet, deferred) {
  const encoder = new parser.Encoder();
  encoder.encode(packet, encodedPackets => {
    const decoder = new parser.Decoder();
    decoder.on('decoded', packet => {
      deferred.resolve();
    });

    for (const encodedPacket of encodedPackets) {
      decoder.add(encodedPacket);
    }
  });
}

const dataObject = [{
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
}];
const bigArray = [];
for (let i = 0; i < 250; i++) {
  bigArray.push(dataObject);
}

const suite = new Benchmark.Suite();

suite
  .add('small json parse', {defer: true, fn: deferred => {
    const packet = {
      type: parser.EVENT,
      nsp: '/bench',
      data: dataObject
    };
    test(packet, deferred);
  }})
  .add('big json parse', {defer: true, fn: deferred => {
    const packet = {
      type: parser.EVENT,
      nsp: '/bench',
      data: bigArray
    };
    test(packet, deferred);
  }})
  .add('json with small binary parse', {defer: true, fn: deferred => {
    const packet = {
      type: parser.BINARY_EVENT,
      nsp: '/bench',
      data: [{'a': [1, 2, 3], 'b': 'xxxyyyzzz', 'data': Buffer.allocUnsafe(1000)}]
    };
    test(packet, deferred);
  }})
  .add('json with big binary parse', {defer: true, fn: deferred => {
    const bigBinaryData = [{
      bin1: Buffer.allocUnsafe(10000),
      arr: bigArray,
      bin2: Buffer.allocUnsafe(10000),
      bin3: Buffer.allocUnsafe(10000)
    }];
    const packet = {
      type: parser.BINARY_EVENT,
      nsp: '/bench',
      data: bigBinaryData
    };
    test(packet, deferred);
  }})
  .on('cycle', function(event) {
    console.log(String(event.target));
  })
  .run({'async': true});
