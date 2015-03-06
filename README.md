node-simplepush
====
A node implementation of the [SimplePush protocol](https://wiki.mozilla.org/WebAPI/SimplePush/Protocol).

Install
====

You'll need node.js and npm installed first.

To install from github:

    git clone http://github.com/zaach/node-simplepush
    cd ./node-simplepush
    npm install

If you want persistant storage, you'll need redis installed on your system also.

Run
====
To start the SimplePush server, run:

    node ./bin/simplepush

To run the examples, start the AppServer:

    node examples/appserver.js

Then run the client:

    node examples/client.js

Client API
====

### var client = new SimplePUshClient(options)

Options may include:

* `pushServer`: the WebSocket URL of the SimplePush server the client should connect to
* `uaid`: a unique UserAgent ID. Defaults to a random uuid (version 4).

### client.init(cb)
Arguments:

* `cb`: fired once the client connects and completes the handshake

### client.register(cb)
Arguments:

* `cb`: callback called with three arguments:
  * An error if any, or null
  * A response object with `channelID` and `pushEndpoint` keys
  * A channel object that can receive push notifications. Attach a `push` event handler to the channel object to receive the notifications. E.g.


```
client.register(function(err, reply, channel) {
  console.log('Channel ID', reply.channelID);
  console.log('Endpoint: ', reply.pushEndpoint);

  channel.on('push', function(err, update) {
    console.log('Reveived update:', update.version);
  });
});
```


### client.unregister(channelID, cb)
Arguments:

* `channelID`: The channel to unregister
* `cb`: callback when unregistration completes

