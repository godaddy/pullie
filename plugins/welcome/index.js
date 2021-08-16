import BasePlugin from '../base.js';
import Commenter from '../../commenter.js';

export default class WelcomePlugin extends BasePlugin {
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
   * @typedef {import('@octokit/webhooks').EventPayloads.WebhookPayloadPullRequest} WebhookPayloadPullRequest
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
   * @param {Object} [config] Configuration for this plugin
   * @param {string} [config.welcomeMessage] Org or repo-level configured welcome message for new contributors
   */
  async processRequest(context, commenter, config = {}) {
    const message = config.welcomeMessage || this.welcomeMessage;

    if (!message) return;

    // Get all issues for repo with user as creator
    const response = await context.octokit.issues.listForRepo(context.repo({
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
