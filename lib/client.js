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
  pkg = require('../package.json'),
  types = {ns: require('mongodb-ns')},
  valid = require('./valid'),
  debug = require('debug')('mongoscope:client');

module.exports = Client;

function prepare(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
}

function Client(opts){
   if(!(this instanceof Client)) return new Client(opts);

  assert(opts.seed, 'Missing `seed` config value');
  assert(opts.scope, 'Missing `scope` config value');

  this.config = {
    seed: opts.seed,
    scope: opts.scope,
    driver: {
      name: pkg.name,
      version: pkg.version,
      lang: 'javascript'
    }
  };
  debug('new connection', this.config);

  this.context = new Context();
  this.readable = false;
  this.original = true;
  this.dead = false;
  this.closed = false;

  this.token = new Token(this.config)
    .on('readable', this.onTokenReadable.bind(this))
    .on('error', this.onTokenError.bind(this));

  debug('waiting for token to become readable');
}
util.inherits(Client, EventEmitter);

Client.prototype.close = function(fn){
  if(this.io) this.io.close();
  this.emit('close');
  this.closed = true;
  this.token.close(fn);
};

/**
 * Get details of the instance you're currently connected to
 * like database_names, results of the hostInfo and buildInfo mongo commands.
 *
 * @stability production
 */
Client.prototype.instance = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  return this.read('/', opts, fn);
};

/**
 * List all deployments this mongoscope instance has connected to.
 *
 * @stability production
 */
Client.prototype.deployments = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  return this.read('/deployments', opts, fn);
};

/**
 * Get the sharding info for the cluster the instance you're connected
 * to is a member of, similar to the `printShardingStatus()` helper function
 * in the mongo shell.
 *
 * @stability development
 */
Client.prototype.sharding = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  return this.read('/sharding', opts, fn);
};

/**
 * View current state of all members and oplog details.
 *
 * @stability development
 */
Client.prototype.replication = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  return this.read('/replication', opts, fn);
};

/**
 * Capture the deltas of top over `opts.interval` ms.
 *
 * @option {Number} interval Duration of sample in ms default `1000`
 *
 * @stability development
 * @streamable
 */
Client.prototype.top = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  opts._streamable = true;

  return this.read('/top', opts, fn);
};

/**
 * A structured view of the ramlog.
 *
 * @stability development
 * @streamable
 */
Client.prototype.log = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  opts._streamable = true;
  return this.read('/log', opts, fn);
};

/**
 * List collection names and stats.
 *
 * @param {String} name
 *
 * @stability production
 */
Client.prototype.database = function database(name, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  return this.read('/databases/' + name, opts, fn);
};

Client.prototype.destroyDatabase = function(name, fn){
  return this.crud('del', '/databases/' + name, {}, fn);
};

/**
 * Collection stats
 *
 * @param {String} ns
 *
 * @stability production
 */
Client.prototype.collection = function collection(ns, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.read('/collections/' + ns, opts, fn);
};

Client.prototype.createCollection = function(ns, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  var _ns = types.ns(ns);
  return this.crud('post', '/collections/' + _ns.database, {
    name: _ns.collection,
    capped: opts.capped || false,
    max: opts.max || null,
    size: opts.size || null
  }, fn);
};
Client.prototype.destroyCollection = function(ns, fn){
  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.crud('del', '/collections/' + ns, {}, fn);
};

Client.prototype.updateCollection = function(ns, data, fn){
  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.crud('put', '/collections/' + ns, data, fn);
};

// Currently running operations.
//
// @stability development
// @streamable
Client.prototype.ops = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  opts._streamable = true;
  return this.read('/ops', opts, fn);
};

// Kill a currently running operation.
//
// @stability development
Client.prototype.destroyOp = function(opId, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  return this.crud('del', '/ops/' + opId, {}, fn);
};

/**
 * Index details
 *
 * @param {String} ns
 * @param {String} name The index name
 *
 * @stability prototype
 */
Client.prototype.index = function(ns, name, fn){
  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.read('/indexes/' + ns + '/' + name, {}, fn);
};

Client.prototype.createIndex = function(ns, name, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  var params = {field: name, options: opts};
  return this.crud('post', '/indexes/' + ns, params, fn);
};

Client.prototype.updateIndex = function(ns, name, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  var params = {field: name, options: opts};
  return this.crud('put', '/indexes/' + ns, params, fn);
};

Client.prototype.destroyIndex = function(ns, name, fn){
  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.crud('del','/indexes/' + ns +  '/' + name, {}, fn);
};

Client.prototype.getDocument = function(ns, _id, fn){
  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.read('/documents/' + ns + '/' + _id, {}, fn);
};

Client.prototype.updateDocument = function(ns, _id, data, fn){
  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.crud('put', '/documents/' + ns + '/' + _id, data, fn);
};

Client.prototype.createDocument = function(ns, data, fn){
  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.crud('post', '/documents/' + ns, data, fn);
};

Client.prototype.destroyDocument = function(ns, _id, fn){
  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.crud('del', '/documents/' + ns + '/' + _id, {}, fn);
};

/**
 * Run a query on `db.collection`.
 *
 * @param {String} ns
 *
 * @option {Object} query default `{}`
 * @option {Number} limit default `10`, max 200
 * @option {Number} skip default 0
 * @option {Boolean} explain Return explain instead of documents default `false`
 * @option {Object} sort `{key: (1|-1)}` spec default `null`
 * @option {Object} fields
 * @option {Object} options
 * @option {Number} batchSize
 *
 * @stability production
 * @streamable
 */
Client.prototype.find = function(ns, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  if(fn){
    return this.read('/collections/' + ns + '/find', {
      query: JSON.stringify((opts.query || {})),
      limit: (opts.limit || 10),
      skip: (opts.skip || 0),
      explain: (opts.explain || false),
      sort: JSON.stringify((opts.sort || null)),
      fields: JSON.stringify((opts.fields || null)),
      options: JSON.stringify((opts.options || null)),
      batchSize: JSON.stringify((opts.batchSize || null))
    }, fn);
  }

  var client = this,
    cursor = clientCursor(ns, opts.query || {},
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

    client.find(ns, p, function(err, res){
      if(err) return cb(err);
      cursor.batch = cursor.createBatch();
      cursor.batch.nReturned = res.length;
      cursor.batch.data = res;

      cursor.nToSkip += cursor.nToReturn;
      cb();
    });
  };
  return cursor;
};

/**
 *  Run a count on `db.collection`.
 *
 * @param {String} ns
 * @param {Object} opts
 * @param {Function} fn
 * @option {Object} query default `{}`
 * @option {Number} limit default `10`, max 200
 * @option {Number} skip default 0
 * @option {Boolean} explain Return explain instead of documents default `false`
 * @option {Object} sort `{key: (1|-1)}` spec default `null`
 * @option {Object} fields
 * @option {Object} options
 * @option {Number} batchSize
 * @stability production
 */
Client.prototype.count = function(ns, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
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
  return this.read('/collections/' + ns+ '/count', params, fn);
};

/**
 *  Run an aggregation pipeline on `db.collection`.
 *
 * @param {String} ns
 * @param {Array} pipeline
 * @param {Object} opts
 * @option {Boolean} explain
 * @option {Boolean} allowDiskUse
 * @option {Object} cursor
 * @stability development
 */
Client.prototype.aggregate = function(ns, pipeline, opts, fn){
  if(!Array.isArray(pipeline)){
    return fn(new TypeError('pipeline must be an array'));
  }
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.read('/collections/' + ns + '/aggregate', {
    pipeline: JSON.stringify(pipeline),
    explain: (opts.explain || false),
    allowDiskUse: JSON.stringify((opts.allowDiskUse || null)),
    cursor: JSON.stringify((opts.cursor || null)),
    _streamable: true
  }, fn);
};

/**
 *  Use [resevoir sampling](http://en.wikipedia.org/wiki/Reservoir_sampling) to
 *  get a slice of documents from a collection efficiently.
 *
 *  @param {String} ns
 *  @param {Object} opts
 *  @option {Number} size default: 5
 *  @stability prototype
 */
Client.prototype.sample = function(ns, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.read('/collections/' + ns + '/sample', {
    size: opts.size || 5
  }, fn);
};

/**
 *  Convenience to get 1 document via `Client.prototype.sample`.
 *
 * @param {String} ns
 * @param {Object} opts
 * @stability prototype
 */
Client.prototype.random = function(ns, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }

  if(!valid.ns(ns)){
    return fn(new TypeError('Invalid namespace string `' + ns + '`'));
  }

  return this.sample(ns, {size: 1}, function(err, docs){
    if(err) return fn(err);
    fn(null, docs[0]);
  });
};

/**
 * Get or stream a group of analytics.
 *
 * @param {String} group One of `Client.prototype.analytics.groups`
 * @stability prototype
 * @streamable
 */
Client.prototype.analytics = function(group, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  if(this.analytics.groups.indexOf(group) === -1){
    var msg = 'Unknown analytics group `'+group+'`';
    if(fn) return fn(new Error(msg));
    throw new Error(msg);
  }
  return this.read('/analytics/' + group, {
    interval: opts.interval || 1000
  }, fn);
};

Client.prototype.analytics.groups = [
  'durability', 'operations', 'memory', 'replication', 'network', 'indexes'
];

/**
 * Working set size estimator.
 *
 * @stability prototype
 */
Client.prototype.workingSet = function(opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  return this.read('/working-set', {}, fn);
};

/**
 * Maps backbone.js/express.js style routes to `Client.prototype` methods.
 *
 * @api private
 */
Client.prototype.routes = {
  '/instance': 'instance',
  '/deployments': 'deployments',
  '/deployments/:deployment_id': 'deployment',
  '/databases/:database': 'database',
  '/collections/:ns/count': 'count',
  '/collections/:ns/find': 'find',
  '/collections/:ns/aggregate': 'aggregate',
  '/log': 'log',
  '/top': 'top',
  '/replication': 'replication',
  '/sharding': 'sharding'
};

/**
 * Route `fragment` to a call on `Client.prototype`, which is substantially
 * easier for users on the client-side.  More detailled usage is available
 * in the [backbone.js adapter](/lib/backbone.js).
 *
 * @param {String} fragment One of `Client.prototype.routes`
 * @param {Object} [params]
 * @param {Function} [fn]
 *
 * @stability development
 */
Client.prototype.get = function(fragment, opts, fn){
  opts = opts || {};
  if(typeof opts === 'function'){
    fn = opts;
    opts = {};
  }
  var resolved = this.resolve(fragment),
    handler = resolved[0],
    args = resolved[1];

  args.push.apply(args, [opts, fn]);
  return handler.apply(this, args);
};

Client.prototype.resolve = function(fragment){
  if(!this.router) this.router = createRouter(this.routes);
  var route = this.router.resolve(fragment);
  return [this[route.method], route.args];
};

Object.defineProperty(Client.prototype, 'backbone',
  {enumerable: true, writeable: false, configurable: false, get: function(){
    if(!this.adapters) this.adapters = {};
    if(!this.adapters.backbone){
      this.adapters.backbone = require('./adapters/backbone.js')(this);
    }
    return this.adapters.backbone;
  }});

/**
 * Point at a difference instance.
 *
 * @param {String} seed
 */
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

/**
 * All read requests come through here.
 * Handles queuing if still connecting and promoting streamables.
 *
 * @param {String} path Everything under `/api/v1` automatically prefixing instance.
 * @param {Object} [params]
 * @param {Function} [fn]
 *
 * @api private
 */
Client.prototype.read = function(path, params, fn){
  if(this.dead) return fn(this.dead);
  if(!this.readable) return this.on('readable', this.read.bind(this, path, params, fn));

  if(typeof params === 'function'){
    fn = params;
    params = {};
  }
  var instance_id = this.context.get('instance_id'),
    streamable = params._streamable;
  delete params._streamable;

  if(!fn && !streamable){
    var msg = 'not streamable and missing callback';
    if(fn) return fn(new Error(msg));
    throw new Error(msg);
  }

  if(streamable && !fn) return new Subscription(this, path, params);

  path = (path === '/') ? '/' + instance_id :
    (path !== '/deployments') ? '/' + instance_id + path : path;

  return request.get(this.config.scope + '/api/v1' + path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + this.token.toString())
    .query(params)
    .end(this.ender(fn));
};

Client.prototype.ender = function(fn){
  return function(err, res){
    if(!err && res.status >= 400){
      err = new Error(res.body ? res.body.message : res.text);
      Error.captureStackTrace(err, Client.prototype.ender);
      err.status = res.status;
    }
    fn.apply(null, [err, (res && res.body), res]);
  };
};

Client.prototype.crud = function(method, path, data, fn){
  prepare(data, fn);
  if(this.dead) return fn(this.dead);
  if(!this.readable) return this.on('readable', this.crud.bind(this, method, path, data, fn));

  var instance_id = this.context.get('instance_id'), req;
  req = request[method](this.config.scope + '/api/v1/' + instance_id + path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + this.token.toString());

  if(method !== 'del') req.type('json').send(data);

  return req.end(this.ender(fn));
};


/**
 * When we've acquired a security token, do child connections (eg socketio)
 * and unload handlers.
 *
 * If we're reusing an instance, but the user has changed context,
 * emit `change` so any open streams can easily end the old one
 * and open a new stream on the current one.
 *
 * @api private
 */
Client.prototype.onTokenReadable = function(){
  debug('token now readable', this.token.session);
  this.context.set(this.token.session);
  this.io = socketio(this.config.scope);
  this.readable = true;
  this.emit('readable');

  if(!this.original){
    this.emit('change');
  }
  else {
    if(window && window.document){
      if(window.attachEvent){
        window.attachEvent('onunload', this.onUnload.bind(this));
      }
      else if(window.addEventListener){
        window.addEventListener('beforeunload', this.onUnload.bind(this));
      }
    }
    else if(process && process.on){
      process.on('exit', this.onUnload.bind(this));
    }
  }
};

/**
 * On browser window unload or process exit if running in nodejs,
 * make sure we clean up after ourselves.
 *
 * @api private
 */
Client.prototype.onUnload = function(){
  if(!this.closed) this.close();
};

/**
 * When a token error occurs, the browser can't provide us with good
 * context in the error, so for now assuming all token errors
 * mean mongoscope is not running.
 *
 * @param {Error} err
 * @api private
 */
Client.prototype.onTokenError = function(err){
  this.dead = err;
  this.dead.message += ' (mongoscope server dead at '+this.config.scope+'?)';
  this.emit('error', err);
};
