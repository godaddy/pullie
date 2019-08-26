/* eslint no-continue: 0 */
const Commenter = require('./commenter');
const PluginManager = require('./plugins');
const { parseBase64Json } = require('./utils');
const processConfig = require('./config-processor');

/**
 * @typedef {import('@octokit/webhooks').WebhookPayloadPullRequest} WebhookPayloadPullRequest
 * @typedef {WebhookPayloadPullRequest & { changes: Object }} WebhookPayloadPullRequestWithChanges
 * @typedef {import('probot').Context<WebhookPayloadPullRequestWithChanges>} ProbotContext
 * @typedef {import('./plugins/base')} BasePlugin
 * @typedef {{[pluginName: string]: BasePlugin}} PluginManagerType
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

  let repoConfig;
  try {
    repoConfig = await getRepoConfig(context);
  } catch (err) {
    context.log.error('Error getting repository config', {
      requestId: context.id,
      err
    });
    return;
  }

  if (!repoConfig) {
    // No config specified for this repo, nothing to do
    context.log.info('No config specified for repo, nothing to do', logData);
    return;
  }

  let orgConfig;
  try {
    orgConfig = await getOrgConfig(context);
  } catch (err) {
    context.log.warn('Error getting org config', {
      requestId: context.id,
      err
    });
    orgConfig = null;
  }

  /** @type {PluginManagerType} */
  // @ts-ignore
  const pluginManager = new PluginManager();
  const config = processConfig(pluginManager, orgConfig, repoConfig, invalidPlugin => {
    context.log.error('Invalid plugin specified in repo config',
      { repository: context.payload.repository.full_name, plugin: invalidPlugin, requestId: context.id });
  });

  if (!Array.isArray(config.plugins) || config.plugins.length === 0) {
    // No plugins to run, nothing to do
    context.log.info('No plugins to run, nothing to do', logData);
    return;
  }

  const commenter = new Commenter();
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
    const cfg = typeof pluginConfig === 'string' ? {} : pluginConfig.config;
    try {
      await plugin.processRequest(context, commenter, cfg);
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
  let pullieRcRes = {};
  try {
    pullieRcRes = await context.github.repos.getContents({
      ...context.repo(),
      path: '.pullierc'
    });
  } catch (err) {
    // If there's no .pullierc, just skip this request. Otherwise, re-throw the error.
    if (err.status === 404) return;
    throw err;
  }

  return parseBase64Json(pullieRcRes.data);
}

/**
 * Get org-level config for the org specified in the context
 *
 * @param {ProbotContext} context PR webhook context
 * @returns {Promise<Object>} Config for the repo
 */
async function getOrgConfig(context) {
  let pullieRcRes = {};
  try {
    pullieRcRes = await context.github.repos.getContents({
      owner: context.payload.repository.owner.login,
      repo: '.github',
      path: '.pullierc'
    });
  } catch (err) {
    // If there's no .pullierc, just skip this request. Otherwise, re-throw the error.
    if (err.status === 404) return;
    throw err;
  }

  return parseBase64Json(pullieRcRes.data);
}
