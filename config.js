var convict = require('convict');

var config = convict({
  env: {
    doc: "The current node.js environment",
    default: "production",
    format: [ "production", "local", "test" ],
    arg: 'env',
    env: 'NODE_ENV'
  },
  public_url: {
    format: "url",
    // the real url is set by awsbox
    default: "http://127.0.0.1:8180",
    env: 'PUBLIC_URL'
  },
  server: {
    tls: {
      default: false
    },
    host: {
      doc: "The ip address the server should bind",
      default: '127.0.0.1',
      format: 'ipaddress',
      arg: 'host',
      env: 'IP_ADDRESS'
    },
    port: {
      doc: "The port the server should bind",
      default: 8180,
      format: 'port',
      arg: 'port',
      env: 'PORT'
    }
  },
  db: {
    redis: false,
    host: {
      doc: "The host of the database server",
      default: '127.0.0.1',
      format: 'ipaddress',
      arg: 'db-host',
      env: 'DB_HOST'
    },
    port: {
      doc: "The port of the database server",
      default: 6379,
      format: 'port',
      arg: 'db-port',
      env: 'DB_PORT'
    }
  }
});


// handle configuration files.  you can specify a CSV list of configuration
// files to process, which will be overlayed in order, in the CONFIG_FILES
// environment variable
if (process.env.CONFIG_FILES) {
  var files = process.env.CONFIG_FILES.split(',');
  config.loadFile(files);
}

config.validate();

console.log('configuration: ', config.toString());

module.exports = config;
