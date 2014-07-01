var assert = require('assert'),
  helpers = require('./helpers'),
  Backbone = require('backbone');

describe('Backbone', function(){
  var Model, Collection;

  before(function(done){
    helpers.createClient()
      .on('error', done)
      .on('readable', function(){
        Collection = Backbone.Collection.extend(helpers.client.backbone.Collection);
        Model = Backbone.Model.extend(helpers.client.backbone.Model);
        done();
      });
  });
  after(helpers.after);

  describe('Model', function(){
    it('should provide a model', function(){
      assert(helpers.client.backbone.Model);
      assert(helpers.client.backbone.Model.sync);
    });
  });
  describe('Collection', function(){
    it('should provide a collection', function(){
      assert(helpers.client.backbone.Collection);
      assert(helpers.client.backbone.Collection.sync);
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
