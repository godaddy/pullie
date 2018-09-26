const assume = require('assume');
const nock = require('nock');
const { startPullie, sendWebhookEvent, assumeValidResponse } = require('./helpers');
const openPRPayload = require('../fixtures/payloads/open-pr');
const mockPullieRC = require('../fixtures/payloads/mock-pullierc');
const mockPackageJson = require('../fixtures/payloads/mock-packagejson');

function nockFile(scope, path, contents) {
  scope.get('/api/v3/repos/org/repo/contents/' + path)
    .reply(200, {
      content: Buffer.from(contents).toString('base64'),
      path
    });
}

describe('Pullie (integration)', function () {
  let pullie;
  let baseUrl;

  before(function (done) {
    const github = nock('https://github.test.fake')
      .post('/api/v3/installations/1/access_tokens')
      .reply(201, {
        token: 'mock_token',
        expires_at: '9999-12-31T00:00:00Z'
      })
      .get('/api/v3/users/jsmith')
      .reply(200)
      .get('/api/v3/repos/org/repo/pulls/165/files')
      .reply(200, [
        {
          filename: 'CHANGELOG.md'
        }
      ])
      .post('/api/v3/repos/org/repo/pulls/165/requested_reviewers')
      .reply(200)
      .post('/api/v3/repos/org/repo/issues/165/comments')
      .reply(200);

    nockFile(github, '.pullierc', JSON.stringify(mockPullieRC));
    nockFile(github, 'package.json', JSON.stringify(mockPackageJson));
    nockFile(github, 'CHANGELOG.md', '# Mock changelog');

    nock('https://jira.test.fake')
      .post('/rest/api/2/search')
      .reply(200, {
        issues: [
          {
            key: 'AB-1234',
            fields: {
              summary: 'Mock ticket 1 title'
            }
          },
          {
            key: 'FOO-5678',
            fields: {
              summary: 'Mock ticket 2 title'
            }
          }
        ]
      });

    startPullie((base, server) => {
      baseUrl = base;
      pullie = server;

      done();
    });
  });

  after(function (done) {
    nock.restore();
    pullie.close(done);
  });

  it('properly processes a pull request', function (done) {
    sendWebhookEvent(baseUrl, openPRPayload, 'sha1=0f38976f0589823100363caa9261a6cf5450e576', (err, res, body) => {
      assume(err).is.falsey();
      assume(res).hasOwn('statusCode', 200);
      assume(body).hasOwn('status', 'ok');
      assume(nock.isDone()).is.true();

      done();
    });
  });

  it('serves documentation at host root', function (done) {
    assumeValidResponse(baseUrl, '<!DOCTYPE html>', done);
  });

  it('serves Prism CSS properly', function (done) {
    assumeValidResponse(baseUrl + '/prism-coy.css', 'prism', done);
  });

  it('serves healthcheck properly', function (done) {
    assumeValidResponse(baseUrl + '/healthcheck.html', 'page ok', done);
  });

  it('serves static files properly', function (done) {
    assumeValidResponse(baseUrl + '/static/pullie.svg', 'svg', done);
  });
});
