
describe('engine.io-client', function () {

  it('should expose version number', function () {
    expect(eio.version).to.match(/[0-9]+\.[0-9]+\.[0-9]+/);
  });

  it('should expose protocol number', function () {
    expect(eio.protocol).to.be.a('number');
  });

});
