var Decoder = require('socket.io/data').Decoder
  , encode = require('socket.io/data').encode;

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
  }

};
