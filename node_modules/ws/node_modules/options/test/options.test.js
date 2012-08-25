var Options = require('options')
  , expect = require('expect.js');

describe('Options', function() {
  describe('#ctor', function() {
    it('initializes options', function() {
      var option = new Options({a: true, b: false});
      expect(option.value.a).to.equal(true);
      expect(option.value.b).to.equal(false);
    })
  })

  describe('#merge', function() {
    it('merges options from another object', function() {
      var option = new Options({a: true, b: false});
      option.merge({b: true});
      expect(option.value.a).to.equal(true);
      expect(option.value.b).to.equal(true);
    })
    it('does nothing when arguments are undefined', function() {
      var option = new Options({a: true, b: false});
      option.merge(undefined);
      expect(option.value.a).to.equal(true);
      expect(option.value.b).to.equal(false);
    })
    it('cannot set values that werent already there', function() {
      var option = new Options({a: true, b: false});
      option.merge({c: true});
      expect(typeof option.value.c).to.equal('undefined');
    })
    it('can require certain options to be defined', function() {
      var option = new Options({a: true, b: false, c: 3});
      var caughtException = false;
      try {
        option.merge({}, ['a', 'b', 'c']);
      }
      catch (e) {
        caughtException = e.toString() == 'Error: options a, b and c must be defined';
      }
      expect(caughtException).to.equal(true);
    })
    it('can require certain options to be defined, when options are undefined', function() {
      var option = new Options({a: true, b: false, c: 3});
      var caughtException = false;
      try {
        option.merge(undefined, ['a', 'b', 'c']);
      }
      catch (e) {
        caughtException = e.toString() == 'Error: options a, b and c must be defined';
      }
      expect(caughtException).to.equal(true);
    })
    it('returns "this"', function() {
      var option = new Options({a: true, b: false, c: 3});
      expect(option.merge()).to.equal(option);
    })
  })

  describe('#copy', function() {
    it('returns a new object with the indicated options', function() {
      var option = new Options({a: true, b: false, c: 3});
      var obj = option.copy(['a', 'c']);
      expect(obj.a).to.equal(true);
      expect(obj.c).to.equal(3);
      expect(typeof obj.b).to.equal('undefined');
    })
  })

  describe('#value', function() {
    it('can be enumerated', function() {
      var option = new Options({a: true, b: false});
      expect(Object.keys(option.value).length).to.equal(2);
    })
    it('can not be used to set values', function() {
      var option = new Options({a: true, b: false});
      option.value.b = true;
      expect(option.value.b).to.equal(false);
    })
    it('can not be used to add values', function() {
      var option = new Options({a: true, b: false});
      option.value.c = 3;
      expect(typeof option.value.c).to.equal('undefined');
    })
  })

  describe('#read', function() {
    it('reads and merges config from a file', function() {
      var option = new Options({a: true, b: true});
      option.read(__dirname + '/fixtures/test.conf');
      expect(option.value.a).to.equal('foobar');
      expect(option.value.b).to.equal(false);
    })

    it('asynchronously reads and merges config from a file when a callback is passed', function(done) {
      var option = new Options({a: true, b: true});
      option.read(__dirname + '/fixtures/test.conf', function(error) {
        expect(option.value.a).to.equal('foobar');
        expect(option.value.b).to.equal(false);
        done();
      });
    })
  })

  describe('#reset', function() {
    it('resets options to defaults', function() {
      var option = new Options({a: true, b: false});
      option.merge({b: true});
      expect(option.value.b).to.equal(true);
      option.reset();
      expect(option.value.b).to.equal(false);
    })
  })

  it('is immutable', function() {
    var option = new Options({a: true, b: false});
    option.foo = 2;
    expect(typeof option.foo).to.equal('undefined');
  })
})
