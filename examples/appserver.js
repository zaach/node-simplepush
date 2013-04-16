var http = require('http');
var qs = require('querystring');
var request = require('request');

// Sample Application Server
// It stores push server endpoints and version numbers for each user
// When an update occurrs, it will increment the version number
// and send a notification to each endpoint

// memory store for user data
var users = {};
var appServer = http.createServer(function(req, res) {
  console.log((new Date()) + ' Received request for ' + req);

  var url = req.url.split('/');
  var uid = url[2];
  var resource = url[3];

  if (req.method === 'POST') {
    var body = '';
    req.on('data', function(data) {
      body += data;
    });

    req.on('end', function() {
      var data = qs.parse(body);

      if (resource === 'endpoint') {
        // associate a new endpoint with a user

        console.log('adding new endpoint', data.endpoint);
        if (! users[uid]) users[uid] = {};
        if (! users[uid].endpoints) {
          users[uid].endpoints = [data.endpoint];
        } else if (users[uid].endpoints.indexOf(data.endpoint) === -1) {
          users[uid].endpoints.push(data.endpoint);
        }

        console.log('users', users);

        res.writeHead(200);
        res.end();
      } else if (resource === 'update') {
        // perform an update for the user

        if (! users[uid]) users[uid] = {};
        // update user's data
        users[uid].data = data;

        // set the version number
        var version = users[uid].version = users[uid].version ? users[uid].version + 1 : 1;

        console.log('users', users);

        // notify all endpoints of the new version
        users[uid].endpoints.forEach(function(ep) {
          console.log('sending notification update to push server', version, ep);
          request.put(ep, { form: { version: version } }, function(err, res) {
            console.log('appserver notified pushserver', err, res.statusCode);
          });
        });

        res.writeHead(200);
        res.end();
      }
    });
  }
});

appServer.listen(8181, function() {
  console.log('appserver listening');
});
