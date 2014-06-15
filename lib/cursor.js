var util = require('util'),
  stream = require('stream'),
  debug = require('debug')('mongoscope:client:cursor');

function Batch() {
  if(!(this instanceof Batch)) return new Batch();
  this.message = {};
  this.nReturned = 0;
  this.pos = -1;
  this.data = [];
}

function ClientCursor(ns, query, nToReturn, nToSkip, fieldsToReturn, queryOptions) {
  if(!(this instanceof ClientCursor)){
    return new ClientCursor(ns, query, nToReturn, nToSkip,
      fieldsToReturn, queryOptions);
  }

  ClientCursor.super_.call(this, {objectMode: true});
  this.ns = ns;
  this.query = query || {};
  this.nToReturn = nToReturn || 10;
  this.nToSkip = nToSkip || 0;
  this.fieldsToReturn = fieldsToReturn || null;
  this.queryOptions = queryOptions || {};

  this.cursorId = 0;
  this.batch = new Batch();
  debug('new cursor', ns);
}
util.inherits(ClientCursor, stream.Readable);

ClientCursor.prototype.createBatch = Batch;

ClientCursor.prototype._read = function(){
  debug('_read');
  this.next(function(err, doc){
    if(err) return this.emit('error');
    this.push(doc);
  }.bind(this));
};

ClientCursor.prototype.next = function (fn) {
  this.more(function(err, has){
    debug('more?', err, has);
    if(err) return fn(err);
    if(!has) return fn(null, null);

    this.batch.pos++;
    var o = this.batch.data[this.batch.pos];
    fn(null, o);
  }.bind(this));
};

ClientCursor.prototype.more = function (fn) {
  if(this.batch.pos >= this.nToReturn) {
    return fn(null, false);
  }
  if(this.batch.pos >= 0 && this.batch.pos < (this.batch.nReturned-1)){
    debug('next should be in current batch');
    return fn(null, true);
  }
  debug('need to use a network call', this.batch.pos, this.batch.nReturned);
  this.requestMore(function(err){
    if(err) return fn(err);
    fn(null, this.batch.pos < this.batch.nReturned);
  }.bind(this));
};

// Oh hey!  we found some networking!
ClientCursor.prototype.requestMore = function (fn){
  return fn(new Error('Client should override this'));
  // var info = types.ns(this.ns),
  //   opts = {
  //     query: this.query,
  //     skip: this.nToSkip,
  //     limit: this.nToReturn,
  //     fields: this.fieldsToReturn,
  //     options: this.queryOptions
  //   };
  // debug('getting more', opts);
  // this.client.find(info.database, info.collection, opts, function(err, res){
  //   if(err) return fn(err);

  //   this.batch = new Batch();
  //   this.batch.nReturned = res.length;
  //   this.batch.data = res;
  //   debug('batch is now', this.batch);

  //   this.nToSkip += this.nToReturn;

  //   fn();
  // }.bind(this));
};

ClientCursor.prototype.hasNext = function (fn) {
  this.more(fn);
};

ClientCursor.prototype.objsLeftInBatch = function () {
  return this.batch.nReturned - this.batch.pos;
};

ClientCursor.prototype.moreInCurrentBatch = function () {
  return this.objsLeftInBatch() > 0;
};

module.exports = ClientCursor;
