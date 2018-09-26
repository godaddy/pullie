const PluginManager = require('../plugins');

function PluginManagerPreboot(app, opts, callback) {
  app.plugins = new PluginManager(app);
  callback();
}

module.exports = PluginManagerPreboot;
