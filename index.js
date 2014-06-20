var Client = require('./lib/client'),
  pkg = require('./package.json');

module.exports = function(config){
  config = config || {};
  if(typeof config !== 'object'){
    config = {scope: config};
  }
  config.scope = config.scope || 'http://localhost:29017';
  config.seed = config.seed || 'mongodb://localhost:27017';

  // Force port 80 for publicly exposed if not stated explictly.
  if(config.scope.indexOf('localhost') === -1 && !(/\:(\d+)/.test(config.scope))){
    config.scope = config.scope + ':80';
  }

  return new Client(config);
};

module.exports.version = pkg.version;
