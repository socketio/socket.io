var Decoder = require('socket.io/data').Decoder
  , encode = require('socket.io/data').encode
  , encodeMessage = require('socket.io/data').encodeMessage
  , decodeMessage = require('socket.io/data').decodeMessage;

module.exports = {
  
  'test data decoding of message feed all at once': function(assert, beforeExit){
    var a = new Decoder()
      , parsed = 0
      , errors = 0;

    a.on('error', function(){
      errors++;
    });

    a.on('data', function(type, message){
      parsed++;
      if (parsed === 1){
        assert.ok(type === '0');
        assert.ok(message === '');
      } else if (parsed === 2){
        assert.ok(type === '1');
        assert.ok(message === 'r:chat:Hello world');
      }
    });

    a.add('0:0:,');
    a.add('1:18:r:chat:Hello world,');

    beforeExit(function(){
      assert.ok(parsed === 2);
      assert.ok(errors === 0);
    });
  },

  'test data decoding by parts': function(assert, beforeExit){
    var a = new Decoder()
      , parsed = 0
      , errors = 0;

    a.on('error', function(){
      errors++;
    });

    a.on('data', function(type, message){
      parsed++;
      assert.ok(type === '5');
      assert.ok(message = '123456789');
    });

    a.add('5');
    a.add(':9');
    a.add(':12345');
    a.add('678');
    a.add('9');
    a.add(',typefornextmessagewhichshouldbeignored');
    
    beforeExit(function(){
      assert.ok(parsed === 1);
      assert.ok(errors === 0);
    });
  },

  'test data decoding of many messages at once': function(assert, beforeExit){
    var a = new Decoder()
      , parsed = 0
      , errors = 0;

    a.on('error', function(){
      errors++;
    });

    a.on('data', function(type, message){
      parsed++;
      switch (parsed){
        case 1:
          assert.ok(type === '3');
          assert.ok(message === 'COOL,');
          break;
        case 2:
          assert.ok(type === '4');
          assert.ok(message === '');
          break;
        case 3:
          assert.ok(type === '5');
          assert.ok(message === ':∞…:');
          break;
      }
    });

    a.add('3:5:COOL,,4:0:,5:4::∞…:,');

    beforeExit(function(){
      assert.ok(parsed === 3);
      assert.ok(errors === 0);
    });
  },

  'test erroneous data decoding on undefined type': function(assert, beforeExit){
    var a = new Decoder()
      , parsed = 0
      , errors = 0
      , error;

    a.on('data', function(){
      parsed++;
    });

    a.on('error', function(reason){
      errors++;
      error = reason;
    });

    a.add(':');

    beforeExit(function(){
      assert.ok(parsed === 0);
      assert.ok(errors === 1);
      assert.ok(error === 'Data type not specified');
    });
  },

  'test erroneous data decoding on undefined length': function(assert, beforeExit){
    var a = new Decoder()
      , parsed = 0
      , errors = 0
      , error;
    
    a.on('data', function(){
      parsed++;
    });

    a.on('error', function(reason){
      errors++;
      error = reason;
    });

    a.add('1::');

    beforeExit(function(){
      assert.ok(parsed === 0);
      assert.ok(errors === 1);
      assert.ok(error === 'Data length not specified');
    });
  },

  'test erroneous data decoding on incorrect length': function(assert, beforeExit){
    var a = new Decoder()
      , parsed = 0
      , errors = 0
      , error;
    
    a.on('data', function(){
      parsed++;
    });

    a.on('error', function(reason){
      errors++;
      error = reason;
    });

    a.add('1:5:123456,');

    beforeExit(function(){
      assert.ok(parsed === 0);
      assert.ok(errors === 1);
      assert.ok(error === 'Termination character "," expected');
    });
  },

  'test encoding': function(assert){
    assert.ok(encode([3,'Testing']) == '3:7:Testing,');
    assert.ok(encode([[1,''],[2,'tobi']]) == '1:0:,2:4:tobi,');
  },

  'test message encoding without annotations': function(assert){
    assert.ok(encodeMessage('') === ':');
    assert.ok(encodeMessage('Testing') === ':Testing');
  },

  'test message encoding with annotations': function(assert){
    assert.ok(encodeMessage('', {j: null}) === 'j\n:');
    assert.ok(encodeMessage('Test', {j: null, re: 'test'}) === 'j\nre:test\n:Test');
  },

  'test message decoding without annotations': function(assert){
    var decoded1 = decodeMessage(':')
      , decoded2 = decodeMessage(':Testing');
    
    assert.ok(decoded1[0] === '');
    assert.ok(Object.keys(decoded1[1]).length === 0);

    assert.ok(decoded2[0] === 'Testing');
    assert.ok(Object.keys(decoded2[1]).length === 0);
  },

  'test message decoding with annotations': function(assert){
    var decoded1 = decodeMessage('j\n:')
      , decoded2 = decodeMessage('j\nre:test\n:Test');
    
    assert.ok(decoded1[0] === '');
    assert.ok('j' in decoded1[1]);

    assert.ok(decoded2[0] === 'Test');
    assert.ok('j' in decoded2[1]);
    assert.ok(decoded2[1].re === 'test');
  }

};
