var redis = require('redis');

function kvstore(options) {
  options = options || {};
  var store = {};
  var db;

  if (options.redis) {
    var client = redis.createClient(options.port, options.host, options);
    db = {
      connect: function(cb) {
        client.on('connect', function(err) {
          cb(err, db);
        });
      },
      set: function(id, val, cb) {
        client.set(id, JSON.stringify(val), function(err) { cb(err); });
      },
      get: function(id, cb) {
        client.get(id, function(err, val) {
          var res;
          try {
            res = JSON.parse(val);
          } catch (e) { return cb(e); }
          cb(err, res);
        });
      },
      delete: function(id, cb) {
        client.del(id, function(err) { cb(err); });
      }
    };
  } else {
    db = {
      connect: function(cb) {
        var db = this;
        process.nextTick(function() {
          cb(null, db);
        });
      },
      set: function(id, val, cb) {
        store[id] = val;
        process.nextTick(function() {
          cb(null);
        });
      },
      get: function(id, cb) {
        process.nextTick(function() {
          cb(null, store[id]);
        });
      },
      delete: function(id, cb) {
        process.nextTick(function() {
          delete store[id];
          cb(null);
        });
      }
    };
  }

  return db;
}

module.exports = kvstore;
