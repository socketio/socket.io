
/**
 * Test dependencies
 *
 * @api private
 */

var sio = require('socket.io')
  , redis = require('redis')
  , should = require('should')
  , RedisStore = sio.RedisStore;

/**
 * Test.
 */

module.exports = {

  'test publishing doesnt get caught by the own store subscriber': function (done) {
    var a = new RedisStore
      , b = new RedisStore;

    a.subscribe('woot', function (arg) {
      arg.should.equal('bb');
      a.destroy();
      b.destroy();
      done();
    }, function () {
      a.publish('woot', 'aa');
      b.publish('woot', 'bb');
    });
  },

  'test publishing to multiple subscribers': function (done) {
    var a = new RedisStore
      , b = new RedisStore
      , c = new RedisStore
      , subscriptions = 3
      , messages = 2;

    a.subscribe('tobi', function () {
      throw new Error('Shouldnt publish to itself');
    }, publish);

    function subscription (arg1, arg2, arg3) {
      arg1.should.equal(1);
      arg2.should.equal(2);
      arg3.should.equal(3);
      --messages || finish();
    }

    b.subscribe('tobi', subscription, publish);
    c.subscribe('tobi', subscription, publish);

    function publish () {
      --subscriptions || a.publish('tobi', 1, 2, 3);
    }

    function finish () {
      a.destroy();
      b.destroy();
      c.destroy();
      done();
    }
  },

  'test storing data for a client': function (done) {
    var store = new RedisStore
      , rand = 'test-' + Date.now()
      , client = store.client(rand);

    client.id.should.equal(rand);

    client.set('a', 'b', function (err) {
      should.strictEqual(err, null);

      client.get('a', function (err, val) {
        should.strictEqual(err, null);
        val.should.equal('b');

        client.has('a', function (err, has) {
          should.strictEqual(err, null);
          has.should.be.true;

          client.has('b', function (err, has) {
            should.strictEqual(err, null);
            has.should.be.false;

            client.del('a', function (err) {
              should.strictEqual(err, null);

              client.has('a', function (err, has) {
                should.strictEqual(err, null);
                has.should.be.false;

                client.set('b', 'c', function (err) {
                  should.strictEqual(err, null);

                  client.set('c', 'd', function (err) {
                    should.strictEqual(err, null);

                    client.get('b', function (err, val) {
                      should.strictEqual(err, null);
                      val.should.equal('c');

                      client.get('c', function (err, val) {
                        should.strictEqual(err, null);
                        val.should.equal('d');

                        store.destroy();
                        done();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  },

  'test cleaning up clients data': function (done) {
    var rand1 = Math.abs(Math.random() * Date.now() | 0)
      , rand2 = Math.abs(Math.random() * Date.now() | 0);

    var store = new RedisStore()
      , client1 = store.client(rand1)
      , client2 = store.client(rand2);

    client1.set('a', 'b', function (err) {
      should.strictEqual(err, null);

      client2.set('c', 'd', function (err) {
        should.strictEqual(err, null);

        client1.has('a', function (err, val) {
          should.strictEqual(err, null);
          val.should.be.true;

          client2.has('c', function (err, val) {
            should.strictEqual(err, null);
            val.should.be.true;

            store.destroy();

            var newstore = new RedisStore()
              , newclient1 = newstore.client(rand1)
              , newclient2 = newstore.client(rand2);

            newclient1.has('a', function (err, val) {
              should.strictEqual(err, null);
              val.should.be.false;

              newclient2.has('c', function (err, val) {
                should.strictEqual(err, null);
                val.should.be.false;

                newstore.destroy();
                done();
              });
            });
          });
        });
      });
    });
  },

  'test cleaning up a particular client': function (done) {
    var rand1 = Math.abs(Math.random() * Date.now() | 0)
      , rand2 = Math.abs(Math.random() * Date.now() | 0);

    var store = new RedisStore()
      , client1 = store.client(rand1)
      , client2 = store.client(rand2);

    client1.set('a', 'b', function (err) {
      should.strictEqual(err, null);

      client2.set('c', 'd', function (err) {
        should.strictEqual(err, null);

        client1.has('a', function (err, val) {
          should.strictEqual(err, null);
          val.should.be.true;

          client2.has('c', function (err, val) {
            should.strictEqual(err, null);
            val.should.be.true;

            store.clients.should.have.property(rand1);
            store.clients.should.have.property(rand2);
            store.destroyClient(rand1);

            store.clients.should.not.have.property(rand1);
            store.clients.should.have.property(rand2);

            client1.has('a', function (err, val) {
              should.strictEqual(err, null);
              val.should.equal(false);

              store.destroy();
              done();
            });
          });
        });
      });
    });
  },

  'test destroy expiration': function (done) {
    var store = new RedisStore()
      , id = Math.abs(Math.random() * Date.now() | 0)
      , client = store.client(id);

    client.set('a', 'b', function (err) {
      should.strictEqual(err, null);
      store.destroyClient(id, 1);

      setTimeout(function () {
        client.get('a', function (err, val) {
          should.strictEqual(err, null);
          val.should.equal('b');
        });
      }, 500);

      setTimeout(function () {
        client.get('a', function (err, val) {
          should.strictEqual(err, null);
          should.strictEqual(val, null);

          store.destroy();
          done();
        });
      }, 2000);
    });
  }

};
