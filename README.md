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

// How do I get all documents in a collection in backbone.js?
var Tickets = Backbone.Collection.extend(Backbone.extend({
  url: '/jiraXgen/tickets'
}, scope.backbone.List));

// Add the `all` option when fetching to exhaust a cursor before
// adding models to a collection.
var tickets = new Tickets();
tickets.on('sync', function(){
  var data = tickets.toJSON();
  console.log('Tickets', tickets);
});
tickets.fetch({all: true});

// You can also pass the usual mongo find options as well
tickets.fetch({query: {}, limit: 10, skip: 0});
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
