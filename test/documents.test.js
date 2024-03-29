var assert = require('assert'),
  helpers = require('./helpers');

describe('Documents', function(){
  before(helpers.before);
  after(function(done){
    helpers.client.destroyCollection('test.scopes', function(err){
      if(err) return done(err);
      helpers.after(done);
    });
  });

  var doc = {
    _id: Date.now(),
    name: 'Document Create',
    project: 'mongoscope-client'
  };

  it('should make us create the collection', function(done){
    helpers.client.createDocument('test.scopes', doc, function(err, res, raw){
      assert.equal(raw.status, 404);
      done();
    });
  });
  it('should allow us to make the collection', function(done){
    helpers.client.createCollection('test.scopes', function(err, res, raw){
      assert.equal(raw.status, 201);
      done();
    });
  });
  it('should create a new one', function(done){
    helpers.client.createDocument('test.scopes', doc, function(err, res, raw){
      assert.ifError(err);
      assert.equal(raw.status, 201);
      done();
    });
  });

  it('should return details for one', function(done){
    helpers.client.getDocument('test.scopes', doc._id, function(err, res){
      assert.ifError(err);
      assert.deepEqual(res, doc);
      done();
    });
  });

  it('should update one', function(done){
    helpers.client.updateDocument('test.scopes', doc._id, {$inc: {updates: 1}}, function(err, res, raw){
      assert.ifError(err);
      assert.equal(200, raw.status);
      done();
    });
  });

  it('should destroy one', function(done){
    helpers.client.destroyDocument('test.scopes', doc._id, function(err, res, raw){
      assert.ifError(err);
      assert.equal(raw.status, 200);
      done();
    });
  });
  it('should return a 404 for the old document', function(done){
    helpers.client.getDocument('test.scopes', doc._id, function(err){
      assert.equal(err.status, 404);
      done();
    });
  });
});
