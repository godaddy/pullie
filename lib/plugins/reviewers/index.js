const arrayShuffle = require('array-shuffle');
const async = require('async');
const Commenter = require('../../commenter');

const REVIEWER_REGEX = /([A-Za-z0-9-_]+)@/;

class ReviewerPlugin {
  /**
   * Reviewer plugin - automatically requests reviews from contributors
   *
   * @constructor
   * @public
   * @param {Slay.App} app Slay app
   */
  constructor(app) {
    this.app = app;
    const config = app.config.get('reviewers');
    this.defaultCommentFormat = config && config.commentFormat;
  }

  /**
   * Whether this plugin processes edit actions
   * @public
   * @returns {Boolean} Whether this plugin processes edit actions
   */
  get processesEdits() {
    return false;
  }

  /**
   * Process a PR webhook and add needed reviewers
   *
   * @memberof ReviewerPlugin
   * @public
   * @param {Object} data PR webhook data
   * @param {Object} config Configuration for this plugin
   * @param {String[]} [config.reviewers] List of reviewer usernames. If not specified, try to pull this from
   *  package.json
   * @param {Number} [config.howMany] Number of reviewers to choose from the set of contributors and maintainers,
   *  defaults to choosing all of the possible reviewers
   * @param {Object} apis A set of APIs needed to process the request
   * @param {Commenter} apis.commenter Commenter object for aggregating comments to post
   * @param {GitHubClient} apis.github A GitHubClient instance for this request
   * @param {Function} done Continuation callback
   */
  processRequest(data, config, apis, done) {
    config = config || {};
    const commentFormat = config.commentFormat || this.defaultCommentFormat;
    if (config.reviewers) {
      this.requestReviews(data, config.reviewers, config.howMany, commentFormat, apis, done);
    } else {
      this.getPackageJson(data.repository, apis, (packageJsonErr, packageInfo) => {
        if (packageJsonErr) return done(packageJsonErr);
        if (!packageInfo) {
          // No package.json, nothing to do
          return done();
        }

        const reviewers = this.getAllPossibleReviewers(packageInfo);
        this.requestReviews(data,
          reviewers,
          config.howMany,
          commentFormat,
          apis,
          done);
      });
    }
  }

  /**
   * Get all reviewers from the package.json, pulling from the package author, contributors list, and maintainers list
   *
   * @memberof ReviewerPlugin
   * @private
   * @param {Object} packageInfo Parsed package.json file
   * @returns {String[]} List of reviewers in the raw format they're listed in package.json
   */
  getAllPossibleReviewers(packageInfo) {
    const contributors = this.normalizeReviewerField(packageInfo.contributors);
    const maintainers = this.normalizeReviewerField(packageInfo.maintainers);

    const ret = contributors.concat(maintainers);
    if (packageInfo.author) ret.push(packageInfo.author);

    return ret;
  }

  /**
   * Normalize a reviewer list field from package.json
   *
   * If it is an array, just return the arrray
   * If it is a string or object, return a one-element array containing that item
   * Else, return an empty array
   *
   * @memberof ReviewerPlugin
   * @private
   * @param {String|String[]|Object[]} field The reviewer field to normalize
   * @returns {String[]|Object[]} The normalized list
   */
  normalizeReviewerField(field) {
    let ret = field;
    if (!Array.isArray(field)) {
      if (typeof field === 'string' || typeof field === 'object') {
        ret = [field];
      } else {
        ret = [];
      }
    }

    return ret;
  }

  /**
   * Select reviewers from the specified set of candidate reviewers and request reviews from them
   *
   * @memberof ReviewerPlugin
   * @private
   * @param {Object} data PR webhook data
   * @param {Object} data.pull_request Metadata about the pull request
   * @param {Number} data.pull_request.number The PR number
   * @param {Object} data.repository Metadata about the repository that the PR was submitted to
   * @param {String} data.repository.full_name The full name of the repo
   * @param {String[]|Object[]} reviewers A raw list of candidate reviewers
   * @param {Number} [howMany] How many reviewers to select, default is all
   * @param {String} [commentFormat] An optional comment format string to use when posting a comment about
   *  the review request
   * @param {Object} apis A set of APIs needed to process the request
   * @param {Commenter} apis.commenter Commenter object for aggregating comments to post
   * @param {GitHubClient} apis.github A GitHubClient instance for this request
   * @param {Function} done Continuation callback
   * @returns {Undefined} Nothing of significance
   */
  requestReviews(data, reviewers, howMany, commentFormat, apis, done) { // eslint-disable-line max-params
    if (!reviewers) {
      // No users to work with, nothing to do
      return void done();
    }

    this.getUsersFromReviewersList(reviewers, data.pull_request, apis, (err, userList) => {
      if (err) return done(err);
      if (!userList || userList.length === 0) {
        // No reviewers, nothing to do
        return void done();
      }

      let usersToRequest = userList;
      if (howMany) {
        const shuffled = arrayShuffle(userList);
        usersToRequest = shuffled.slice(0, howMany);
      }

      if (commentFormat) {
        const githubUsernames = usersToRequest.sort().map(username => `@${username}`).join(', ');
        apis.commenter.addComment(
          commentFormat.replace('%s', githubUsernames),
          Commenter.priority.Medium
        );
      }

      apis.github.requestReviewers(
        data.repository.full_name,
        data.pull_request.number,
        usersToRequest,
        done
      );
    });
  }

  /**
   * Get the parsed contents of the repo's package.json file
   *
   * @memberof ReviewerPlugin
   * @private
   * @param {Object} repoInfo Repository info
   * @param {Object} apis A set of APIs needed to process the request
   * @param {GitHubClient} apis.github A GitHubClient instance for this request
   * @param {Function} done Continuation callback
   */
  getPackageJson(repoInfo, apis, done) {
    apis.github.getFileContents(repoInfo.full_name, {
      path: 'package.json'
    }, (getRcErr, pkg) => {
      if (getRcErr) {
        if (getRcErr.statusCode === 404) {
          return done();
        }
        return done(getRcErr);
      }

      apis.github.parsePackageJson(pkg, done);
    });
  }

  /**
   * Convert a list of reviewers into a list of users to request review from
   *
   * @memberof ReviewerPlugin
   * @private
   * @param {String[]} reviewers List of reviewers, often in the format `Joe Schmoe <jschmoe@domain.com>`
   * @param {Object} prInfo PR information
   * @param {Object} apis A set of APIs needed to process the request
   * @param {GitHubClient} apis.github A GitHubClient instance for this request
   * @param {Function} done Continuation callback
   * @returns {Undefined} Nothing of significance
   */
  getUsersFromReviewersList(reviewers, prInfo, apis, done) {
    if (!reviewers || !reviewers.length) return done();

    const maybeUsers = Array.from(new Set(reviewers.map(r => {
      const type = typeof r;
      let testSubject;
      if (type === 'string') {
        testSubject = r;
      } else if (type === 'object') {
        testSubject = r.email || '';
      } else {
        return null;
      }
      const matches = REVIEWER_REGEX.exec(testSubject);
      if (!matches) return testSubject;
      return matches[1];
    }).filter(r => {
      if (!r) return false;
      return r !== prInfo.user.login;
    })));

    async.reduce(maybeUsers, [], (memo, user, next) => {
      apis.github.userExists(user, (userExistsErr, exists) => {
        if (userExistsErr) return next(userExistsErr);
        next(null, exists ? memo.concat([user]) : memo);
      });
    }, (reduceErr, confirmedUsers) => {
      if (reduceErr) return done(reduceErr);
      done(null, confirmedUsers);
    });
  }
}

module.exports = function ReviewerPluginFactory(app) {
  return new ReviewerPlugin(app);
};
