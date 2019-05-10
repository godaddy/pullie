/* eslint no-continue: 0 */
const Commenter = require('./commenter');
const PluginManager = require('./plugins');
const { parsePackageJson } = require('./utils');

/**
 * @typedef {import('@octokit/webhooks').WebhookPayloadPullRequest} WebhookPayloadPullRequest
 * @typedef {WebhookPayloadPullRequest & { changes: Object }} WebhookPayloadPullRequestWithChanges
 * @typedef {import('probot').Context<WebhookPayloadPullRequestWithChanges>} ProbotContext
 */
/**
 * Process a PR
 *
 * @param {ProbotContext} context PR webhook context
 */
module.exports = async function processPR(context) { // eslint-disable-line complexity, max-statements
  const logData = {
    repository: context.payload.repository.full_name,
    number: context.payload.number,
    requestId: context.id
  };
  context.log.info('Processing PR', logData);

  let config;
  try {
    config = await getRepoConfig(context);
  } catch (err) {
    context.log.error('Error getting repository config', {
      requestId: context.id,
      err
    });
    return;
  }

  if (!config || !Array.isArray(config.plugins) || config.plugins.length === 0) {
    // No config specified for this repo, nothing to do
    context.log.info('No config specified for repo, nothing to do', logData);
    return;
  }

  const commenter = new Commenter();
  const pluginManager = new PluginManager();
  for (const pluginConfig of config.plugins) {
    const pluginName = typeof pluginConfig === 'string' ? pluginConfig : pluginConfig.plugin;
    const plugin = pluginManager[pluginName];
    if (!plugin) {
      context.log.error('Invalid plugin specified in config',
        { repository: context.payload.repository.full_name, plugin: pluginName, requestId: context.id });
      continue;
    }
    if (context.payload.action === 'edited' && !plugin.processesEdits) {
      continue;
    }
    try {
      await plugin.processRequest(context, commenter, pluginConfig.config || {});
    } catch (pluginProcessRequestErr) {
      context.log.error('Error running plugin',
        {
          error: pluginProcessRequestErr,
          repository: context.payload.repository.full_name,
          number: context.payload.number,
          plugin: pluginName,
          requestId: context.id
        });
      continue;
    }
  }

  context.log.info('Finished processing PR', logData);
  const comment = commenter.flushToString();
  if (comment) {
    await context.github.issues.createComment({
      ...context.repo(),
      issue_number: context.payload.number,
      body: comment
    });
  }
};

/**
 * Get config for the repo specified in the context
 *
 * @param {ProbotContext} context PR webhook context
 * @returns {Promise<Object>} Config for the repo
 */
async function getRepoConfig(context) {
  const pullieRcRes = await context.github.repos.getContents({
    ...context.repo(),
    path: '.pullierc'
  });
  if (pullieRcRes.status === 404) return;
  return parsePackageJson(pullieRcRes.data);
}
