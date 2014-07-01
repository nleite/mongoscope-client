var assert = require('assert'),
  helpers = require('./helpers');

describe('Prototypes', function(){
  before(helpers.before);
  after(helpers.after);

  it('should return error for working set not functioning', function(done){
    helpers.client.workingSet(function(err, res){
      if(err) return done();

      done(new Error('Was not expecting this to work! ' + JSON.stringify(res, null, 2)));
    });
  });
  it('should return a unique sample of the collection', function(done){
    helpers.client.sample('local.startup_log', {size: 5}, function(err, res){
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
    helpers.client.random('local.startup_log', function(err, res){
      assert.ifError(err);
      assert(!Array.isArray(res));
      assert(res._id);
      done();
    });
  });
});
