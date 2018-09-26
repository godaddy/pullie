const util = require('util');
const slay = require('slay');

function App(root, options) {
  slay.App.call(this, root, options);
  this.env = process.env.NODE_ENV || 'development'; // eslint-disable-line no-process-env
}

util.inherits(App, slay.App);

module.exports = App;
