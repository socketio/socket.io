
describe('server', function () {

  it('should disallow non-existent transports', function (done) {
    var engine = eio.listen(4000, function () {
      request.get('http://localhost:4000/engine.io')
        .data({ transport: 'tobi' }) // no tobi transport - outrageous
        .end(function (err, res) {
          expect(res.status).to.be(500);
          engine.httpServer.once('close', done);
          engine.httpServer.close();
        });
    });
  });

  it('should disallow `constructor` as transports', function (done) {
    // make sure we check for actual properties - not those present on every {}
    var engine = eio.listen(4000, function () {
      request.get('http://localhost:4000/engine.io')
        .data({ transport: 'constructor' })
        .end(function (err, res) {
          expect(res.status).to.be(500);
          engine.httpServer.once('close', done);
          engine.httpServer.close();
        });
    });
  });

  it('should disallow non-existent sids', function (done) {
    var engine = eio.listen(4000, function () {
      request.get('http://localhost:4000/engine.io')
        .data({ sid: 'test' })
        .end(function (err, res) {
          expect(res.status).to.be(500);
          engine.httpServer.once('close', done);
          engine.httpServer.close();
        });
    });
  });

});
