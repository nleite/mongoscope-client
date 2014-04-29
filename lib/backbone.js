var Backbone = require('backbone'),
  _ = require('underscore');

var Model, scope;

module.exports.Database = Model.extend({
  url: function(){return [this.get('name')];}
});

module.exports.Collection = Model.extend({
  url: function(){return [this.get('database'), this.get('name')];}
});

Backbone.sync = function(method, model, options){
  var url = _.result(this, 'url');
  scope.call(url, function(err, res){
    if(err) return options.error(err);
    options.success(res);
  });
};

var mixins = {
  subscriptionHandler: function(data){
    if (!this.set(data)) return false;
    this.trigger('sync', this, data, {});
  },
  subscription: null,
  subscribe: function(){
    scope.on('change', function(){
      this.unsubscribe().subscribe();
    }.bind(this));

    this.subscription = scope.subscribe(_.result(this, 'url'),
      this.subscriptionHandler.bind(this));
    return this;
  },
  unsubscribe: function(){
    this.subscription.unsubscribe();
    this.subscription = null;
    scope.off('change');
    return this;
  }
};

module.exports.Model = Backbone.Model.extend(mixins);
module.exports.List = Backbone.Collection.extend(mixins);
