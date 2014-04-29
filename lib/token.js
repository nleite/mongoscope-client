var request = require('superagent'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  debug = require('debug')('mongooscope:client:token');

module.exports = Token;

function Token(config){
  if(!(this instanceof Token)) return new Token(config);

  this.config = config;
  this.expirationRedLine = 15 * 1000;
  this.session = {};

  process.nextTick(function(){
    debug('creating');
    this.bake(function(err, res){
      if(err) return this.emit('error', err);

      this.session = res;
      this.schedule();

      debug('sending ready');
      this.ready = true;
      this.emit('ready');
    }.bind(this));
  }.bind(this));
}
util.inherits(Token, EventEmitter);

Token.prototype.toString = function(){
  return this.session.token;
};

Object.defineProperty(Token.prototype, 'token', {get: function(){
  return this.session.token;
}});

Token.prototype.bake = function(done){
  debug('getting token for', this.config.seed);
  request.post(this.config.scope + '/api/v1/token')
    .send({seed: this.config.seed})
    .end(function(err, res){
      debug('got token response', res.body);

      if(err) return done(err);

      if(!res.body.expires_at || !res.body.created_at){
        return done(new Error('Malformed response.  Missing expires_at or created_at'));
      }

      if(new Date(res.body.expires_at) - Date.now() < (1 * 60 * 1000)){
        return done(new Error('Got an expires that is less than a minute from now.'));
      }

      done(null, res.body);
    }.bind(this));
};

Token.prototype.refresh = function(){
  this.bake(function(err, res){
    if(err) this.emit('error', err);
    this.session = res;

    debug('token refreshed successfully');
    return this.schedule();
  }.bind(this));
};

Token.prototype.schedule = function(){
  var ms = (new Date(this.session.expires_at) - Date.now()) - this.expirationRedLine;
  debug('token redline in ' + ms + 'ms', (ms/1000/60) + 'minutes');
  setTimeout(this.refresh.bind(this), ms);
};
