const request = require('request');
const GitHulk = require('githulk');
const JWT = require('jsonwebtoken');
const fs = require('fs');

class GitHubClient {
  /**
   * GitHub client
   *
   * @constructor
   * @public
   * @param {Object} config Configuration
   * @param {String} config.apiUrl URL to GitHub server API
   * @param {String} config.appId GitHub App identifier
   * @param {String} config.appKeyPath Path to the private key file for this GitHub App
   */
  constructor(config) {
    this.apiUrl = config.apiUrl;
    this.appId = config.appId;
    this.appKeyPath = config.appKeyPath;
  }

  /**
   * Login to a GitHub session using the specified installation ID
   *
   * @memberof GitHubClient
   * @public
   * @param {Number} installationId The installation identifier to login with
   * @param {Function} done Continuation callback
   */
  login(installationId, done) {
    this.getAppKey((getKeyErr, key) => {
      if (getKeyErr) return done(getKeyErr);
      JWT.sign({}, key, {
        algorithm: 'RS256',
        expiresIn: '3m',
        issuer: this.appId
      }, (jwtSignErr, jwt) => {
        if (jwtSignErr) return done(jwtSignErr);
        this.getAccessKey(jwt, installationId, (getAccessKeyErr, accessKey) => {
          if (getAccessKeyErr) return done(getAccessKeyErr);
          this.createGitHulk(accessKey);
          done();
        });
      });
    });
  }

  /**
   * Get the private key for the app
   *
   * @memberof GitHubClient
   * @private
   * @param {Function} done Continuation callback
   */
  getAppKey(done) {
    fs.readFile(this.appKeyPath, { encoding: 'utf8' }, done);
  }

  /**
   * Get an access key for the given installation
   *
   * @param {String} jwt Signed token from the App
   * @param {Number} installationId The installation for which to retrieve an access key
   * @param {Function} done Continuation callback
   */
  getAccessKey(jwt, installationId, done) {
    request.post(`${this.apiUrl}installations/${installationId}/access_tokens`,
      {
        auth: {
          bearer: jwt
        },
        headers: {
          Accept: 'application/vnd.github.machine-man-preview+json'
        },
        json: true
      }, (err, res, body) => {
        if (err) return done(err);
        if (res.statusCode < 200 || res.statusCode > 299)
          return done(new Error('Unexpected status code from GitHub Apps access_token API: ' + res.statusCode +
            '\n' + JSON.stringify(body)));

        done(null, body.token);
      });
  }

  /**
   * Setup the GitHulk client with the specified access token
   *
   * @memberof GitHubClient
   * @private
   * @param {String} token The access token to login with
   */
  createGitHulk(token) {
    this.githulk = new GitHulk({
      url: this.apiUrl,
      token
    });
  }

  /**
   * Logout of a GitHub session
   *
   * @memberof GitHubClient
   * @public
   */
  logout() {
    this.githulk = null;
  }

  /**
   * Call the callback with an Error indicating that the client is not logged into GitHub properly
   *
   * @memberof GitHubClient
   * @private
   * @param {Function} done Continuation callback
   */
  notLoggedInError(done) {
    done(new Error('Not logged in to GitHub'));
  }

  /**
   * Get packaged file contents for a file from GitHub
   *
   * @memberof GitHubClient
   * @public
   * @param {String} repo Repository full name (username/reponame)
   * @param {Object} opts Options
   * @param {Function} done Continuation callback
   * @returns {Undefined} Nothing of significance
   */
  getFileContents(repo, opts, done) {
    if (!this.githulk) return this.notLoggedInError(done);
    this.githulk.repository.contents(repo, opts, done);
  }

  /**
   * Parse a JSON file pulled from GitHub
   *
   * @memberof GitHubClient
   * @public
   * @param {Object} pkg Packaged file from GitHub
   * @param {Function} done Continuation callback
   * @returns {Undefined} Nothing of significance
   */
  parsePackageJson(pkg, done) {
    let contents;

    if (pkg && pkg.content) {
      contents = new Buffer(pkg.content, 'base64');
      try {
        contents = JSON.parse(contents.toString());
      } catch (ex) {
        return done(ex);
      }
    }

    return done(null, contents);
  }

  /**
   * Create a comment on the specified issue/PR
   *
   * @memberof GitHubClient
   * @public
   * @param {String} repo Repository full name (username/reponame)
   * @param {Number} issueId Issue/PR number
   * @param {String} body Comment body
   * @param {Function} done Continuation callback
   * @returns {Undefined} Nothing of significance
   */
  createIssueComment(repo, issueId, body, done) {
    if (!this.githulk) return this.notLoggedInError(done);
    this.githulk.comments.create(repo, issueId, {
      body
    }, done);
  }

  /**
   * Check if the specified file exists in the repo
   *
   * @memberof GitHubClient
   * @public
   * @param {String} repo Repository full name (username/reponame)
   * @param {String} path Path to the file in the repo
   * @param {Function} done Continuation callback
   * @returns {Undefined} Nothing of significance
   */
  checkIfFileExists(repo, path, done) {
    if (!this.githulk) return this.notLoggedInError(done);
    this.githulk.repository.contents(repo, { path }, err => {
      if (err && err.statusCode === 404) return done(null, false);
      if (err) return done(err);
      return done(null, true);
    });
  }

  /**
   * Get a list of files in the specified PR
   *
   * @memberof GitHubClient
   * @public
   * @param {String} repo Repository full name (username/reponame)
   * @param {Number} prId Pull request number
   * @param {Function} done Continuation callback
   * @returns {Undefined} Nothing of significance
   */
  getFilesInPullRequest(repo, prId, done) {
    if (!this.githulk) return this.notLoggedInError(done);
    this.githulk.pulls.files(repo, prId, {}, done);
  }

  /**
   * Request review from the specified list of reviewers
   *
   * @memberof GitHubClient
   * @public
   * @param {String} repo Repository full name (username/reponame)
   * @param {Number} prId Pull request number
   * @param {String[]} reviewers An array of reviewer usernames
   * @param {Function} done Continuation callback
   * @returns {Undefined} Nothing of significance
   */
  requestReviewers(repo, prId, reviewers, done) {
    if (!this.githulk) return this.notLoggedInError(done);

    this.githulk.pulls.requestReviewers(repo, prId, {
      headers: {
        Accept: 'application/vnd.github.machine-man-preview+json'
      },
      reviewers
    }, done);
  }

  /**
   * Check if the specified user exists
   *
   * @memberof GitHubClient
   * @public
   * @param {String} user Username to look up
   * @param {Function} done Continuation callback
   * @returns {Undefined} Nothing of significance
   */
  userExists(user, done) {
    if (!this.githulk) return this.notLoggedInError(done);
    this.githulk.users.get(user, err => {
      if (err) {
        if (err.statusCode === 404) {
          return done(null, false);
        }
        return done(err);
      }
      done(null, true);
    });
  }
}

module.exports = GitHubClient;
