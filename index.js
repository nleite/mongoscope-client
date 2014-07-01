var Client = require('./lib/client'),
  pkg = require('./package.json');

module.exports = function(config){
  config = config || {};
  if(typeof config !== 'object'){
    config = {scope: config};
  }
  config.scope = config.scope || 'http://localhost:29017';
  config.seed = config.seed || 'mongodb://localhost:27017';
  return new Client(config);
};

module.exports.version = pkg.version;
