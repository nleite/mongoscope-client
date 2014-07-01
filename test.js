var scope = require('./'),
  assert = require('assert'),
  debug = require('debug')('mongoscope:client:test');

if(window.location.origin === 'http://localhost:8080'){
  process.env.MONGOSCOPE = 'http://localhost:29017';
  require('debug').enable('mongoscope*');
}
else {
  process.env.MONGOSCOPE = 'http://scope.mongodb.land';
}
var client,
  _before = function(done){
    client = scope({scope: process.env.MONGOSCOPE})
      .on('error', done)
      .on('readable', done);
  },
  _after = function(done){
    if(!client) return done();

    client.close(function(err){
      if(err) return done(err);
      client = null;
      done();
    });
  };


describe('Instance', function(){
  before(_before);
  after(_after);
  it('should return details', function(done){
    client.instance(function(err, res){
      assert.ifError(err);
      assert(Array.isArray(res.database_names));
      done();
    });
  });
  it('should return a full fetch of top', function(done){
    client.top(function(err, res){
      assert.ifError(err);

      assert(Array.isArray(res.namespaces));
      done();
    });
  });
  it('should return some logs', function(done){
    client.log(function(err, res){
      assert.ifError(err);

      assert(Array.isArray(res));
      done();
    });
  });
  it('should have the instance in the deployment list', function(done){
    client.deployments(function(err, res){
      assert.ifError(err);
      assert(res.length > 0);
      done();
    });
  });
});


describe('Databases', function(){
  before(_before);
  after(_after);

  it('should return details for the local db', function(done){
    client.database('local', function(err, res){
      assert.ifError(err);

      assert(res.collection_names.length > 0);
      done();
    });
  });
  it('should create a new one', function(done){
    client.createCollection('test_db', 'nodbwithoutacollection', function(err){
      assert.ifError(err);
      done();
    });
  });
  it('should destroy one', function(done){
    client.destroyDatabase('test_db', function(err){
      assert.ifError(err);
      done();
    });
  });
});


describe.skip('Collections', function(){
  before(_before);
  after(_after);
  describe('Features', function(){
    it('should support low-level find', function(done){
      client.find('local', 'startup_log', function(err, res){
        assert.ifError(err);

        assert(Array.isArray(res));
        assert(res.length > 0);
        done();
      });
    });
    it('should support count', function(done){
      client.count('local', 'startup_log', function(err, res){
        assert.ifError(err);

        assert(res.count > 0, 'count returned ' + JSON.stringify(res));
        done();
      });
    });
    it('should support aggregation', function(done){
      var pipeline = [{
        $group: {
          _id : {
            pid : "$pid"
          },
          count: {$sum: 1}
        }
      }, {
        $sort: {
          count: -1
        }
      }];

      client.aggregate('local', 'startup_log', pipeline, function(err, res){
        assert.ifError(err);
        assert(res.length > 1);
        done();
      });
    });
  });
  describe('CRUD', function(){
    before(function(done){
      client.destroyCollection('test', 'original_name', function(){
        done();
      });
    });
    it('should not allow invalid collection names', function(done){
      client.createCollection('test', 'awe $ome collection times!', function(err, res){
        assert(err, 'Should be an error: ' + res.text);
        assert.equal(err.status, 400);
        done();
      });
    });
    it('should create a new one', function(done){
      client.createCollection('test', 'original_name', function(err, res){
        assert.ifError(err);
        assert.equal(res.name, 'original_name');
        done();
      });
    });
    it('should conflict if trying to create again', function(done){
      client.createCollection('test', 'original_name', function(err, res){
        assert(err, 'Should be an error: ' + res.text);
        assert.equal(err.status, 409);
        done();
      });
    });
    it('should rename it', function(done){
      client.updateCollection('test', 'original_name', {name: 'renamed'}, function(err, res){
        assert.ifError(err);
        assert.equal(res.name, 'renamed');
        done();
      });
    });
    it('should now return a 404 for the original', function(done){
      client.collection('test', 'original_name', function(err, res){
        assert(err, 'Should be an error: ' + res.text);
        assert.equal(err.status, 404, 'Got message: ' + err.message);
        done();
      });
    });
    it('should destroy one', function(done){
      client.destroyCollection('test', 'renamed', function(err, res){
        assert.ifError(err);
        assert.equal(res.name, 'renamed');
        done();
      });
    });
    it('should 404 for the renamed collection', function(done){
      client.collection('test', 'renamed', function(err, res){
        assert(err, 'Should be an error: ' + res.text);
        assert.equal(err.status, 404);
        done();
      });
    });
  });
  describe('Capped', function(){
    it('should not allow size AND max for capped collections', function(done){
      client.createCollection('test', 'cappy', {capped: true, max: 1024, size: 100}, function(err, res){
        assert(err, 'Should be an error: ' + res.text);
        assert.equal(err.status, 400);
        done();
      });
    });
    it('should create a capped collection', function(done){
      client.createCollection('test', 'cappy', {capped: true, max: 10}, function(err){
        assert.ifError(err);
        done();
      });
    });
    it('should be marked as capped by max 10', function(done){
      client.collection('test', 'cappy', function(err, res){
        assert.ifError(err);
        assert(res.features.capped);
        assert.equal(res.features.max, 10);
        done();
      });
    });
    after(function(done){
      client.destroyCollection('test', 'cappy', function(){
        done();
      });
    });
  });
});


describe('Indexes', function(){
  before(_before);
  after(_after);
  it('should create a new index', function(done){
    client.createIndex('local', 'startup_log', {hostname: 1}, function(err, res, raw){
      assert.ifError(err);
      assert.equal(raw.status, 201);
      done();
    });
  });
  it('should update the name option', function(done){
    client.updateIndex('local', 'startup_log', 'hostname_1', {name: 'hostname'}, function(err, res, raw){
      assert.ifError(err);
      assert.equal(raw.status, 200);
      assert.equal(res.name, 'hostname');
      done();
    });
  });
  it('should destroy one', function(done){
    client.destroyIndex('local', 'startup_log', 'hostname', function(err, res, raw){
      assert.ifError(err);
      assert.equal(raw.status, 200);
      assert.equal(res.name, 'hostname');
      done();
    });
  });
  it('should now return a 404 for our old index', function(done){
    client.index('local', 'startup_log', 'hostname', function(err){
      assert.equal(err.status, 404);
      done();
    });
  });
});


describe.skip('Documents', function(){
  before(_before);
  after(_after);

  var doc = {
    _id: Date.now(),
    name: 'Document Create',
    project: 'mongoscope-client'
  };

  it('should create a new one', function(done){
    client.createDocument('test', 'scopes', doc, function(err, res, raw){
      assert.ifError(err);
      assert.equal(raw.status, 201);
      done();
    });
  });

  it('should return details for one', function(done){
    client.getDocument('test', 'scopes', doc._id, function(err, res){
      assert.ifError(err);
      assert.deepEqual(res, doc);
      done();
    });
  });

  it('should update one', function(done){
    client.updateDocument('test', 'scopes', doc._id, {$inc: {updates: 1}}, function(err, res, raw){
      assert.ifError(err);
      assert.equal(200, raw.status);
      done();
    });
  });

  it('should destroy one', function(done){
    client.destroyDocument('test', 'scopes', doc._id, function(err, res, raw){
      assert.ifError(err);
      assert.equal(raw.status, 200);
      done();
    });
  });
  it('should return a 404 for the old document', function(done){
    client.getDocument('test', 'scopes', doc._id, function(err){
      assert.equal(err.status, 404);
      done();
    });
  });
});

describe('Analytics', function(){
  before(_before);
  after(_after);

  it('should error in client if not a valid group', function(){
    assert.throws(function(){
      client.analytics('jibber jabber');
    }, new RegExp('Unknown analytics group'));
  });
  it('should support durability', function(done){
    client.analytics('durability', function(err, res){
      assert.ifError(err);
      debug('durability analytics', res);
      done();
    });
  });
  it('should support operations', function(done){
    client.analytics('operations', function(err, res){
      assert.ifError(err);
      debug('operations analytics', res);
      done();
    });
  });
  it('should support memory', function(done){
    client.analytics('memory', function(err, res){
      assert.ifError(err);
      debug('memory analytics', res);
      done();
    });
  });
  it('should support replication', function(done){
    client.analytics('replication', function(err, res){
      assert.ifError(err);
      debug('replication analytics', res);
      done();
    });
  });
  it('should support network', function(done){
    client.analytics('network', function(err, res){
      assert.ifError(err);
      debug('network analytics', res);
      done();
    });
  });
  it('should support indexes', function(done){
    client.analytics('indexes', function(err, res){
      assert.ifError(err);
      debug('indexes analytics', res);
      done();
    });
  });
});

describe('Streams', function(){
  before(_before);
  after(_after);

  it('should have socketio connected', function(){
    assert(client.io.connected);
  });

  it('should be using websockets or polling', function(){
    assert(['websocket', 'polling'].indexOf(client.io.io.engine.transport.name) > -1);
  });

  it('should not allow streaming count (for now)', function(){
    assert.throws(function(){
      client.count('local', 'startup_log');
    }, new RegExp('not streamable'));
  });

  it('should have a working cursor', function(done){
    var seen = 0, expected;
    client.count('local', 'startup_log', function(err, res){
      assert.ifError(err);
      expected = res.count;

      debug('should get back ' + expected + ' docs if cursor exhausted');
      client.find('local', 'startup_log')
        .on('error', function(err){
          console.error(err);
          done(err);
        })
        .on('data', function(){seen++;})
        .on('end', function(){
          debug('documents seen', seen);
          assert.equal(seen, expected,
            'Count says ' + expected + ' but only saw ' + seen);
          done();
        });
    });
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
});




describe('Backbone Adapter', function(){
  var mackbone,
    client,
    Model,
    Collection,
    Backbone = require('backbone');

  before(function(done){
    client = scope({scope: process.env.MONGOSCOPE})
      .on('error', done)
      .on('readable', function(){
        mackbone = client.backbone;
        Collection = Backbone.Collection.extend(mackbone.Collection);
        Model = Backbone.Model.extend(mackbone.Model);
        done();
      });
  });
  after(_after);

  describe('Model', function(){
    it('should provide a model', function(){
      assert(mackbone.Model);
      assert(mackbone.Model.sync);
    });
  });
  describe('Collection', function(){
    it('should provide a collection', function(){
      assert(mackbone.Collection);
      assert(mackbone.Collection.sync);
    });
    it('should require the url property', function(){
      assert.throws(function(){
        var Top = Collection.extend({}),
          top = new Top();
        top.fetch();
      }, new RegExp('A "?url"? property or function must be specified'));
    });

    it('should pass options to find', function(done){
      var Logs = Collection.extend({url: '/collections/local.startup_log/find'});
      var logs = new Logs();
      logs.fetch({limit: 1, error: function(model, err){
        done(err);
      }, success: function(model, res){
        assert(Array.isArray(res));
        assert.equal(res.length, 1);
        done();
      }});
    });
    it('should check for a mongodb property', function(done){
      // allows specifying a deployment and collection to fetch from.
      var SuccessfulResponses = Collection.extend({
        mongodb: 'localhost:27017/scope_stat.counters.status_code.200_10'
      });
      var response_200 = new SuccessfulResponses();

      function check(){
        assert.equal(response_200.mongodb, 'localhost:27017');
        assert.equal(response_200.url,
          '/collections/scope_stat.counters.status_code.200_10/find');
        done();
      }
      response_200.fetch({limit: 1, error: check, success: check});
    });

    it('should fetch all', function(done){
      var StartupLog = Collection.extend({
        url: '/collections/local.startup_log/find'
      });

      var starts = new StartupLog();

      function check(){
        var res = starts.toJSON();
        console.log('Starts', starts);
        assert(Array.isArray(res), 'Not an array?');
        assert(res.length >= 1, 'Empty results');
        done();
      }

      starts.fetch({all: true, error: function(model, err){
        done(err);
      }, success: check});
    });
  });
});


describe('Prototypes', function(){
  before(_before);
  after(_after);

  it('should return error for working set not functioning', function(done){
    client.workingSet(function(err, res){
      if(err){
        if(/nodejs driver did not return workingSet/.test(err.message)){
          return done();
        }
        return done();
      }
      debug('working set size', res);
      done(new Error('Was not expecting this to work! ' + JSON.stringify(res, null, 2)));
    });
  });

  it('should return a unique sample of the collection', function(done){
    client.sample('local', 'startup_log', {size: 5}, function(err, res){
      assert.ifError(err);

      var set = {},
        ids = res.map(function(d){
          set[d._id] = true;
          return d._id;
        });
      assert.equal(Object.keys(ids).length, ids.length, 'Returned non-uniques');
      done();
    });
  });

  it('should return a random document', function(done){
    client.random('local', 'startup_log', function(err, res){
      assert.ifError(err);
      assert(!Array.isArray(res));
      assert(res._id);
      done();
    });
  });
});
