const path = require('path');
const App = require('./app');

/**
 * Create a new application and start it.
 * @param {Object} options Options to start with.
 * @param {function} callback Continuation to respond to once complete.
 */
exports.start = function (options, callback) {
  const app = new App(path.join(__dirname, '..'), options);
  app.start(options, function (err) {
    if (err) {
      return callback(err);
    }

    callback(null, app);
  });
};

