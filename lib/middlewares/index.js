const bodyParser = require('body-parser');
const verifyGithubWebhook = require('verify-github-webhook').default;
const express = require('express');
const path = require('path');

function Middlewares(app, opts, callback) {
  app.log.info('Adding middlewares');

  const githubConfig = app.config.get('github');
  app.use(bodyParser.json({
    verify: (req, res, buf, encoding) => {
      const signature = req.headers['x-hub-signature'];
      if (signature && githubConfig.secret) {
        // Verify incoming payload is properly signed with secret
        if (signature.length !== 45 || // sha1=<40 chars of SHA hash> = 45 characters
          !verifyGithubWebhook(signature, buf.toString(encoding), githubConfig.secret)) {
          throw new Error('GitHub payload failed signature validation');
        }
      }
    }
  }));

  app.use('/static', express.static(path.resolve(__dirname, '../../dist')));

  app.after('actions', function (done) {
    app.log.info('Adding post-routing middlewares');

    app.use(require('slay-error')(app));

    done();
  });

  callback();
}

module.exports = Middlewares;
