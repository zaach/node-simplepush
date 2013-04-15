// A rough, minimal node.js client
//
// Original native client:
// http://mxr.mozilla.org/mozilla-central/source/dom/push/src/PushService.js

var WebSocketClient = require('websocket').client;
var uuid = require('uuid');
var request = require('request');
var events = require('events');

function SimplePushClient (options) {
  this._wsHost = options.pushServer || 'ws://localhost:8180/';
  this.uaid = options.uaid || uuid.v4();
  this._pushEmitter = new events.EventEmitter();
}

var proto = SimplePushClient.prototype;

// Starts the websocket connection and begins the handshake with the
// SimplePush server
proto.init = function(cb) {
  var self = this;

  this._reqs = {};

  var client = new WebSocketClient();

  client.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
  });

  client.on('connect', function(connection) {
    console.log('WebSocket client connected');

    self._connection = connection;

    connection.on('error', function(error) {
      console.log('Connection Error: ' + error.toString());
    });

    connection.on('close', function() {
      console.log('push-notification Connection Closed');
    });

    connection.on('message', self._handleMessage.bind(self));

    // Begin the handshake
    self.hello(cb);
  });

  client.connect(this._wsHost, 'push-notification');
};

proto._handleMessage = function (message) {
  var reply;

  if (message.type === 'utf8') {
    console.log("Received: '" + message.utf8Data + "'");
    try {
      reply = JSON.parse(message.utf8Data);
    } catch (e) {
      console.error('Error parsing response: ', e);
      return;
    }
    var handler = '_handle' + reply.messageType[0].toUpperCase() + reply.messageType.slice(1);
    console.log('handle', handler);
    if (this[handler]) this[handler](reply);
  }
};

proto._send = function(action, data) {
  data.messageType = action;
  this._connection.sendUTF(JSON.stringify(data));
};

proto.ack = function(channelID, version) {
  this._send('ack', { updates: [{ channelID: channelID, version: version }] });
};

proto.hello = function(cb) {
  console.log('Initiating handshake');
  var data = { messageType: 'hello', uaid: this.uaid || "" };

  data.channelIDs = []; // todo: retrieve previous cids

  this._reqs['hello' + this.uaid] = cb;
  this._connection.sendUTF(JSON.stringify(data));
};

proto._handleHello = function(reply) {
  if (!reply.uaid) {
    console.error('no uaid supplied in reply:', reply);
    return;
  } else if (reply.uaid !== this.uaid) {
    // todo: reregister everything
    this.uaid = reply.uaid;
  }
  this.ready = true;
  this._reqs['hello' + this.uaid]();
};

proto.register = function(cb) {
  var channelID = uuid.v4();
  this._reqs['reg' + channelID] = cb;
  this._send('register', { channelID: channelID });
};

proto._handleRegister = function(reply) {
  try {
    if (reply.status === 200) {
      this._reqs['reg' + reply.channelID](null, reply);
    } else {
      this._reqs['reg' + reply.channelID](reply.status);
    }
  } catch (e) {
    console.error('Error registering: ', e);
  }

  delete this._reqs['reg' + reply.channelID];
};

proto.unregister = function(channelID, cb) {
  delete this._reqs['reg' + channelID];
  this._reqs['unreg' + channelID] = cb;
  this._send('unregister', { channelID: channelID });
};

proto._handleUnregister = function(reply) {
  try {
    if (reply.status === 200) {
      this._reqs['unreg' + reply.channelID](null, reply);
    } else {
      this._reqs['unreg' + reply.channelID](reply.status);
    }
  } catch (e) {
    console.error('Error unregistering: ', e);
  }

  delete this._reqs['reg' + reply.channelID];
};

proto._handleNotification = function(reply) {
  this._pushEmitter.emit('push', reply);
  this._send('ack', { updates: reply.updates });
};

proto.on = function(type, cb) {
  if (type === 'push') {
    this._pushEmitter.on(type, cb);
  }
};


module.exports = SimplePushClient;

