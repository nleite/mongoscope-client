var types = {ns: require('mongodb-ns')};

module.exports.ns = function(val){
  var _ns = types.ns(val);
  return _ns.validDatabaseName && _ns.validCollectionName;
};
