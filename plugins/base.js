/**
 * Abstract base Plugin class
 *
 * @abstract
 * @public
 */
module.exports = class BasePlugin {
  /**
   * Merge the specified overrideConfig on top of the specified base config.
   *
   * @param {Object} baseConfig The base config
   * @param {Object} overrideConfig The override config
   * @returns {Object} The merged config
   * @public
   */
  mergeConfig(baseConfig, overrideConfig) {
    return {
      ...baseConfig,
      ...overrideConfig
    };
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
   * @typedef {import('../commenter')} Commenter
   */
  /**
   * Abstract implementation for processRequest
   *
   * @param {ProbotContext} context webhook context
   * @param {Commenter} commenter Commenter object for aggregating comments to post
   * @param {Object} config Configuration for this plugin
   * @abstract
   * @throws {Error} Abstract method not implemented
   */
  async processRequest(context, commenter, config) {
    // Use these params to make linters/ts happy
    void context;
    void commenter;
    void config;

    throw new Error('.processRequest not defined');
  }
};
