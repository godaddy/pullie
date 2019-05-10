const Commenter = require('../../commenter');

class RequiredFilePlugin {
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
   * Process a PR webhook and perform needed required file checks
   *
   * @memberof RequiredFilePlugin
   * @public
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
    // @ts-ignore
    const message = '⚠️ ' + (file.message ||
      `You're missing a change to ${filePath}, which is a requirement for changes to this repo.`);

    const existsRes = await context.github.repos.getContents({
      ...context.repo(),
      path: filePath
    });
    const exists = existsRes.status === 200;

    if (!exists) return;

    /**
     * @typedef {import('@octokit/rest').PullsListFilesResponseItem} PullsListFilesResponseItem
     * @type {PullsListFilesResponseItem[]}
     */
    const filesInPR = await context.github.paginate(context.github.pulls.listFiles.endpoint.merge({
      ...context.repo(),
      pull_number: context.payload.number
    }), res => res.data);

    if (!filesInPR.some(f => {
      return f.filename === filePath;
    })) {
      commenter.addComment(message, Commenter.priority.High);
    }
  }
}

module.exports = RequiredFilePlugin;
