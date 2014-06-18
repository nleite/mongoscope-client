var request = require('superagent'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  Token = require('./token'),
  Context = require('./context'),
  createRouter = require('./router'),
  clientCursor = require('./cursor'),
  Subscription = require('./subscription'),
  assert = require('assert'),
  socketio = require('socket.io-client'),
  debug = require('debug')('mongoscope:client');

module.exports = Client;

function Client(opts){
   if(!(this instanceof Client)) return new Client(opts);

  this.config = {seed: opts.seed, scope: opts.scope};
  debug('new connection', this.config);

  this.context = new Context();
  this.readable = false;
  this.original = true;

  this.token = new Token(this.config)
    .on('readable', this.onTokenReadable.bind(this))
    .on('error', this.emit.bind(this, 'error'));

  debug('waiting for token to become readable');
}
util.inherits(Client, EventEmitter);

Client.prototype.close = function(){
  this.io.close();
  this.token.close();
  this.emit('close');
};

// Get details of the instance you're currently connected to
// like database_names, results of the hostInfo and buildInfo mongo commands.
//
// @stability production
Client.prototype.instance = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  return this.read('/', opts, fn);
};

// List all deployments this mongoscope instance has connected to.
//
// @stability production
Client.prototype.deployments = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  return this.read('/deployments', opts, fn);
};

// Get the sharding info for the cluster the instance you're connected
// to is a member of, similar to the `printShardingStatus()` helper function
// in the mongo shell.
//
// @stability development
Client.prototype.sharding = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  return this.read('/sharding', opts, fn);
};

// View current state of all members and oplog details.
//
// @stability development
Client.prototype.replication = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  return this.read('/replication', opts, fn);
};

// Capture the deltas of top over `opts.interval` ms.
//
// @option {Number} interval Duration of sample in ms default `1000`
//
// @stability development
// @streamable
Client.prototype.top = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  opts._streamable = true;

  return this.read('/top', opts, fn);
};

// A structured view of the ramlog.
//
// @stability development
// @streamable
Client.prototype.log = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  opts._streamable = true;
  return this.read('/log', opts, fn);
};

// List collection names and stats.
//
// @param {String} name
//
// @stability production
Client.prototype.database = function(name, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  return this.read('/' + name, opts, fn);
};

// ## collection resource

// Run a query on `db`'s `collection`.
//
// @param {String} db
// @param {String} collection
//
// @option {Object} query default `{}`
// @option {Number} limit default `10`, max 200
// @option {Number} skip default 0
// @option {Boolean} explain Return explain instead of documents default `false`
// @option {Object} sort `{key: (1|-1)}` spec default `null`
// @option {Object} fields
// @option {Object} options
// @option {Number} batchSize
//
// @stability production
// @streamable
Client.prototype.find = function(db, collection, opts, fn){
  assert(db);
  assert(collection);

  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  if(!fn){}

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

  if(fn) return this.read('/' + db + '/' + collection + '/find', params, fn);

  var client = this,
    cursor = clientCursor(db + '.' + collection, opts.query || {},
      opts.limit || 100, opts.skip || 0, opts.fields || null,
      opts.options || null);

  cursor.requestMore = function(cb){
    var p = {
      query: cursor.query,
      skip: cursor.nToSkip,
      limit: cursor.nToReturn,
      fields: cursor.fieldsToReturn,
      options: cursor.queryOptions
    };

    debug('getting more', p);
    client.find(db, collection, p, function(err, res){
      if(err) return cb(err);
      cursor.batch = cursor.createBatch();
      cursor.batch.nReturned = res.length;
      cursor.batch.data = res;
      debug('batch is now', cursor.batch);
      cursor.nToSkip += cursor.nToReturn;
      cb();
    });
  };
  return cursor;
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
//
// @stability production
Client.prototype.count = function(db, collection, opts, fn){
  opts = opts || {};
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
  return this.read('/' + db + '/' + collection + '/count', params, fn);
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
//
// @stability development
Client.prototype.aggregate = function(db, collection, pipeline, opts, fn){
  if(!Array.isArray(pipeline)){
    return fn(new TypeError('pipeline must be an array'));
  }

  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  var params = {
    pipeline: JSON.stringify(pipeline),
    explain: (opts.explain || false),
    allowDiskUse: JSON.stringify((opts.allowDiskUse || null)),
    cursor: JSON.stringify((opts.cursor || null)),
    _streamable: true
  };

  return this.read('/' + db + '/' + collection + '/aggregate', params, fn);
};

// ## Helpers
// Maps backbone.js/express.js style routes to `Client.prototype` methods.
Client.prototype.routes = {
  '/instance': 'instance',
  '/deployments': 'deployments',
  '/databases/:database': 'database',
  '/databases/:database/collections/:collection/count': 'count',
  '/databases/:database/collections/:collection/find': 'find',
  '/log': 'log',
  '/top': 'top',
  '/replication': 'replication',
  '/sharding': 'sharding'
};

// Route `fragment` to a call on `Client.prototype`, which is substantially
// easier for users on the client-side.  More detailled usage is available
// in the [backbone.js adapter](/lib/backbone.js).
//
// @stability development
Client.prototype.get = function(fragment, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  if(!this.router) this.router = createRouter(this.routes);
  var route = this.router.resolve(fragment);
  route.args.push.apply(route.args, [opts, fn]);
  return this[route.method].apply(this, route.args);
};

Object.defineProperty(Client.prototype, 'backbone',
  {enumerable: true, writeable: false, configurable: false, get: function(){
    if(!this.adapters) this.adapters = {};
    if(!this.adapters.backbone){
      this.adapters.backbone = require('./adapters/backbone.js')(this);
    }
    return this.adapters.backbone;
  }});

// Point at a difference instance.
Client.prototype.connect = function(seed){
  if(seed === this.config.seed){
    debug('already connected to ' + seed);
    return this;
  }


  this.readable = false;
  this.token.close();
  this.original = false;

  this.config.seed = seed;
  this.token = new Token(this.config)
    .on('readable', this.onTokenReadable.bind(this))
    .on('error', this.emit.bind(this, 'error'));
  return this;
};

// ## Internals

// @api private
Client.prototype.read = function(path, params, fn){
  if(!this.readable){
    debug('not readable yet.  defering until event fired');
    return this.on('readable', this.read.bind(this, path, params, fn));
  }

  var instance_id = this.context.get('instance_id');
  assert(instance_id, 'Client context has no instance');

  if(typeof params === 'function'){
    fn = params;
    params = {};
  }
  else {
    params = params || {};
  }

  assert(typeof params !== 'function');

  if(!fn){
    if(!params._streamable){
      throw new TypeError(path + ' is not streamable.  Please supply a callback function.');
    }

    delete params._streamable;
    return new Subscription(this, path, params);
  }

  if(path === '/'){
    path = '/' + instance_id;
  }
  else if(path === '/deployments'){
    path = '/';
  }
  else {
    path = '/' + instance_id + path;
  }

  // @todo: kind of gross, but meh.
  delete params._streamable;

  debug('GET ' + this.config.scope + '/api/v1' + path, params);

  return request
    .get(this.config.scope + '/api/v1' + path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + this.token.toString())
    .query(params)
    .end(function(err, res){
      if(!err && res.status >= 400){
        err = new Error(res.body.message);
        err.code = res.body.code;
        err.http = res.body.http;
        Error.captureStackTrace(err, Client.prototype.read);
      }
      debug('result', 'GET ' + this.config.scope + '/api/v1' + path, err, res.body);
      fn.apply(this, [err, (res && res.body)]);
    }.bind(this));
};

// @api private
Client.prototype.onTokenReadable = function(){
  debug('token now readable', this.token.session);
  this.context.set(this.token.session);
  this.io = socketio(this.config.scope);
  this.readable = true;
  this.emit('readable');

  // If we're reusing an instance, but the user has changed context,
  // emit a change so any open streams can easily end the old one
  // and open a new stream on the current one.
  if(!this.original) this.emit('change');
};
