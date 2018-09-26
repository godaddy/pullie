const pullie = require('../../lib');
const path = require('path');
const assume = require('assume');
const request = require('request');
const URL = require('url');

const helpers = {
  startPullie: function startPullie(onStarted) {
    pullie.start({
      configPath: path.join(__dirname, '../fixtures/config.json')
    }, (err, app) => {
      assume(err).is.falsey();
      assume(app).is.truthy();

      const server = app.servers.http;
      const addr = server.address();
      assume(addr).is.truthy();

      const baseUrl = URL.format({
        hostname: '127.0.0.1',
        port: addr.port,
        protocol: 'http'
      });

      onStarted(baseUrl, app);
    });
  },
  sendWebhookEvent: function sendWebhookEvent(baseUrl, eventBody, signature, verify) {
    const pullieUrl = baseUrl + '/api/v1/github';
    request.post(pullieUrl, {
      json: true,
      headers: {
        'X-GitHub-Delivery': 'mock',
        'X-GitHub-Event': 'pull_request',
        'X-Hub-Signature': signature
      },
      body: eventBody
    }, verify);
  },
  assumeValidResponse: function assumeValidResponse(url, expectedBody, done) {
    request(url, (err, res, body) => {
      assume(err).is.falsey();
      assume(res).hasOwn('statusCode', 200);
      assume(body).contains(expectedBody);

      done();
    });
  }
};

module.exports = helpers;
