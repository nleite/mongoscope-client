var request = require('superagent'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  Token = require('./token'),
  Context = require('./context'),
  assert = require('assert'),
  debug = require('debug')('mongooscope:client:client');

module.exports = Client;

function Client(opts){
   if(!(this instanceof Client)) return new Client(opts);

  var self = this;
  this.config = {
    seed: opts.seed,
    scope: opts.scope
  };

  this.context = new Context();

  this.queuedRequests = [];
  this.ready = false;

  // @todo: tokens should be a map instead of a single.  switching context
  // should also create/use cached token.
  this.token = new Token(this.config).on('error', function(err){
    self.emit('error', err);
  }).on('ready', function(){
    debug('token consuming queue of ', self.queuedRequests);
    self.context.set(self.token.session);
    self.ready = true;
    self.consume();
    self.emit('ready');
  });
}
util.inherits(Client, EventEmitter);

// ## context
// @todo: fires context change
Client.prototype.connect = function(seed){
  return new Client({scope: this.config.scope, seed: seed});
};

// Get details of the instance you're currently connected to
// like database_names, results of the hostInfo and buildInfo mongo commands.
// @api public
Client.prototype.instance = function(fn){
  if(!this.ready) return this.queue('instance', fn);
  return this.read('/', fn);
};

// List all deployments this mongoscope instance has connected to.
// @api public
Client.prototype.deployments = function(fn){
  if(!this.ready) return this.queue('deployment', fn);
  return this.read('../', fn);
};

// Get the sharding info for the cluster the instance you're connected
// to is a member of, similar to the `printShardingStatus()` helper function
// in the mongo shell.
// @api public
Client.prototype.sharding = function(fn){
  if(!this.ready) return this.queue('sharding', fn);
  return this.read('/sharding', fn);
};

Client.prototype.replication = function(fn){
  if(!this.ready) return this.queue('replication', fn);
  return this.read('/replication', fn);
};

Client.prototype.top = function(fn){
  if(!this.ready) return this.queue('top', fn);
  return this.read('/top', fn);
};

Client.prototype.log = function(fn){
  if(!this.ready) return this.queue('log', fn);
  return this.read('/log', fn);
};

// ## database resource
Client.prototype.database = function(name, fn){
  if(!this.ready) return this.queue('database', name, fn);
  return this.read('/' + name, fn);
};

// ## collection resource

// Run a query on `db`'s `collection`.
//
// @param {String} db
// @param {String} collection
// @param {Objects} opts
// @param {Function} fn
// @option {Object} query default `{}`
// @option {Number} limit default `10`, max 200
// @option {Number} skip default 0
// @option {Boolean} explain Return explain instead of documents default `false`
// @option {Object} sort `{key: (1|-1)}` spec default `null`
// @option {Object} fields
// @option {Object} options
// @option {Number} batchSize
// @api public
// @streamable
Client.prototype.find = function(db, collection, opts, fn){
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  var params = {
    query: JSON.stringify((opts.query || {})),
    limit: (opts.limit || 10),
    skip: (opts.skip || 0),
    explain: (opts.explain || false),
    sort: JSON.stringify((opts.sort || null)),
    fields: JSON.stringify((opts.fields || null)),
    options: JSON.stringify((opts.options || null)),
    batchSize: JSON.stringify((opts.batchSize || null))
  };

  if(!this.ready) return this.queue('find', db, collection, opts, fn);

  return this.read('/' + db + '/' + collection + '/find')
    .query(params).end(ender(fn));
};

// Run a count on `db`'s `collection`.
//
// @param {String} db
// @param {String} collection
// @param {Object} opts
// @param {Function} fn
// @option {Object} query default `{}`
// @option {Number} limit default `10`, max 200
// @option {Number} skip default 0
// @option {Boolean} explain Return explain instead of documents default `false`
// @option {Object} sort `{key: (1|-1)}` spec default `null`
// @option {Object} fields
// @option {Object} options
// @option {Number} batchSize
// @api public
// @streamable
Client.prototype.count = function(db, collection, opts, fn){
    if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  var params = {
    query: JSON.stringify((opts.query || {})),
    limit: (opts.limit || 10),
    skip: (opts.skip || 0),
    explain: (opts.explain || false),
    sort: JSON.stringify((opts.sort || null)),
    fields: JSON.stringify((opts.fields || null)),
    options: JSON.stringify((opts.options || null)),
    batchSize: JSON.stringify((opts.batchSize || null))
  };

  if(!this.ready) return this.queue('count', db, collection, opts, fn);

  return this.read('/' + db + '/' + collection + '/count')
    .query(params).end(ender(fn));
};

// Run an aggregation pipeline on `db`.`collection`.
//
// @param {String} db
// @param {String} collection
// @param {Array} pipeline
// @param {Object} opts
// @option {Boolean} explain
// @option {Boolean} allowDiskUse
// @option {Object} cursor
// @api public
Client.prototype.aggregate = function(db, collection, pipeline, opts, fn){
  if(!Array.isArray(pipeline)) return fn(new TypeError('pipeline must be an array'));

  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  var params = {
    pipeline: JSON.stringify(pipeline),
    explain: (opts.explain || false),
    allowDiskUse: JSON.stringify((opts.allowDiskUse || null)),
    cursor: JSON.stringify((opts.cursor || null))
  };
  if(!this.ready) return this.queue('aggregate', db, collection, pipeline, opts, fn);

  return this.read('/' + db + '/' + collection + '/aggregate')
    .query(params).end(ender(fn));
};

// ## Router based API
//
// Makes client apps so much simpler because they need extremely little domain
// logic to use the hell out of an api.
//
// Example:
//
// ```javascript
// var scope = require('mongoscope-client')('http://localhost:29017');
// Backbone.sync = function(method, model, options){
//   var url = _.result(this, 'url');
//   scope.call(url, function(err, res){
//     if(err) return options.error(err);
//     options.success(res);
//   });
// };
// ```
// @todo: how could named params in routes and context play nicely?
// thinking specifically about the case of all the typing required to operate
// on a collection (peep scope's collection api routes).
var routes = {
  '/': 'instance',
  '../': 'deployments',
  '/:database/:collection/count': 'count',
  '/:database/:collection/find': 'find',
  '/log': 'log',
  '/top': 'top',
  '/replication': 'replication',
  '/sharding': 'sharding',
  '/:database': 'database',
};

function getRouter(def){
  var _routes = [],
    optionalParam = /\((.*?)\)/g,
    namedParam = /(\(\?)?:\w+/g,
    splatParam = /\*\w+/g,
    escapeRegExp = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  Object.keys(def).map(function(spec){
    var regex = spec.replace(escapeRegExp, '\\$&')
       .replace(optionalParam, '(?:$1)?')
       .replace(namedParam, function(match, optional) {
         return optional ? match : '([^/?]+)';
       })
       .replace(splatParam, '([^?]*?)');

    _routes.push({
      spec: spec,
      method: def[spec],
      regex: new RegExp('^' + regex + '(?:\\?([\\s\\S]*))?$')
    });
  });

  function params(route, fragment){
    var p = route.regex.exec(fragment).slice(1);
    return Object.keys(p).map(function(param, i){
      if (i === p.length - 1) return param || null;
      return param ? decodeURIComponent(param) : null;
    });
  }


  return function(url){
    var res;
    _routes.every(function(_route){
      if(_route.regex.test(url)){
        res.method = _route.method;
        res.args = params(_route, url);
        return false;
      }
    });
    if(!res){
      throw new Error('No route found for: ' + url);
    }
    return res;
  };
}

// @todo: takes a url and figures out which client method to call.
Client.prototype.call = function(url, fn){
  if(!this.router){
    this.router = getRouter(routes);
  }
  if(Array.isArray(url)){
    url = '/' + url.join('/');
  }

  var route = this.router(url);
  route.args.push(fn);
  return this[route.method].apply(this, route.args);
};

// @todo: implement as a node readable stream.
function Subscription(scope, url, handler){
  this.scope = scope;
  this.url = url;
  this.handler = handler;
  this.payload = scope.context.get('token', 'instance_id');

  process.nextTick(function(){
    // srv.io
    //   .addListener(url, handler)
    //   .emit(url, this.payload);
  });
}

Subscription.prototype.unsubscribe = function(){
  // srv.io
  //   .removeAllListeners(this.url)
  //   .emit(this.url + '/unsubscribe', this.payload);
};

Client.prototype.subscribe = function(url, handler){
  return new Subscription(this, url, handler);
};

// ## internals
function ender(fn){
  return function(err, res){
    if(err) return fn(err);
    fn(null, res.body);
  };
}

// @todo: if context has multiple instances, we should hit the server and
// the callback for each instance.
//
// @api private
Client.prototype.read = function(path, fn){
  var req, url, instance_id = this.context.get('instance_id');

  if(path === '/'){
    url = this.url('/' + instance_id);
  }
  else if(path.indexOf('../') === 0){
    url = this.url(path.replace('../', '/'));
  }
  else {
    assert(instance_id, 'Client context has no instance');
    url = this.url('/' + instance_id + path);
  }

  req = request.get(url)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + this.token.toString());

  if(fn) req.end(function(err, res){fn(err, res.body);});
  return req;
};

// @api private
Client.prototype.url = function(path){
  return this.config.scope + '/api/v1' + path;
};

// @api private
Client.prototype.consume = function(){
  var self = this;
  this.queuedRequests.map(function(q){
    self[q.method].apply(self, q.args);
  });
  return this;
};

// @api private
Client.prototype.queue = function(){
  var args = Array.prototype.slice.call(arguments, 0),
    method = args.shift();
  this.queuedRequests.push({method: method, args: args});
  return this;
};

// Install facade methods against the shell api people are more accustomed to.
var facade = {
  listDatabases: ['instance', 'database_names'],
  getCollectionNames: ['database', 'collection_names'],
};

Object.keys(facade).map(function(shellMethod){
  var method = facade[shellMethod][0];

  Client.prototype[shellMethod] = function(){
    var args = Array.prototype.slice.call(arguments, 0),
      fn = args.pop();
    args.push(function(err, data){
      if(err) return fn(err);

      if(facade[shellMethod][1]) return fn(null, data[facade[shellMethod][1]]);
      fn(null, data);
    });
    this[method].apply(this, args);
  };
});
