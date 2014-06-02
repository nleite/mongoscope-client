var util = require('util'),
  EventEmitter = require('events').EventEmitter;

module.exports = Context;

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
