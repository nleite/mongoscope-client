var assert = require('assert'),
  helpers = require('./helpers');

describe('Analytics', function(){
  before(helpers.before);
  after(helpers.after);

  it('should error in client if not a valid group', function(){
    assert.throws(function(){
      helpers.client.analytics('jibber jabber');
    }, new RegExp('Unknown analytics group'));
  });
  it('should support durability', function(done){
    helpers.client.analytics('durability', function(err){
      assert.ifError(err);
      done();
    });
  });
  it('should support operations', function(done){
    helpers.client.analytics('operations', function(err){
      assert.ifError(err);
      done();
    });
  });
  it('should support memory', function(done){
    helpers.client.analytics('memory', function(err){
      assert.ifError(err);
      done();
    });
  });
  it('should support replication', function(done){
    helpers.client.analytics('replication', function(err){
      assert.ifError(err);
      done();
    });
  });
  it('should support network', function(done){
    helpers.client.analytics('network', function(err){
      assert.ifError(err);
      done();
    });
  });
  it('should support indexes', function(done){
    helpers.client.analytics('indexes', function(err){
      assert.ifError(err);
      done();
    });
  });
});
