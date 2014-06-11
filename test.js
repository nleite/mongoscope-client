var scope = require('./'),
  assert = require('assert');

describe('client', function(){
  var client;

  it('should connect', function(done){
    client = scope({scope: 'http://scope.mongodb.land'}).on('ready', function(){
      done();
    }).on('error', done);
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

  describe.x('call url api', function(){
    it('should return instance details', function(done){
      client.call('instance', function(err, res){
        if(err) return done(err);
        assert(Array.isArray(res.database_names));
        done();
      });
    });

    it('should have added a deployment', function(done){
      client.call('deployments', function(err, res){
        if(err) return done(err);

        assert(res.length > 0);
        done();
      });
    });

    it('should return a full fetch of top', function(done){
      client.call('/top', function(err, res){
        if(err) return done(err);

        assert(Array.isArray(res.namespaces));
        done();
      });
    });

    it('should return some logs', function(done){
      client.call('/log', function(err, res){
        if(err) return done(err);

        assert(Array.isArray(res));
        done();
      });
    });

    it('should return details for the local db', function(done){
      client.call('/local', function(err, res){
        if(err) return done(err);

        assert(res.collection_names.length > 0);
        done();
      });
    });

    it('should support low-level find', function(done){
      client.call('/local/startup_log/find', function(err, res){
        if(err) return done(err);

        assert(Array.isArray(res));
        assert(res.length > 0);
        done();
      });
    });

    it('should support count', function(done){
      client.call('/local/startup_log/count', function(err, res){
        if(err) return done(err);

        assert(res.count > 0, 'count returned ' + JSON.stringify(res));
        done();
      });
    });

    it('should support aggregation');
  });
  describe('subscription', function(){
    it.skip('should connect socketio', function(){
      assert(client.io.connected);
    });
    it.skip('should get some top data', function(done){
      client.subscribe('/top', function(){
        console.log('got top data', arguments);
        done();
      });
    });
  });
});
