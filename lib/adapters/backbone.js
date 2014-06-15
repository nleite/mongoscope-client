// Put mongoscope behind your backbone.js models and collections!
//
// Examples:
//
// ```javascript
// var scope = window.mongoscope(),
//   mackbone = scope.backbone,
//   extend = Backbone.extend,
//   Collection = Backbone.Collection.extend(mackbone.Collection),
//   Model = Backbone.Collection.extend(mackbone.Model);
//
// // Extending from mongoscope's backbone adapter sure is nice and sweet...
// var Instance = Model.extend({url: '/instance'});
//
// var Logs = Collection.extend(extend({
//   model: Model.extend({
//     defaults: {
//       threadname: 'default',
//       message: 'Some MongoDB log message',
//       timestamp: new Date()
//     }
//   })
// }, mackbone.ReadableStream));
//
// var InstanceLogView = Backbone.View.extend({
//   initialize: function(){
//     this.instance = new Instance()
//       // Client has changed what instance we're pointing to
//       // so re-enter the view.
//       .on('change', this.enter, this);
//     this.logs = new Logs();
//   },
//   enter: function(){
//     var self = this;
//     // We navigated to this view, so get data from the backend.
//     this.instance.fetch(function(instance, data, options){
//       // Create a new logs subscription that will stream
//       // us new log entries as they come in.
//       self.logs.subscribe().once('sync', function(collection, data, options){
//         // The first data will be an initial set (500 lines or so)
//         // we can prepoplate.
//         self.insert();
//         self.logs.on('sync', self.update, self);
//       });
//     });
//   },
//   insert: function(){
//     // Set the initial DOM.
//     this.$el.html(this.tpl({
//       instance: this.instance.toJSON(),
//       logs: this.logs.toJSON()
//     }));
//   },
//   update: function(collection, freshLogs, options){
//     // Update dom with your fresh log lines.
//   },
//   exit: function(){
//     // Navigating away so be nice and close the log stream.
//     this.logs.unsunscribe();
//     return this;
//   }
// });
// new InstanceLogView({el: '.instance-logs'}).enter();
// ```
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

  if(!options.all) return client.get(url, ender);

  options.skip |= 0;
  options.limit |= 200;

  var buf = [];
  client.get(url, {skip: options.skip, limit: options.limit}, function(err, res){
    if(err) return ender(err);

    buf.push.apply(buf, res);

    // exhausted
    if(res.length === 0 || res.length !== options.limit) return ender(null, buf);

    // Still more.
    sync(method, attrs, {
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
