var uuid = require('uuid');
var WebSocketServer = require('websocket').server;
var http = require('http');
var https = require('https');
var async = require('async');
var qs = require('querystring');
var events = require('events');


// Creates a SimplePush server
function SimplePush(options, cb) {

  var settings = JSON.parse(JSON.stringify(options));

  if (!settings.notifyPrefix) settings.notifyPrefix = '/notify/';
  if (!settings.host) settings.host = 'localhost';
  if (!settings.tls) settings.tls = false;

  var store = require('./store')(settings.db);
  var emitter = new events.EventEmitter();
  var protocol = settings.tls ? https : http;
  var server = protocol.createServer(requestCallback);

  var wsServer = new WebSocketServer({
      httpServer: server,
      autoAcceptConnections: false
  });

  // We wait until the database has connected to initialize the server
  store.connect(function(err, db) {
    server.listen(settings.port, settings.host, function(err) {
      cb(err, server);
    });
  });

  function channelIDToEndpoint(channelID) {
    return (settings.tls ? 'https' : 'http') + '://' + settings.host + ':' + settings.port + settings.notifyPrefix + channelID;
  }

  function endpointToChannelID(endpoint) {
    return endpoint.split(settings.notifyPrefix)[1];
  }

  // Callback for http server requests
  // Receives version updates from the AppServer for specified channeldIDs
  // After receiving a version update, it will notify the UserAgent
  // until it receives an acknowledgement

  function requestCallback(request, response) {
    console.log((new Date()) + ' Received request for ' + request);

    // Updates must be PUT requests
    if (request.method === 'PUT') {
        var body = '';
        request.on('data', function(data) {
          body += data;
        });

        request.on('end', function() {
          var data = qs.parse(body);
          var channelID, channel;

          var endpoint = request.url;
          async.waterfall([
            function(cb) {
              var chID = endpointToChannelID(endpoint);
              if (!chID) return cb('MissingChannelID');
              channelID = chID;

              store.get('channel/' + channelID, cb);
            },
            function(ch, cb) {
              if (!ch) return cb('UnknownChannel');
              channel = ch;
              // store the pending version
              channel.pendingVersion = data.version;
              store.set('channel/' + channelID, channel, cb);
            }
          ], function(err, result) {
            // respond to the appserver
            var status = 200;

            if (err == 'MissingChannelID' ||
                err == 'UnknownChannel') status = 400;
            else if (err) status = 500;

            response.writeHead(status);
            response.end();
            if (status === 200) {
              // send push notification to the UA
              // TODO set a timeout to check again after 60 seconds
              emitter.emit(channel.uaid, 'notification', { channelID: channelID, version: data.version });
            }
          });
      });
    } else {
      response.writeHead(400);
      response.end();
    }
  }

  // Revieves new client connections and registers push server event handlers
  wsServer.on('request', function(request) {
    var connection = request.accept('push-notification', request.origin);
    console.log((new Date()) + ' Connection accepted.');

    var uaid;
    connection.on('message', function(message) {
      if (message.type === 'utf8') {
        console.log('Received Message: ' + message.utf8Data);

        var data = JSON.parse(message.utf8Data);

        // Perform handshake and register new client
        if (data.messageType === 'hello') {
          uaid = data.uaid || uuid.v4();

          if (data.channelIDs) {
            store.set('uaid/' + uaid, {
              channelIDs: data.channelIDs
            }, function(err) {
              var response = {
                messageType: 'hello',
                uaid: uaid
              };
              connection.sendUTF(JSON.stringify(response));
            });
          }

          // dispatch messages sent to this ua
          var uaHandler = handler.bind(null, uaid, connection);
          emitter.on(uaid, uaHandler);
          connection.on('close', function() {
            emitter.removeListener(uaHandler);
          });

        } else if (uaid && data.messageType === 'register') {
          emitter.emit(uaid, 'register', data);

        } else if (uaid && data.messageType === 'unregister') {
          emitter.emit(uaid, 'unregister', data);

        } else if (uaid && data.messageType === 'ack') {
          emitter.emit(uaid, 'ack', data);
        }
      }
    });

    connection.on('close', function(reasonCode, description) {
      console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });

  });


  // Handle events for a UserAgent
  // Events include register, unregister, notification, and ack
  function handler(uaid, connection, type, data) {
    console.log('received event:', uaid, type, data);

    if (type === 'register') {

      // register the channel and send a response to the UA
      register(uaid, data, function(err, endpoint) {
          var status = 200;
          if (err) {
            status = err === 'UAMismatch' ? 409 : 500;
            console.error(err);
          }

          // send endpoint back to UA
          var response = {
            messageType: 'register',
            status: status,
            channelID: data.channelID,
            pushEndpoint: endpoint
          };
          connection.sendUTF(JSON.stringify(response));
        }
      );

    } else if (type === 'unregister') {

      // unregister the channel and send a response to the UA
      unregister(uaid, data, function(err, result) {
        var status = 200;

        // Don't send 500 errors for UA mismatches or unknown channel IDs
        if (err && err !== 'UAMismatch' && err !== 'UnknownChannelID') {
          status = 500;
          console.error(err);
        }

        // send confirmation back to UA
        var response = {
          messageType: 'unregister',
          status: status,
          channelID: data.channelID
        };
        connection.sendUTF(JSON.stringify(response));
      });

    } else if (type === 'notification') {

      // AppServer has just pinged the endpoint
      // send notifications to the UA of the channels that have been updated
      var response = {
        messageType: 'notification',
        updates: [data]
      };
      connection.sendUTF(JSON.stringify(response));

    } else if (type === 'ack') {

      // Acknowledgement from the UA that it received the notification
      // We update the channel's version with the pending version
      data.updates.forEach(function(update) {

        store.get('channel/' + update.channelID, function (err, channel) {

          // update the channel version with the acknowledged version
          // but only if it was currently pending
          if (channel.pendingVersion === update.version && update.version !== channel.version) {
            channel.version = update.version;
            store.set('channel/' + update.channelID, channel, function(err) {
              console.log('done updating pending for', update.channelID);
            });
          }
        });
      });

    }
  }

  // Utility function for registering a new channel
  function register(uaid, data, cb) {

    async.waterfall([
      function(cb) {
        // get UA info
        store.get('uaid/' + uaid, cb);
      },
      function(ua, cb) {
        // update list of channels
        ua.channelIDs.push(data.channelID);
        store.set('uaid/' + uaid, ua, cb);
      },
      function(cb) {
        // link channel with UAID and endpoint
        var endpoint = channelIDToEndpoint(data.channelID);
        store.set('channel/' + data.channelID,
          { uaid: uaid, endpoint: endpoint },
          function(err) { cb(err, endpoint); }
        );
      }
    ], cb);

  }

  // Utility function for unregistering a channel
  function unregister(uaid, data, cb) {

    async.waterfall([
      function(cb) {
        store.get('channel/' + data.channelID, cb);
      },
      function(channel, cb) {
        // the channel ID is unknown
        if (!channel) return cb('UnknownChannelID');

        // the UA doesn't match our current UA
        if (channel.uaid !== uaid) return cb('UAMismatch');

        store.delete('channel/' + data.channelID, cb);
      },
      function(cb) {
        // get UA info so we can remove this channel from its list
        store.get('uaid/' + uaid, cb);
      },
      function(ua, cb) {
        // remove the channel ID from the UA's list of channels
        ua.channelIDs.splice(ua.channelIDs.indexOf(data.channelID), 1);
        store.set('uaid/' + uaid, ua, cb);
      }
    ], cb);

  }

}

module.exports = SimplePush;

