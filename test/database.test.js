var assert = require('assert'),
  helpers = require('./helpers');

describe('Database', function(){
  before(helpers.before);
  after(helpers.after);

  it('should return details for the local db', function(done){
    helpers.client.database('local', function(err, res){
      assert.ifError(err);

      assert(res.collection_names.length > 0);
      done();
    });
  });
  it('should create a new one', function(done){
    helpers.client.createCollection('test_db.nodbwithoutacollection', function(err){
      assert.ifError(err);
      done();
    });
  });
  it('should destroy one', function(done){
    helpers.client.destroyDatabase('test_db', function(err){
      assert.ifError(err);
      done();
    });
  });
});
