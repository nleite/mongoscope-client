var mackbone, client,
  Model, Collection,
  ModelStream, CollectionStream,
  Backbone = window.Backbone,
  _ = window._,
  $ = window.jQuery;

client = window.mongoscope({
  scope: 'http://scope.mongodb.land'
  // scope: 'http://localhost:29017'
})
  .on('readable', function(){
    mackbone = client.backbone;

    Collection = Backbone.Collection.extend(mackbone.Collection);
    Model = Backbone.Model.extend(mackbone.Model);

    CollectionStream = Collection.extend(mackbone.ReadableStream);
    ModelStream = Model.extend(mackbone.ReadableStream);
    example();
  });

function example(){
  // Extending from mongoscope's backbone adapter sure is nice and sweet...
  var Instance = Model.extend({url: '/instance'});


  var LogStream = CollectionStream.extend({
    url: '/log',
    model: Model.extend({
      idAttribute: function(){
        return this.get('timestamp') + this.get('message');
      },
      defaults: {
        threadname: 'default',
        message: 'Some MongoDB log message',
        timestamp: new Date()
      }
    })
  });

var InstanceLogView = Backbone.View.extend({
  initialize: function(){
    this.instance = new Instance();
    this.instance.on('sync', this.insert, this);

    this.logs = new LogStream();
    this.logs.on('sync', this.update, this);

    this.$logLines = null;
  },
  tpl: _.template($('#instance-tpl').html()),
  enter: function(){
    // We navigated to this view, so get data from the backend.
    this.instance.fetch();
    return this;
  },
  insert: function(){
    // Set the initial DOM.
    this.$el.html(this.tpl({
      instance: this.instance.toJSON(),
      logs: this.logs.toJSON()
    }));

    this.$logLines = this.$el.find('.log-lines');
    this.logs.subscribe();
    return this;
  },
  update: function(collection, freshLogs){
    // Update dom with your fresh log lines.
    this.$el.find('.log-lines').prepend(freshLogs.map(function(line){
      return line.message;
    }).join('<br />'));
  },
  exit: function(){
    // Navigating away so be nice and close the log stream.
    this.logs.unsunscribe();
    return this;
  }
});
 new InstanceLogView({el: '.instance-logs'}).enter();

}
