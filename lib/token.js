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
  this.readable = false;

  debug('creating token', this.config);


  process.nextTick(function(){
    this.bake(function(err, res){
      if(err) return this.emit('error', err);

      this.session = res;
      this.schedule();

      this.readable = true;
      this.emit('readable');
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

Token.prototype.close = function(){
  clearTimeout(this.refreshTimeout);
  request.del(this.config.scope + '/api/v1/token')
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + this.session.token)
    .end(function(err, res){
      debug('close token', err, res);
    });
};

Token.prototype.bake = function(done){
  debug('getting token for', this.config.seed);
  request.post(this.config.scope + '/api/v1/token')
    .send({seed: this.config.seed})
    .set('Accept', 'application/json')
    .end(function(err, res){
      if(err) return done(err);

      if(!err && res.status >= 400){
        err = new Error(res.body ? res.body.message : res.text);
        err.code = res.status;
        Error.captureStackTrace(err, Token.prototype.bake);
        return done(err);
      }

      debug('got token response', res.body);

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
  this.refreshTimeout = setTimeout(this.refresh.bind(this), ms);
};
