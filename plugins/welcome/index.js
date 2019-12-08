const BasePlugin = require('../base');
const Commenter = require('../../commenter');

class WelcomePlugin extends BasePlugin {
  /**
   * Whether this plugin processes edit actions
   * @public
   * @override
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
   * Process a PR and check to see if we have a new friend
   *
   * @memberof WelcomePlugin
   * @public
   * @override
   * @param {ProbotContext} context webhook context
   * @param {Commenter} commenter Commenter
   */
  async processRequest(context, commenter) {
    const message = process.env.WELCOME_MESSAGE || 'Thanks for making contributing to the project!';

    // Get all issues for repo with user as creator
    const response = await context.github.issues.listForRepo(context.repo({
      state: 'all',
      creator: context.payload.pull_request.user.login
    }));

    // get the total PRs by the contributor
    const total = response.data.filter(data => data.pull_request);

    // if we only have one, then lets welcome them
    if (total.length === 1) {
      commenter.addComment(message, Commenter.priority.Low);
    }
  }

}

module.exports = WelcomePlugin;
