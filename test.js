var scope = require('./'),
  assert = require('assert'),
  debug = require('debug')('mongoscope:client:test');

process.env.MONGOSCOPE = 'http://scope.mongodb.land';
// process.env.MONGOSCOPE = 'http://localhost:29017';
require('debug').enable('*');

describe('client', function(){
  var client;

  after(function(done){
    client.close();
    done();
  });
  it('should connect', function(done){
    client = scope({scope: process.env.MONGOSCOPE})
      .on('error', done)
      .on('readable', function(){
        done();
      });
  });

  it('should force port 80 if neccessary', function(){
    if(process.env.MONGOSCOPE === 'http://scope.mongodb.land'){
      assert.equal(client.config.scope, 'http://scope.mongodb.land:80');
    }
  });

  it('should return instance details', function(done){
    client.instance(function(err, res){
      if(err) return done(err);
      assert(Array.isArray(res.database_names));
      done();
    });
  });

  it('should have added a deployment', function(done){
    client.deployments(function(err, res){
      if(err) return done(err);

      assert(res.length > 0);
      done();
    });
  });

  it('should return a full fetch of top', function(done){
    client.top(function(err, res){
      if(err) return done(err);

      assert(Array.isArray(res.namespaces));
      done();
    });
  });

  it('should return some logs', function(done){
    client.log(function(err, res){
      if(err) return done(err);

      assert(Array.isArray(res));
      done();
    });
  });

  it('should return details for the local db', function(done){
    client.database('local', function(err, res){
      if(err) return done(err);

      assert(res.collection_names.length > 0);
      done();
    });
  });

  it('should support low-level find', function(done){
    client.find('local', 'startup_log', function(err, res){
      if(err) return done(err);

      assert(Array.isArray(res));
      assert(res.length > 0);
      done();
    });
  });

  it('should support count', function(done){
    client.count('local', 'startup_log', function(err, res){
      if(err) return done(err);

      assert(res.count > 0, 'count returned ' + JSON.stringify(res));
      done();
    });
  });

  it('should support aggregation');

  describe('Stateful API', function(){
    it('should map /instance', function(done){
      client.get('/instance', function(err, res){
        if(err) return done(err);
        assert(Array.isArray(res.database_names));
        done();
      });
    });

    it('should map /deployments', function(done){
      client.get('/deployments', function(err, res){
        if(err) return done(err);

        assert(res.length > 0);
        done();
      });
    });

    it('should map /top', function(done){
      client.get('/top', function(err, res){
        if(err) return done(err);

        assert(Array.isArray(res.namespaces));
        done();
      });
    });

    it('should map /log', function(done){
      client.get('/log', function(err, res){
        if(err) return done(err);

        assert(Array.isArray(res));
        done();
      });
    });

    it('should map /databases/:database', function(done){
      client.get('/databases/local', function(err, res){
        if(err) return done(err);

        assert(res.collection_names.length > 0);
        done();
      });
    });

    it('should map /databases/:database/collections/:collection/find', function(done){
      client.get('/databases/local/collections/startup_log/find', function(err, res){
        if(err) return done(err);

        assert(Array.isArray(res));
        assert(res.length > 0);
        done();
      });
    });

    it('should map /databases/:database/collections/:collection/count', function(done){
      client.get('/databases/local/collections/startup_log/count', function(err, res){
        if(err) return done(err);

        assert(res.count > 0, 'count returned ' + JSON.stringify(res));
        done();
      });
    });

    it('should support aggregation');
    describe('connect', function(){
      it('should noop if we try to connect to the current seed');
      it('should emit a change event if we connect to another instance');
      it('should get a new token');
      it('should dispose the previous token');
    });
  });

  describe('streams', function(){
    it('should have socketio connected', function(){
      assert(client.io.connected);
    });
    it.skip('should be using websockets', function(){
      var transport = client.io.io.engine.transport.name;
      assert.equal(transport, 'websocket');
    });
    it('should not allow streaming count (for now)', function(){
      assert.throws(function(){
        client.count('local', 'startup_log');
      }, new RegExp('is not streamable'));
    });

    it('should allow streaming top #slow', function(done){
      client.top({interval: 10})
        .on('error', done)
        .on('data', function(data){
          debug('checking top sample', data);

          assert(Array.isArray(data.namespaces));
          assert(typeof data.deltas === 'object');

          done();
        });
    });

    it('should swap a stream seamlessly if when connect to another instance');
  });

  describe('MongoDB World', function(){
    it('should create a stream for repl set status');
    it('should create a stream for index stats');
    it('should create a stream for operation stats');
    it('should create a stream for network stats');
  });
});
