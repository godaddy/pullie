const BasePlugin = require('../base');
// const Commenter = require('../../commenter');

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
   * @param {Object} config Configuration for this plugin
   * @param {String[]} config.files File paths to require in the PR
   */
  async processRequest(context, commenter, config) {
    // do stuff here like a champ!
  }
}

module.exports = WelcomePlugin;
