var SimplePush = require('./simplepush.js');

var options = {
  port: 8180
};

SimplePush(options, function(err, server) {
    console.log((new Date()) + ' Server is listening on port 8180');
});

