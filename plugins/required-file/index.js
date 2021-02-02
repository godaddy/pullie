const BasePlugin = require('../base');
const Commenter = require('../../commenter');

class RequiredFilePlugin extends BasePlugin {
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
   * Merge the specified overrideConfig on top of the specified base config.
   *
   * @param {Object} baseConfig The base config
   * @param {Object} overrideConfig The override config
   * @returns {Object} The merged config
   * @public
   * @override
   * @memberof RequiredFilePlugin
   */
  mergeConfig(baseConfig, overrideConfig) {
    // Explicitly replace the files array with the one in overrides
    return {
      ...baseConfig,
      ...overrideConfig,
      files: overrideConfig.files
    };
  }

  /**
   * @typedef {import('@octokit/webhooks').EventPayloads.PullRequest} WebhookPayloadPullRequest
   * @typedef {WebhookPayloadPullRequest & { changes: Object }} WebhookPayloadPullRequestWithChanges
   * @typedef {import('probot').Context<WebhookPayloadPullRequestWithChanges>} ProbotContext
   */
  /**
   * Process a PR webhook and perform needed required file checks
   *
   * @memberof RequiredFilePlugin
   * @public
   * @override
   * @param {ProbotContext} context webhook context
   * @param {Commenter} commenter Commenter
   * @param {Object} config Configuration for this plugin
   * @param {String[]} config.files File paths to require in the PR
   */
  async processRequest(context, commenter, config) {
    const files = config && config.files;
    if (!files) {
      throw new Error('Missing `files` field in plugin config');
    }

    for (const f of files) {
      await this.checkFile(context, commenter, f);
    }
  }

  /**
   * @typedef RequiredFile
   * @prop {String} path Path to the file, relative to the root of the repo
   * @prop {String} [message] Message to print if the file is not edited in the PR
   */
  /**
   * Verify that a given file exists in the repo and in the PR
   *
   * @memberof RequiredFilePlugin
   * @private
   *
   * @param {ProbotContext} context webhook context
   * @param {Commenter} commenter Commenter object for aggregating comments to post
   * @param {RequiredFile | string} file The file object, or path to check, relative to the root of the repo
   */
  async checkFile(context, commenter, file) {
    const filePath = typeof file === 'string' ? file : (file && file.path);
    if (!filePath) {
      throw new Error('No file path specified for required file.');
    }

    const message = '⚠️ ' + (typeof file === 'object' && file.message ||
      `You're missing a change to ${filePath}, which is a requirement for changes to this repo.`);

    const existsRes = await context.octokit.repos.getContent({
      ...context.repo(),
      path: filePath
    });
    const exists = existsRes.status === 200;

    if (!exists) return;

    /**
     * @typedef {import('@octokit/rest').PullsListFilesResponseItem} PullsListFilesResponseItem
     * @type {PullsListFilesResponseItem[]}
     */
    const filesInPR = await context.octokit.paginate(context.octokit.pulls.listFiles.endpoint.merge(
      context.pullRequest()), res => res.data);

    if (!filesInPR.some(f => {
      return f.filename === filePath;
    })) {
      commenter.addComment(message, Commenter.priority.High);
    }
  }
}

module.exports = RequiredFilePlugin;
