const parser = require("..");
const expect = require("expect.js");
const encoder = new parser.Encoder();

// tests encoding and decoding a single packet
module.exports.test = (obj, done) => {
  const encodedPackets = encoder.encode(obj);

  const decoder = new parser.Decoder();
  decoder.on("decoded", (packet) => {
    expect(packet).to.eql(obj);
    done();
  });

  decoder.add(encodedPackets[0]);
};

// tests encoding of binary packets
module.exports.test_bin = (obj, done) => {
  const originalData = obj.data;
  const encodedPackets = encoder.encode(obj);

  const decoder = new parser.Decoder();
  decoder.on("decoded", (packet) => {
    obj.data = originalData;
    obj.attachments = undefined;
    expect(obj).to.eql(packet);
    done();
  });

  for (let i = 0; i < encodedPackets.length; i++) {
    decoder.add(encodedPackets[i]);
  }
};

// array buffer's slice is native code that is not transported across
// socket.io via msgpack, so regular .eql fails
module.exports.testArrayBuffers = (buf1, buf2) => {
  buf1.slice = undefined;
  buf2.slice = undefined;
  expect(buf1).to.eql(buf2);
};

module.exports.testPacketMetadata = (p1, p2) => {
  expect(p1.type).to.eql(p2.type);
  expect(p1.id).to.eql(p2.id);
  expect(p1.nsp).to.eql(p2.nsp);
};
