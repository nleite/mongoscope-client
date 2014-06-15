var Client = require('../client'),
  assert = require('assert');

var clients = {}, defaultClient = null;

function use(resource){
  var endpoint;
  if(resource && resource.mongoscope){
    if(typeof resource.mongoscope !== 'function'){
      endpoint = resource.mongoscope;
    }
    else {
      endpoint = resource.mongoscope.apply(resource);
    }
  }
  else{
    assert(defaultClient, 'No default mongoscope client set');
    return defaultClient;
  }

  assert(endpoint, 'Where is mongoscope running?');

  if(!clients[endpoint]){
    clients[endpoint] = new Client({scope: endpoint});
  }

  return clients[endpoint];
}

function sync(method, attrs, options){
  var url = options.url,
    // Backbone resources will set the current closures context to
    // the resource instance.
    resource = this,
    client = options.client,
    ender = function(err, res){
      if(err) return options.error(err);
      options.success(res);
    };

  if(method !== 'read'){
    throw new Error('mongoscope is readonly, so create, update, ' +
      'patch, and delete sync methods are not available.');
  }

  if(!options.url){
    url = (typeof resource.url === 'function') ? resource.url() : resource.url;
  }

  if(!url){
    throw new Error('A "url" property or function must be specified');
  }

  if(!options.all) return client.get(url, options, ender);

  var docs = [];
  client.get(url, options)
    .on('error', ender)
    .on('data', function(doc){docs.push(doc);})
    .on('end', function(){
      ender(null, docs);
    });
}

module.exports = function(client){
  defaultClient = client;
  return module.exports;
};

module.exports.Model = {
  sync: sync
};

module.exports.Collection = {
  sync: sync
};

module.exports.ReadableStream = {
  subscription: null,
  subscribe: function(){
    var resource = this,
      client = use(resource),
      url = (typeof resource.url === 'function') ? resource.url() : resource.url;

    this.subscription = client.get(url)
      .on('error', function(err){
        resource.trigger('error', err, resource, {client: client});
      })
      .on('data', function(data){
        if (!resource.set(data)) return false;
        resource.trigger('sync', resource, data, {client: client});
      });

    // If the client context changes, move our subscription.
    this.subscription.client.on('change', function(){
      this.unsubscribe();
      this.subscribe();
    }.bind(this));

    return resource;
  },
  unsubscribe: function(){
    this.subscription.close();
    this.subscription = null;
    return this;
  }
};
