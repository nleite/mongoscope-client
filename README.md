# mongoscope-client

## Examples

- [Running an aggregation](http://codepen.io/imlucas/pen/BHvLE)

```javascript
require('mongoscope-client')();
scope.find('local', 'startup_log', {query: {}, limit: 10, skip: 0}, function(err, res){
  if(err) return console.error('Uhoh...', err);
  console.log('find returned ->', res);
})
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

### Changing deployment context

```javascript
var dev = scope.connect('mongodb://localhost:27017');
dev.deployment(function(err, deployment){
  console.log('dev contains ' + deployment.instances.length + ' instances');
});
```

### Changing deployment and instance contexts

```javascript
var stage = scope.connect('mongodb://staging.scope.mongodb.land:30999');
stage.deployment(function(err, deployment){
  console.log('staging contains ' + deployment.instances.length + ' instances');

  // Get log of shard 2 primary
  stage.connect(deployment.shard('scope-rs1').primary()).log(function(err, events){
    console.log('current log of shard 2 primary');
    events.map(function(event){
      // skip connection log events
      if(/^conn/.test(event.name)) return;

      console.log(event.message);
    });
  });

  // Run top on all shard 1 secondaries
  stage.connect(deployment.shard('scope-rs0').secondaries()).top(function(err, data){
    console.log('sampled top from ' + data.instance.name);
    console.log('all namespaces', data.namespaces);
    console.log('500 ms deltas', data.deltas);
  });

  // Watch shard 1
  var watcher = stage.connect(deployment.shard('scope-rs0')).watch(function(err, event){
    if(event.name === 'join'){
      console.log('please welcome ' + event.instance.name + ' to shard 1!');
    }
    else if(event.name === 'left'){
      console.log('oh nos!  ' + event.instance.name + ' has gone away!');
    }
    else if(event.name === 'reconnect'){
      console.log('whew!  we\'ve re-established conntact with ' + event.instance.name);
    }
  });
});
```

### Aliasing

Because you are better at guessing a good display names for things that you'll
actually remember than any of my stupid algorithms.


```javascript
// server assumes you want the best fit deployment running on the same host as scope
scope.connect().alias('laptop').deployment(function(err, laptop){
  console.log('deployment: ' + laptop.name + ' (' + laptop.type + ')');
  laptop.instances.map(function(instance){
    console.log();
  });
});
```

```javascript
// client is context aware for you
scope.connect('scope.mongodb.land')
  .alias('mongoscope demo')
  .router()
    .alias('router 1').deployment(function(err, stage){
      console.log('deployment: ' + stage.name + ' (' + stage.type + ')');
      console.log('router: ' + stage.router().name);
    });
```

### Put it all together now

Get a detailed report on the current sharding status
of a deployment.  [view result](https://gist.github.com/imlucas/11374071)

```javascript
var scope = require('scope')('http://localhost:29017');

scope.connect('mongodb://localhost:30999', function(err, deployment){

  deployment.router().sharding(function(err, res){
    if(err) return console.error('error', err);
    console.log('# ' + deployment.name + ' sharding report');

    console.log('## collections\n');
    res.collections.map(function(col){
      console.log('### `' + col._id + '`\n');
      console.log('- shard on `' + JSON.stringify(col.shard_key) + '`');
      console.log('- tags `' + (col.tags.length ? col.tags.join(', ') : 'none') + '`');
      console.log('- storage ' + col.stats.storage_size +
          ', documents ' + col.stats.document_size +
          ', indexes ' + col.stats.index_size);
      console.log('- documents ' + col.stats.document_count);
      console.log('- indexes ' + col.stats.index_count);

      // @todo: there should be some tolerance to showing warnings if
      // distribution is off target.
      var target = (1/col.shards.length) * 100;

      console.log('- target distribution per shard ' + target + '%');
      console.log();

      col.shards.map(function(s){
        console.log('#### `' + s._id + '`\n');
        s.warnings = [];

        if(s.stats.document_count === 0){
          return console.log('- **warning** empty shard\n');
        }

        s.stats.document_share = (s.stats.document_count/col.stats.document_count * 100).toFixed(2);
        s.stats.document_storage_share = (s.stats.document_size/col.stats.document_size * 100).toFixed(2);
        s.stats.storage_share = (s.stats.storage_size/col.stats.storage_size * 100).toFixed(2);

        if(s.stats.document_share > target){
          s.warnings.push('EHIGHDOCS');
        }
        else if(s.stats.document_share < target){
          s.warnings.push('ELOWDOCS');
        }

        if(s.stats.document_storage_share > target){
          s.warnings.push('EHIGHDOCSTOR');
        }
        else if(s.stats.document_storage_share < target){
          s.warnings.push('ELOWDOCSTOR');
        }

        if(s.stats.storage_share > target){
          s.warnings.push('EHIGHSTOR');
        }
        else if(s.stats.storage_share < target){
          s.warnings.push('ELOWSTOR');
        }

        if(s.warnings){
          console.log('- **warning** ' + s.warnings.join(', '));
        }

        console.log('- documents (' + s.stats.document_share + '%) ' + 'storage (' + s.stats.document_storage_share + '%)');

        console.log();
        s.chunks.map(function(chunk){
          console.log('##### `' + chunk._id + '`\n');
          console.log('- last modified: ' + chunk.last_modified_on);
          console.log('- ' + JSON.stringify(chunk.keyspace[0]) + ' → ' + JSON.stringify(chunk.keyspace[1]));
          console.log();
        });
      });

    });

    console.log('## topology');
    var l = null;
    res.instances.map(function(i){
      if(i.shard !== l){
        l = i.shard;
        if(l){
          console.log('\n### `' + l + '`\n');
        }
        else {
          console.log('\n### routers\n');
        }
      }
      console.log('  - [' + i.name + '](http://scope.mongodb.land/#connect/'+i.url+')');
    });

    console.log();
    console.log('## other databases\n');
    res.databases.map(function(db){
      if(db.partitioned) return;
      console.log('- ' + db._id + '(' + db.primary + ')');
    });

  });
});
```
