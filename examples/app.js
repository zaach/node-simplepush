var http = require('http');
var async = require('async');
var qs = require('querystring');
var request = require('request');
var SimplePush = require('../simplepush.js');
var SimplePushClient = require('../client.js');

var userAppServerUrl = 'http://localhost:8181/user/42';

var options = {
  endpoint: 'http://localhost:8180',
  port: 8180,
  db: {
    redis: true
  }
};

// Start the SimplePush server
SimplePush(options, function(err, server) {
  console.log((new Date()) + ' SimplePush Server is listening on port 8180');

  // Create a new UserAgent client
  var client = new SimplePushClient({ pushServer: 'ws://localhost:8180' });

  client.init(function() {
    // register for a new channel
    client.register(function(err, reply) {
      if (err) {
        console.log('error', reply);
        return;
      }

      console.log('success', reply);

      // send endpoint to appserver
      request.post(userAppServerUrl + '/endpoint', { form: { endpoint: reply.pushEndpoint } }, function(err, res) {

        // Update user data on AppServer to trigger a push notification
        request.post(userAppServerUrl + '/update', { form: { foo: 'bar' } }, function(err, res) {


        });
      });

    });
  });

  // handle push notifications
  client.on('push', function(reply) {
    console.log('received push notification!', reply);

    var channel = reply.updates[0];
    console.log('channel received update', channel);

    // Unregister the channel
    client.unregister(channel.channelID, function(res) {
      console.log('unregistered', res);
    });
  });

});


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
            console.log('appserver notified pushserver!!', err, res.statusCode);
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
