var assert = require('assert'),
  helpers = require('./helpers');

describe('Streams', function(){
  before(helpers.before);
  after(helpers.after);

  it.skip('should have socketio connected', function(){
    assert(helpers.client.io.connected);
  });

  it('should be using websockets or polling', function(){
    assert(['websocket', 'polling'].indexOf(helpers.client.io.io.engine.transport.name) > -1);
  });

  it('should not allow streaming count (for now)', function(){
    assert.throws(function(){
      helpers.client.count('local.startup_log');
    }, new RegExp('not streamable'));
  });

  it('should have a working cursor', function(done){
    var seen = 0, expected;
    helpers.client.count('local.startup_log', function(err, res){
      assert.ifError(err);
      expected = res.count;

      helpers.client.find('local.startup_log')
        .on('error', function(err){
          console.error(err);
          done(err);
        })
        .on('data', function(){seen++;})
        .on('end', function(){
          assert.equal(seen, expected,
            'Count says ' + expected + ' but only saw ' + seen);
          done();
        });
    });
  });
  it.skip('should allow streaming top #slow', function(done){
    helpers.client.top({interval: 10})
      .on('error', done)
      .on('data', function(data){
        assert(Array.isArray(data.namespaces));
        assert.equal(Object.prototype.toString.call(data.deltas), '[object Object]');

        done();
      });
  });
});
