const hasWIP = /\bWIP\b/;

class WIPPlugin {
  /**
   * Whether this plugin processes edit actions
   * @public
   * @returns {Boolean} Whether this plugin processes edit actions
   */
  get processesEdits() {
    return true;
  }

  /**
   * @typedef {import('@octokit/webhooks').WebhookPayloadPullRequest} WebhookPayloadPullRequest
   * @typedef {WebhookPayloadPullRequest & { changes: Object }} WebhookPayloadPullRequestWithChanges
   * @typedef {import('probot').Context<WebhookPayloadPullRequestWithChanges>} ProbotContext
   */
  /**
   * Process a PR webhook and adjust draft state based on WIP in title
   *
   * @memberof WIPPlugin
   * @public
   * @param {ProbotContext} context webhook context
   */
  // eslint-disable-next-line complexity
  async processRequest(context) {
    const data = context.payload;
    const isEdit = data.action === 'edited';
    let oldTitle = null;

    if (isEdit) {
      oldTitle = data.changes && data.changes.title && data.changes.title.from;
      if (!oldTitle || oldTitle === data.pull_request.title) {
        // Title hasn't changed, nothing to do
        return;
      }
    }

    const title = data.pull_request.title;
    const isDraft = context.payload.pull_request.draft;
    let newDraftStatus = null;
    if (title && hasWIP.test(title) && !isDraft) {
      newDraftStatus = true;
    } else if (isEdit && isDraft && hasWIP.test(oldTitle)) {
      newDraftStatus = false;
    }
    if (newDraftStatus !== null) {
      await context.github.pulls.update(context.repo({
        pull_number: context.payload.pull_request.number,
        draft: newDraftStatus
      }));
    }
  }
}

module.exports = WIPPlugin;
