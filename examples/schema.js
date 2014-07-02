var client,
  infer = window.mongodb.infer,
  _ = window._,
  $ = window.jQuery;

client = window.mongoscope({scope: 'http://scope.mongodb.land'}).on('readable', example);

function example(){
  client.sample('canada.service_requests', {size: 20}, function(err, res){
    $('.raw').text(JSON.stringify(res, null, 2));

    var schemas = res.map(function(doc){
      return infer(doc);
    });
    $('.schema-raw').text(JSON.stringify(schemas, null, 2));
  });
}
