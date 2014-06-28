var Client = require('../client'),
  assert = require('assert'),
  types = {
    ns: require('mongodb-ns'),
    uri: require('mongodb-uri')
  },
  debug = require('debug')('mongoscope-client:backbone');

var clients = {}, defaultClient = null;

var _mongodb = function(resource){
  var uri = _result(resource, 'mongodb');
  if(!uri) return null;

  if(uri.indexOf('mongodb://') !== 0){
    uri = 'mongodb://' + uri;
  }

  var info = types.uri.parse(uri),
    ns = null;

  resource.mongodb = info.hosts[0].host + ':' + info.hosts[0].port;

  if(info.database && !resource.url){
    ns = types.ns(info.database);
    resource.url = '/databases/' + ns.database;
    if(ns.collection){
      resource.url += '/collections/' + ns.collection;
    }
  }
  return resource;
};

var _result = function(resource, key){
  return (typeof resource[key] === 'function') ? resource[key]() : resource[key];
};

function use(resource){
  var endpoint,
    config,
    seed,
    clientId;

  assert(resource, 'Missing backbone resource');

  if(!resource.mongoscope && !resource.mongodb){
    assert(defaultClient, 'No default mongoscope client set');
    return defaultClient;
  }

  if(resource.mongodb && !resource.url){
    _mongodb(resource);
  }

  endpoint = _result(resource, 'mongoscope') || defaultClient.config.scope;

  assert(endpoint, 'Where is mongoscope running?');

  config = {seed: _result(resource, 'mongodb'), scope: endpoint};
  clientId = endpoint + '/' + seed;

  if(!clients[clientId]) clients[clientId] = new Client(config);

  return clients[clientId];
}

function sync(method, attrs, options){
  var url = options.url,
    // Backbone resources will set the current closures context to
    // the resource instance.
    resource = this,
    client = options.client || use(resource),
    ender = function(err, res){
      if(err) return options.error(err);
      options.success(res);
    };

  // if(method !== 'read'){
  //   throw new Error('mongoscope is readonly, so create, update, ' +
  //     'patch, and delete sync methods are not available.');
  // }

  if(!options.url){
    url = _result(resource, 'url');
  }

  if(!url){
    throw new Error('A "url" property or function must be specified');
  }

  var params = {}, docs = [];
  Object.keys(options).map(function(k){
    if(['error', 'success', 'client', 'parse'].indexOf(k) === -1){
      params[k] = options[k];
    }
  });

  if(method === 'read'){
    if(!options.all) return client.get(url, params, ender);

    return client.get(url, params)
      .on('error', ender)
      .on('data', function(doc){docs.push(doc);})
      .on('end', function(){
        ender(null, docs);
      });
  }

  if(method === 'destroy'){
    var info = client.resolve(url);
    if(!info) throw new Error('Could not resolve ' + url);

    var handler = info[0],
      args = info[1];

    if(!handler.destroy) throw new Error('No destory hnadler found for' + handler);

    args.push(ender);
    return handler.destroy.apply(client, args);
  }
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

module.exports.clients = clients;
