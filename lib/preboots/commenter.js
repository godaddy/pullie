const Commenter = require('../commenter');

function CommenterPreboot(app, opts, callback) {
  app.commenter = new Commenter();
  callback();
}

module.exports = CommenterPreboot;
