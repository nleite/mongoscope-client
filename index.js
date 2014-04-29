var Client = require('./lib/client');

module.exports = function(config){
  config = config || {};

  return new Client({
    scope: config.scope || 'http://localhost:29017',
    seed: config.seed || 'mongodb://localhost:27017'
  });
};
