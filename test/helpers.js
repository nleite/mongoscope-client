var scope = require('../');

var endpoint = 'http://scope.mongodb.land';

if(window.location.origin === 'http://localhost:8080'){
  endpoint = 'http://localhost:29017';
  require('debug').enable('mongoscope*');
}

module.exports = {
  client: null,
  createClient: function(){
    module.exports.client = scope({scope: endpoint});
    return module.exports.client;
  },
  before: function(done){
    module.exports.createClient()
      .on('error', done)
      .on('readable', done);
  },
  after: function(done){
    if(!module.exports.client) return done();

    module.exports.client.close(function(err){
      if(err) return done(err);
      module.exports.client = null;
      done();
    });
  }
};
