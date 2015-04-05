
// this is a test server to support tests which make requests

var io = require('socket.io');
var server = io(process.env.ZUUL_PORT, { pingInterval: 2000 });
var expect = require('expect.js');

server.of('/foo').on('connection', function(){
  // register namespace
});

server.of('/timeout_socket').on('connection', function(){
  // register namespace
});

server.of('/valid').on('connection', function(){
  // register namespace
});

server.of('/asd').on('connection', function(){
  // register namespace
});

server.on('connection', function(socket){
  // simple test
  socket.on('hi', function(){
    socket.emit('hi');
  });

  // ack tests
  socket.on('ack', function(){
    socket.emit('ack', function(a, b){
      if (a == 5 && b.test) {
        socket.emit('got it');
      }
    });
  });

  socket.on('getAckDate', function(data, cb){
    cb(new Date());
  });

  socket.on('getDate', function(){
    socket.emit('takeDate', new Date());
  });

  socket.on('getDateObj', function(){
    socket.emit('takeDateObj', { date: new Date() });
  });

  socket.on('getUtf8', function() {
    socket.emit('takeUtf8', 'てすと');
    socket.emit('takeUtf8', 'Я Б Г Д Ж Й');
    socket.emit('takeUtf8', 'Ä ä Ü ü ß');
    socket.emit('takeUtf8', 'utf8 — string');
    socket.emit('takeUtf8', 'utf8 — string');
  });

  // false test
  socket.on('false', function(){
    socket.emit('false', false);
  });

  // binary test
  socket.on('doge', function(){
    var buf = new Buffer('asdfasdf', 'utf8');
    socket.emit('doge', buf);
  });

  // expect receiving binary to be buffer
  socket.on('buffa', function(a){
    if (Buffer.isBuffer(a)) socket.emit('buffack');
  });

  // expect receiving binary with mixed JSON
  socket.on('jsonbuff', function(a) {
    expect(a.hello).to.eql('lol');
    expect(Buffer.isBuffer(a.message)).to.be(true);
    expect(a.goodbye).to.eql('gotcha');
    socket.emit('jsonbuff-ack');
  });

  // expect receiving buffers in order
  var receivedAbuff1 = false;
  socket.on('abuff1', function(a) {
    expect(Buffer.isBuffer(a)).to.be(true);
    receivedAbuff1 = true;
  });
  socket.on('abuff2', function(a) {
    expect(receivedAbuff1).to.be(true);
    socket.emit('abuff2-ack');
  });

  // expect sent blob to be buffer
  socket.on('blob', function(a){
    if (Buffer.isBuffer(a)) socket.emit('back');
  });

  // expect sent blob mixed with json to be buffer
  socket.on('jsonblob', function(a) {
    expect(a.hello).to.eql('lol');
    expect(Buffer.isBuffer(a.message)).to.be(true);
    expect(a.goodbye).to.eql('gotcha');
    socket.emit('jsonblob-ack');
  });

  // expect blobs sent in order to arrive in correct order
  var receivedblob1 = false;
  var receivedblob2 = false;
  socket.on('blob1', function(a) {
    expect(Buffer.isBuffer(a)).to.be(true);
    receivedblob1 = true;
  });
  socket.on('blob2', function(a) {
    expect(receivedblob1).to.be(true);
    expect(a).to.eql('second');
    receivedblob2 = true;
  });
  socket.on('blob3', function(a) {
    expect(Buffer.isBuffer(a)).to.be(true);
    expect(receivedblob1).to.be(true);
    expect(receivedblob2).to.be(true);
    socket.emit('blob3-ack');
  });

  // emit buffer to base64 receiving browsers
  socket.on('getbin', function() {
    var buf = new Buffer('asdfasdf', 'utf8');
    socket.emit('takebin', buf);
  });
});
