const BasePlugin = require('../base');
const Commenter = require('../../commenter');

class WelcomePlugin extends BasePlugin {
  /**
   * Welcome plugin - automatically welcomes new contributors
   *
   * @constructor
   * @public
   */
  constructor() {
    super();
    this.welcomeMessage = process.env.WELCOME_MESSAGE;
  }

  /**
   * @typedef {import('@octokit/webhooks').WebhookPayloadPullRequest} WebhookPayloadPullRequest
   * @typedef {WebhookPayloadPullRequest & { changes: Object }} WebhookPayloadPullRequestWithChanges
   * @typedef {import('probot').Context<WebhookPayloadPullRequestWithChanges>} ProbotContext
   */
  /**
   * Process a PR and check to see if we have a new friend
   *
   * @memberof WelcomePlugin
   * @public
   * @override
   * @param {ProbotContext} context webhook context
   * @param {Commenter} commenter Commenter
   * @param {Object} config Configuration for this plugin
   */
  async processRequest(context, commenter, config = {}) {
    const message = config.welcomeMessage || this.welcomeMessage;

    if (!message) return;

    // Get all issues for repo with user as creator
    const response = await context.github.issues.listForRepo(context.repo({
      state: 'all',
      creator: context.payload.pull_request.user.login
    }));

    // get all the PRs by the contributor
    const pullRequests = response.data.filter(data => data.pull_request);

    // if we only have one, then lets welcome them
    if (pullRequests.length === 1) {
      commenter.addComment(message, Commenter.priority.High);
    }
  }

}

module.exports = WelcomePlugin;
