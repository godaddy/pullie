import assume from 'assume';
import fs from 'fs';
import nock from 'nock';
import path from 'path';
/** @type {(url: string, options?: RequestInit) => Promise<Response>} */
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import pullieApp from '../../index.js';
import { Server, Probot } from 'probot';
import { assumeValidResponse } from './helpers.js';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const openPRPayload = require('../fixtures/payloads/open-pr.json');
const mockOrgPullieRC = require('../fixtures/payloads/mock-org-pullierc.json');
const mockPullieRC = require('../fixtures/payloads/mock-pullierc.json');
const mockPackageJson = require('../fixtures/payloads/mock-packagejson.json');

function nockFile(scope, urlPath, contents, repo = 'repo') {
  scope.get(`/api/v3/repos/org/${repo}/contents/` + urlPath)
    .reply(200, {
      content: Buffer.from(contents).toString('base64'),
      path: urlPath
    });
}

function verifyComment({ body }) {
  try {
    assume(body).contains('Mock ticket 1 title');
    assume(body).contains('Requested review from @jsmith');
    assume(body).contains('o hai!');
  } catch (failedAssumption) {
    // eslint-disable-next-line no-console
    console.error(failedAssumption.toString());
    return false;
  }

  return true;
}

describe('Pullie (integration)', function () {
  /** @type {Probot} */
  let pullie;
  /** @type {string} */
  let mockCert;

  before(function (done) {
    const __dirname = fileURLToPath(new URL('.', import.meta.url));
    fs.readFile(path.join(__dirname, '../fixtures/mock-key.pem'), (err, cert) => {
      if (err) return done(err);
      mockCert = cert;
      done();
    });
  });

  before(function () {
    const github = nock('https://github.test.fake')
      .post('/api/v3/app/installations/1/access_tokens')
      .reply(201, {
        token: 'mock_token',
        expires_at: '9999-12-31T00:00:00Z',
        permissions: {
          contents: 'read'
        }
      })
      .get('/api/v3/repos/org/repo/collaborators/jsmith')
      .reply(204)
      .get('/api/v3/repos/org/repo/pulls/165/files')
      .reply(200, [
        {
          filename: 'CHANGELOG.md'
        }
      ])
      .post('/api/v3/repos/org/repo/pulls/165/requested_reviewers')
      .reply(200)
      .get('/api/v3/repos/org/repo/issues?state=all&creator=JDoe')
      .reply(200, [
        {
          pull_request: {}
        }
      ])
      .post('/api/v3/repos/org/repo/issues/165/comments', verifyComment)
      .reply(200);

    nockFile(github, '.pullierc', JSON.stringify(mockOrgPullieRC), '.github');
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
  });

  before(function () {
    process.env.JIRA_PROTOCOL = 'https';
    process.env.JIRA_HOST = 'jira.test.fake';
    process.env.JIRA_USERNAME = 'test_user';
    process.env.JIRA_PASSWORD = 'test_password';
  });

  after(function () {
    nock.restore();
  });

  describe('API', function () {
    before(async function () {
      process.env.DISABLE_DOCS_ROUTE = 'true';
      pullie = new Probot({ appId: 123, privateKey: mockCert, baseUrl: 'https://github.test.fake/api/v3' });
      await pullie.load(pullieApp);
      nock.disableNetConnect();
    });

    after(function () {
      delete process.env.DISABLE_DOCS_ROUTE;
      nock.enableNetConnect();
    });

    it('properly processes a pull request', async function () {
      this.timeout(5000);
      await pullie.receive({
        id: 'mock',
        name: 'pull_request',
        payload: openPRPayload
      });
      if (!nock.isDone()) {
        // eslint-disable-next-line no-console
        console.error('pending mocks: %j', nock.pendingMocks());
      }
      assume(nock.isDone()).is.true();
    });
  });

  describe('Docs', function () {
    /** @type {import('probot').Server} */
    let server;
    let baseUrl;
    before(async function () {
      server = new Server({
        Probot: Probot.defaults({ appId: 123, privateKey: mockCert })
      });
      await server.load(pullieApp);
      const httpServer = await server.start();
      // @ts-ignore
      const { port } = httpServer.address();
      baseUrl = `http://localhost:${port}/docs`;
    });

    after(async function () {
      await server.stop();
    });

    it('serves documentation at host root', async function () {
      await assumeValidResponse(baseUrl, '<!DOCTYPE html>');
    });

    it('serves Prism CSS properly', async function () {
      await assumeValidResponse(baseUrl + '/prism-coy.css', 'prism');
    });

    it('serves healthcheck properly', async function () {
      await assumeValidResponse(baseUrl + '/healthcheck.html', 'page ok');
    });

    it('serves static files properly', async function () {
      await assumeValidResponse(baseUrl + '/static/pullie.svg', 'svg');
    });
  });

  describe('No Docs', function () {
    /** @type {import('probot').Server} */
    let server;
    let baseUrl;

    before(async function () {
      process.env.DISABLE_DOCS_ROUTE = 'true';
      server = new Server({
        Probot: Probot.defaults({ appId: 123, privateKey: mockCert })
      });
      await server.load(pullieApp);
      const httpServer = await server.start();
      // @ts-ignore
      const { port } = httpServer.address();
      baseUrl = `http://localhost:${port}/docs`;
    });

    after(async function () {
      await server.stop();
    });

    it('does not initialize the docs route when DISABLE_DOCS_ROUTE is set', async function () {
      const res = await fetch(baseUrl);
      assume(res.status).equals(404);
    });
  });
});
