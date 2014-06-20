#!/usr/bin/env node

var dox = require('dox'),
  fs = require('fs');

// {Boolean} explain Return explain instead of documents default `false`
var option = /\{(\w+)\} (\w+) ([\w\s]+) ?(?:default)? `(\w+)`?\.?/;

var methods = dox.parseComments(fs.readFileSync(__dirname + '/../lib/client.js', 'utf-8'), {raw: true});


var apis = [];
methods.map(function(method){
  if(method.ignore || method.isPrivate) return;

  if(!method.ctx) return console.log('huh?', method);

  var stability,
    params = [],
    streamable = false;

  method.tags.map(function(tag){
    if(tag.type === 'param') return params.push(tag);
    if(tag.type === 'stability') return stability = tag.string;
    if(tag.type === 'streamable') return streamable = true;
  });

  if(!stability) return false;

  apis.push({
    name: method.ctx.name,
    stability: stability,
    streamable: streamable,
    description: method.description.full
  });
});

console.log(apis);
