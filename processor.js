/* eslint no-continue: 0 */
const Commenter = require('./commenter');
const PluginManager = require('./plugins');
const { parseBase64Json } = require('./utils');
const processConfig = require('./config-processor');

/**
 * @typedef {import('@octokit/webhooks').EventPayloads.WebhookPayloadPullRequest} WebhookPayloadPullRequest
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
  context.log.info(logData, 'Processing PR');

  if (process.env.GH_ENTERPRISE_ID) {
    const ghecEnterpriseId = parseInt(process.env.GH_ENTERPRISE_ID, 10);
    if (!isNaN(ghecEnterpriseId) &&
      context.payload.enterprise &&
      context.payload.enterprise.id === ghecEnterpriseId) {
      context.log.info('PR is from the configured Enterprise');
    } else {
      context.log.info('PR is not from the configured Enterprise, nothing to do');
      return;
    }
  }

  if (process.env.NO_PUBLIC_REPOS === 'true' && !context.payload.repository.private) {
    context.log.info('Pullie has been disabled on public repos, nothing to do');
    return;
  }

  let repoConfig;
  try {
    repoConfig = await getRepoConfig(context);
  } catch (err) {
    context.log.error({
      requestId: context.id,
      err
    }, 'Error getting repository config');
    return;
  }

  if (!repoConfig) {
    // No config specified for this repo, nothing to do
    context.log.info(logData, 'No config specified for repo, nothing to do');
    return;
  }

  let orgConfig;
  try {
    orgConfig = await getOrgConfig(context);
  } catch (err) {
    context.log.warn({
      requestId: context.id,
      err
    }, 'Error getting org config');
    orgConfig = null;
  }

  /** @type {PluginManagerType} */
  // @ts-ignore
  const pluginManager = new PluginManager();
  const config = processConfig(pluginManager, orgConfig, repoConfig, invalidPlugin => {
    context.log.error({
      repository: context.payload.repository.full_name, plugin: invalidPlugin, requestId: context.id
    }, 'Invalid plugin specified in repo config');
  });

  if (!Array.isArray(config.plugins) || config.plugins.length === 0) {
    // No plugins to run, nothing to do
    context.log.info(logData, 'No plugins to run, nothing to do');
    return;
  }

  const commenter = new Commenter();
  for (const pluginConfig of config.plugins) {
    const pluginName = typeof pluginConfig === 'string' ? pluginConfig : pluginConfig.plugin;
    const plugin = pluginManager[pluginName];
    if (!plugin) {
      context.log.error({
        repository: context.payload.repository.full_name, plugin: pluginName, requestId: context.id
      }, 'Invalid plugin specified in config');
      continue;
    }
    if (context.payload.action === 'edited' && !plugin.processesEdits) {
      continue;
    }
    if (context.payload.action === 'ready_for_review' && !plugin.processesReadyForReview) {
      continue;
    }
    const cfg = typeof pluginConfig === 'string' ? {} : pluginConfig.config;
    try {
      await plugin.processRequest(context, commenter, cfg);
    } catch (pluginProcessRequestErr) {
      context.log.error({
        error: pluginProcessRequestErr,
        repository: context.payload.repository.full_name,
        number: context.payload.number,
        plugin: pluginName,
        requestId: context.id
      }, 'Error running plugin');
      continue;
    }
  }

  context.log.info(logData, 'Finished processing PR');
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
    pullieRcRes = await context.github.repos.getContent({
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
    pullieRcRes = await context.github.repos.getContent({
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
