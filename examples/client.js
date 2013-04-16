var request = require('request');
var SimplePushClient = require('../client.js');

var userAppServerUrl = 'http://localhost:8181/user/42';

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
    request.post(userAppServerUrl + '/endpoint', { form: { endpoint: reply.pushEndpoint } }, function(err, res) {

      // Update user data on AppServer to trigger a push notification
      request.post(userAppServerUrl + '/update', { form: { foo: 'bar' } }, function(err, res) {
        console.log('user data updated');
      });
    });

  });
});

