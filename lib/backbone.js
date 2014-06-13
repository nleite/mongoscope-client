var _ = require('underscore'),
  Client = require('./client');

var clients = {};

function getClient(scope){
  if(!clients[scope]){
    clients[scope] = new Client({scope: scope});
  }
  return clients[scope];
}

function sync(method, model, options){
  var url = _.result(this, 'url'),
    client = this.getScopeClient(),
    ender = function(err, res){
      if(err) return options.error(err);
      options.success(res);
    };

  if(!options.all) return client.call(url, ender);

  options.skip |= 0;
  options.limit |= 200;

  var buf = [];
  client.call(url, {skip: options.skip, limit: options.limit}, function(err, res){
    if(err) return ender(err);

    buf.push.apply(buf, res);

    // exhausted
    if(res.length === 0 || res.length !== options.limit) return ender(null, buf);

    // Still more.
    sync(method, model, {
      all: true,
      skip: options.skip+options.limit,
      limit: options.limit,
      error: ender,
      success: function(res){
        if(err) return ender(err);

        buf.push.apply(buf, res);
        ender(null, buf);
      }
    });
  });
}

module.exports.Model = {
  getScopeClient: function(){
    return getClient(_.result(this, 'scope'));
  },
  sync: sync
};

module.exports.Collection = {
  getScopeClient: function(){
    return getClient(_.result(this, 'scope'));
  },
  sync: sync
};

module.exports.Producer = {
  subscriptionHandler: function(data){
    if (!this.set(data)) return false;
    this.trigger('sync', this, data, {});
  },
  subscription: null,
  subscribe: function(){
    var client = this.getScopeClient();
    client.on('change', function(){
      this.unsubscribe().subscribe();
    }.bind(this));

    this.subscription = client.subscribe(_.result(this, 'url'),
      this.subscriptionHandler.bind(this));
    return this;
  },
  unsubscribe: function(){
    this.subscription.unsubscribe();
    this.subscription = null;
    // scope.off('change');
    return this;
  }
};
