var request = require('superagent'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  Token = require('./token'),
  assert = require('assert'),
  debug = require('debug')('mongooscope:client:client');

module.exports = Client;

function Context(){
  this.data = {
    deployment_id: null,
    instance_id: null
  };
}

util.inherits(Context, EventEmitter);

Context.prototype.get = function(k){
  var args = Array.prototype.slice.call(arguments, 0);
  if(args.length === 1){
    return this.data[k];
  }

  var res = {};
  for(var _k in k){
    res[_k] = k[_k];
  }
  return res;
};

Context.prototype.set = function(obj){
  var changed = false, self = this, prev = {};
  for(var k in obj){
    if(obj[k] !== this.data[k]){
      prev[k] = this.data[k];
      this.data[k] = obj[k];
      changed = true;
    }
  }
  if(changed){
    process.nextTick(function(){
      self.emit('change', {incoming: obj, previous: prev});
    });
  }

  return this;
};

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

// ## instance resource
Client.prototype.instance = function(fn){
  if(!this.ready) return this.queue('instance', fn);
  this.read('/', fn);
  return this;
};

Client.prototype.deployments = function(fn){
  if(!this.ready) return this.queue('deployment', fn);
  this.read('../', fn);
  return this;
};

Client.prototype.sharding = function(fn){
  if(!this.ready) return this.queue('sharding', fn);
  this.read('/sharding', fn);
  return this;
};

Client.prototype.replication = function(fn){
  if(!this.ready) return this.queue('replication', fn);
  this.read('/replication', fn);
  return this;
};

Client.prototype.top = function(fn){
  if(!this.ready) return this.queue('top', fn);
  this.read('/top', fn);
  return this;
};

Client.prototype.log = function(fn){
  if(!this.ready) return this.queue('log', fn);
  this.read('/log', fn);
  return this;
};

// ## database resource
Client.prototype.database = function(name, fn){
  if(!this.ready) return this.queue('database', name, fn);
  this.read('/' + name, fn);
  return this;
};

// ## collection resource
Client.prototype.find = function(db, coll, opts, fn){
  var query = opts.query || {},
    limit = opts.limit || 10,
    skip = opts.skip || 0;

  if(!this.ready) return this.queue('find', db, coll, opts, fn);

  this.read('/' + db + '/' + coll + '/find')
    .query({query: JSON.stringify(query), limit: limit, skip: skip}).end(ender(fn));
  return this;
};

Client.prototype.count = function(db, coll, where, fn){
  if(!this.ready) return this.queue('count', db, coll, where, fn);

  this.read('/' + db + '/' + coll + '/count')
    .query({where: JSON.stringify(where)}).end(ender(fn));
  return this;
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
  this[route.method].apply(this, route.args);
};


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

// The guts of context switching.
//
// @api private
Client.prototype.switch = function(){
  if(!this.ready) return this.queue.apply(this, ['switch', arguments]);

  var self = this,
    args = Array.prototype.slice.call(arguments, 0);

  if(typeof args[0] === 'string' && typeof args[1] === 'string'){
    self.context.set({deployment_id: args[0], instance_id: args[1]});
  }
  return this;
};

function Deployment(data){
  for(var k in data){
    if(data.hasOwnProperty(k)){
      this[k] = data[k];
    }
  }
}

// @todo: fires client context change
Deployment.prototype.router = function(){
  return this.routers()[0];
};

Deployment.prototype.routers = function(){
  return this.instances.filter(function(i){return i.type === 'router';});
};

Deployment.prototype.replicaset = function(name){
  var rs = new ReplicaSet();
  rs.instances = this.instances.filter(function(i){
    return i.rs === name;
  });
  rs.deployment = this;
  return rs;
};

Deployment.prototype.shard = function(name){
  var sh = new Shard();
  sh.instances = this.instances.filter(function(i){
    return i.shard === name;
  });
  sh.deployment = this;
  return sh;
};

function ReplicaSet(){}
ReplicaSet.prototype.primary = function(){
  return this.instances.filter(function(i){
    return i.state === 'primary';
  })[0];
};


function Shard(){}
util.inherits(Shard, ReplicaSet);

// ## internals
function ender(fn){
  return function(err, res){
    if(err) return fn(err);
    fn(null, res.body);
  };
}


// @todo: need to have a way to cleanly close the stream/stop watching/unsubscribe.
//
// @api private
Client.prototype.createReadStream = function(path){
  return request.get(this.url(path))
    .set('Accept', 'text/event-stream')
    .set('Authorization', 'Bearer ' + this.token.toString());
};

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
