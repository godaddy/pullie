const arrayShuffle = require('array-shuffle');
const pReduce = require('p-reduce');
const Commenter = require('../../commenter');
const { parsePackageJson } = require('../../utils');

const REVIEWER_REGEX = /([A-Za-z0-9-_]+)@/;

class ReviewerPlugin {
  /**
   * Reviewer plugin - automatically requests reviews from contributors
   *
   * @constructor
   * @public
   */
  constructor() {
    this.defaultCommentFormat = process.env.REVIEWERS_COMMENT_FORMAT;
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
   * @typedef {import('@octokit/webhooks').WebhookPayloadPullRequest} WebhookPayloadPullRequest
   * @typedef {WebhookPayloadPullRequest & { changes: Object }} WebhookPayloadPullRequestWithChanges
   * @typedef {import('probot').Context<WebhookPayloadPullRequestWithChanges>} ProbotContext
   */
  /**
   * Process a PR webhook and add needed reviewers
   *
   * @memberof ReviewerPlugin
   * @public
   * @param {ProbotContext} context webhook context
   * @param {Commenter} commenter Commenter object for aggregating comments to post
   * @param {Object} config Configuration for this plugin
   * @param {String[]} [config.reviewers] List of reviewer usernames. If not specified, try to pull this from
   *  package.json
   * @param {Number} [config.howMany] Number of reviewers to choose from the set of contributors and maintainers,
   *  defaults to choosing all of the possible reviewers
   * @param {String} [config.commentFormat] Format for comment
   */
  async processRequest(context, commenter, config) {
    config = config || {};
    const commentFormat = config.commentFormat || this.defaultCommentFormat;
    if (config.reviewers) {
      await this.requestReviews(context, config.reviewers, config.howMany, commentFormat, commenter);
      return;
    }
    const packageInfo = await this.getPackageJson(context);
    if (!packageInfo) {
      // No package.json, nothing to do
      return;
    }

    const reviewers = this.getAllPossibleReviewers(packageInfo);
    await this.requestReviews(context,
      reviewers,
      config.howMany,
      commentFormat,
      commenter);

  }

  /**
   * Get all reviewers from the package.json, pulling from the package author, contributors list, and maintainers list
   *
   * @memberof ReviewerPlugin
   * @private
   * @param {Object} packageInfo Parsed package.json file
   * @returns {Object[] | String[]} List of reviewers in the raw format they're listed in package.json
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
    let ret;
    if (!Array.isArray(field)) {
      if (typeof field === 'string' || typeof field === 'object') {
        ret = [field];
      } else {
        ret = [];
      }
    } else {
      ret = field;
    }

    return ret;
  }

  /**
   * Select reviewers from the specified set of candidate reviewers and request reviews from them
   *
   * @memberof ReviewerPlugin
   * @private
   * @param {ProbotContext} context webhook context
   * @param {String[]|Object[]} reviewers A raw list of candidate reviewers
   * @param {Number} [howMany] How many reviewers to select, default is all
   * @param {String} [commentFormat] An optional comment format string to use when posting a comment about
   *  the review request
   * @param {Commenter} commenter Commenter object for aggregating comments to post
   */
  async requestReviews(context, reviewers, howMany, commentFormat, commenter) { // eslint-disable-line max-params
    if (!reviewers) {
      // No users to work with, nothing to do
      return;
    }

    const userList = await this.getUsersFromReviewersList(context, reviewers);
    if (!userList || userList.length === 0) {
      // No reviewers, nothing to do
      return;
    }

    let usersToRequest = userList;
    if (howMany) {
      const shuffled = arrayShuffle(userList);
      usersToRequest = shuffled.slice(0, howMany);
    }

    if (commentFormat) {
      const githubUsernames = usersToRequest.sort().map(username => `@${username}`).join(', ');
      commenter.addComment(
        commentFormat.replace('%s', githubUsernames),
        Commenter.priority.Medium
      );
    }

    await context.github.pulls.createReviewRequest({
      ...context.repo(),
      pull_number: context.payload.pull_request.number,
      reviewers: usersToRequest
    });
  }

  /**
   * Get the parsed contents of the repo's package.json file
   *
   * @memberof ReviewerPlugin
   * @private
   * @param {ProbotContext} context webhook context
   * @returns {Promise<Object>} parsed package.json
   */
  async getPackageJson(context) {
    const pkg = await context.github.repos.getContents({
      ...context.repo(),
      path: 'package.json'
    });
    if (pkg.status === 404) return;
    return await parsePackageJson(pkg.data);
  }

  /**
   * Convert a list of reviewers into a list of users to request review from
   *
   * @memberof ReviewerPlugin
   * @private
   * @param {ProbotContext} context webhook context
   * @param {Array<Object|string>} reviewers List of reviewers, often in the format `Joe Schmoe <jschmoe@domain.com>`
   * @returns {Promise<string[]>} Confirmed users to request review from
   */
  async getUsersFromReviewersList(context, reviewers) {
    if (!reviewers || !reviewers.length) return;

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
      return r !== context.payload.pull_request.user.login;
    })));

    return await pReduce(maybeUsers, async (memo, user) => {
      try {
        const res = await context.github.repos.checkCollaborator({
          ...context.repo(),
          username: user
        });

        return res.status === 204 ? memo.concat([user]) : memo;
      } catch (err) {
        return memo;
      }
    }, []);
  }
}

module.exports = ReviewerPlugin;
