var request = require('request');
var SimplePushClient = require('../client.js');

var userAppServerUrl = 'http://localhost:8080/testtoken';

// Create a new UserAgent client
var client = new SimplePushClient({ pushServer: 'ws://localhost:8180' });

console.log('initiating client');

client.init(function() {
  console.log('connected!');

  // register for a new channel
  client.register(function(err, reply, channel) {
    if (err) {
      console.log('error', reply);
      return;
    }

    console.log('registration success', reply);

    // handle push notification to channel
    channel.on('push', function(update) {
      console.log('received push notification!', update);

      // Unregister the channel
      //client.unregister(update.channelID, function() {
        //console.log('unregistered', update.channelID);
      //});
    });

    // send endpoint to appserver
    request.post(userAppServerUrl + '/endpoint', {
      'content-type': 'application/json',
      headers: { Authorization: 'testtoken' },
      body: JSON.stringify({ endpoint: reply.pushEndpoint })
    }, function(err, res) {
      console.log(res);
      // Update user data on AppServer to trigger a push notification
      request.post(userAppServerUrl + '/storage/col1', {
        'content-type': 'application/json',
        headers: { Authorization: 'testtoken' },
        body: JSON.stringify([{ id: 'one', payload: 'TESTONE' }])
      }, function(err, res) {
        console.log('user data updated');
        console.log(res);

        // delete endpoint from appserver
        request.del(userAppServerUrl + '/endpoint', {
          'content-type': 'application/json',
          headers: { Authorization: 'testtoken' },
          body: JSON.stringify({ endpoint: reply.pushEndpoint })
        }, function(err, res) {
          console.log(res);
          console.log('endpoint deleted', reply.pushEndpoint);
        });

      });
    });

  });
});

