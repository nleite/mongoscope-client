var assert = require('assert'),
  helpers = require('./helpers');

describe.skip('Collection', function(){
  before(helpers.before);
  after(helpers.after);
  describe('Features', function(){
    it('should support low-level find', function(done){
      helpers.client.find('local.startup_log', function(err, res){
        assert.ifError(err);

        assert(Array.isArray(res));
        assert(res.length > 0);
        done();
      });
    });
    it('should support count', function(done){
      helpers.client.count('local.startup_log', function(err, res){
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

      helpers.client.aggregate('local.startup_log', pipeline, function(err, res){
        assert.ifError(err);
        assert(res.length > 1);
        done();
      });
    });
  });
  describe('CRUD', function(){
    before(function(done){
      helpers.client.destroyCollection('test.original_name', function(){
        done();
      });
    });
    it('should not allow invalid collection names', function(done){
      helpers.client.createCollection('test.awe $ome collection times!', function(err, res){
        assert(err, 'Should be an error: ' + res.text);
        assert.equal(err.status, 400);
        done();
      });
    });
    it('should create a new one', function(done){
      helpers.client.createCollection('test.original_name', function(err, res){
        assert.ifError(err);
        assert.equal(res.name, 'original_name');
        done();
      });
    });
    it('should conflict if trying to create again', function(done){
      helpers.client.createCollection('test.original_name', function(err, res){
        assert(err, 'Should be an error: ' + res.text);
        assert.equal(err.status, 409);
        done();
      });
    });
    it('should rename it', function(done){
      helpers.client.updateCollection('test.original_name', {name: 'renamed'}, function(err, res){
        assert.ifError(err);
        assert.equal(res.name, 'renamed');
        done();
      });
    });
    it('should now return a 404 for the original', function(done){
      helpers.client.collection('test.original_name', function(err, res){
        assert(err, 'Should be an error: ' + res.text);
        assert.equal(err.status, 404, 'Got message: ' + err.message);
        done();
      });
    });
    it('should destroy one', function(done){
      helpers.client.destroyCollection('test.renamed', function(err, res){
        assert.ifError(err);
        assert.equal(res.name, 'renamed');
        done();
      });
    });
    it('should 404 for the renamed collection', function(done){
      helpers.client.collection('test.renamed', function(err, res){
        assert(err, 'Should be an error: ' + res.text);
        assert.equal(err.status, 404);
        done();
      });
    });
  });
  describe('Capped', function(){
    it('should not allow size AND max for capped collections', function(done){
      var opts = {
        capped: true,
        max: 1024,
        size: 100
      };

      helpers.client.createCollection('test.cappy', opts, function(err, res){
        assert(err, 'Should be an error: ' + res.text);
        assert.equal(err.status, 400);
        done();
      });
    });
    it('should create a capped collection', function(done){
      helpers.client.createCollection('test.cappy', {capped: true, max: 10}, function(err){
        assert.ifError(err);
        done();
      });
    });
    it('should be marked as capped by max 10', function(done){
      helpers.client.collection('test.cappy', function(err, res){
        assert.ifError(err);
        assert(res.features.capped);
        assert.equal(res.features.max, 10);
        done();
      });
    });
    after(function(done){
      helpers.client.destroyCollection('test.cappy', function(){
        done();
      });
    });
  });
});
