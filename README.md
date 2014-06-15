# mongoscope-client

[![build status](https://secure.travis-ci.org/imlucas/mongoscope-client.png)](http://travis-ci.org/imlucas/mongoscope-client)

## [Examples](http://codepen.io/collection/Gdeok/)

- [Running an aggregation](http://codepen.io/imlucas/pen/BHvLE)
- [Backbone.js](http://codepen.io/collection/Gdeok/)
- [Sharding Report](http://codepen.io/imlucas/pen/JgzAh)

```javascript
var scope = require('mongoscope-client')();
scope.find('local', 'startup_log', {query: {}, limit: 10, skip: 0}, function(err, res){
  if(err) return console.error('Uhoh...', err);
  console.log('find returned ->', res);
})

// How do I get all documents in a collection?
var _ids = [];
scope.find('local', 'startup_log')
  .on('error', function(err){
    console.error(err);
  })
  .on('data', function(doc){
    _ids.push(doc._id);
  })
  .on('end', function(){
    console.log('Found ' + _ids.length + ' log entries.');
  });
```

```javascript
var scope = require('mongoscope-client')();
scope.deployments(function(err, deployments){
  console.log('scope is aware of ' + deployments.length + ' deployments:');

  deployments.map(function(deployment){
    console.log('## ' + deployment.name + ' (' + deployment.id + ')\n');
    deployment.instances.map(function(instance){
      console.log('- ' + instance.name + (instance.type ? ' (' + instance.type + ')' : '');
    });
    console.log();
  });
});
```
