/**
 * @typedef {import('./plugins/base.js')} BasePlugin
 * @typedef {{[key: string]: BasePlugin}} PluginManager
 */
/**
 * @typedef {Object} Plugin
 * @prop {string} plugin The name of the plugin
 * @prop {Object} [config] Arbitrary plugin-specific configuration
 */
/**
 * @typedef {Array<string | Plugin>} PluginList
 */
/**
 * @typedef {Object} PluginMergeManifest
 * @prop {string[]} [exclude] A list of plugin names to exclude from the base set
 * @prop {PluginList} [include] A list of plugins (names or objects) to merge on top of the base set
 */
/**
 * @typedef {Object} PullieConfig
 * @prop {PluginList} plugins The list of plugins to run
 */
/**
 * @typedef {Object} PullieRepoConfig
 * @prop {PluginList | PluginMergeManifest} plugins The list of plugins to run
 */
/**
 * @callback OnInvalidPluginCallback
 * @param {string} name The name of the invalid plugin
 */

import deepClone from 'clone-deep';
import deepMerge from 'deepmerge';

/**
 * Process the specified org-level and repo-level config into a merged configuration
 *
 * @param {PluginManager} pluginManager The plugin manager
 * @param {PullieConfig} orgConfig The org-level config
 * @param {PullieRepoConfig} repoConfig The repo-level config
 * @param {OnInvalidPluginCallback} [onInvalidPlugin] Function to call when an invalid plugin is encountered
 * @returns {PullieConfig} The merged config
 * @public
 */
export default function processConfig(pluginManager, orgConfig, repoConfig, onInvalidPlugin) {
  if (!orgConfig) {
    // Set up a default orgConfig so we can properly transform the repo config below
    orgConfig = {
      plugins: []
    };
  }

  if (!repoConfig) return {
    ...orgConfig
  };

  const { plugins: orgPlugins, ...restOfOrgConfig } = orgConfig;
  const { plugins: repoPlugins, ...restOfRepoConfig } = repoConfig;

  // Start by deep-merging any config values other than plugins
  const config = deepMerge(restOfOrgConfig, restOfRepoConfig);
  let plugins = orgPlugins;

  // Now, check if the repo's plugins field is a merge manifest or a normal list
  if (Array.isArray(repoPlugins)) {
    // It is a list, treat it as an include list
    plugins = applyIncludeList({ pluginManager, orgPlugins, repoIncludeList: repoPlugins, onInvalidPlugin });
  } else if (typeof repoPlugins === 'object') {
    // It is a merge manifest, handle excludes first
    if (repoPlugins.exclude) {
      plugins = applyExcludeList({ orgPlugins, repoExcludeList: repoPlugins.exclude });
    }

    // Now handle includes
    if (repoPlugins.include) {
      plugins = applyIncludeList({
        pluginManager,
        orgPlugins: plugins,
        repoIncludeList: repoPlugins.include,
        onInvalidPlugin });
    }
  }

  config.plugins = plugins;

  return config;
}

/**
 * Apply the include list of plugin names and return the merged plugin list
 *
 * @param {Object} opts Options
 * @param {PluginManager} opts.pluginManager The plugin manager
 * @param {PluginList} opts.orgPlugins The list of plugins configured on the org
 * @param {PluginList} opts.repoIncludeList A list of plugins to merge into the config
 * @param {OnInvalidPluginCallback} [opts.onInvalidPlugin] Function to call when an invalid plugin is encountered
 * @returns {PluginList} The filtered list of plugins
 */
// eslint-disable-next-line max-statements, complexity
export function applyIncludeList({ pluginManager, orgPlugins, repoIncludeList, onInvalidPlugin }) {
  const pluginEqual = {
    literal(x, y) {
      if (typeof x !== 'string') return false;
      return x === y
        || (/** @type {Plugin} */(y).plugin && /** @type {Plugin} */(y).plugin === x);
    },
    obj(x, y) {
      if (typeof x !== 'object') return false;
      return x.plugin === y
        || (/** @type {Plugin} */(y).plugin && /** @type {Plugin} */(y).plugin === x.plugin);
    }
  };

  const plugins = deepClone(orgPlugins);
  for (const pluginToInclude of repoIncludeList) {
    const pluginName = typeof pluginToInclude === 'string' ? pluginToInclude : pluginToInclude.plugin;
    const pluginInstance = pluginManager[pluginName];
    if (!pluginInstance) {
      onInvalidPlugin && onInvalidPlugin(pluginName);
      // eslint-disable-next-line no-continue
      continue;
    }

    const existingPlugin = plugins.find(p => {
      return pluginEqual.literal(pluginToInclude, p)
        || pluginEqual.obj(pluginToInclude, p);
    });

    if (!existingPlugin) {
      // If it's not in the existing list, just add it directly
      plugins.push(pluginToInclude);
    } else if (typeof pluginToInclude === 'object') {
      if (typeof existingPlugin === 'string' || !existingPlugin.config) {
        // If it is in the existing list but only as a string, we can just replace the string with the object.
        // Same story if the existing plugin has no config field set.
        const idx = plugins.indexOf(existingPlugin);
        plugins.splice(idx, 1, pluginToInclude);
      } else {
        // If it is in the existing list as an object, and the plugin to include has config specified, we have to merge
        // the config
        existingPlugin.config = pluginInstance.mergeConfig(existingPlugin.config, pluginToInclude.config);
      }
    }
  }

  return plugins;
}

/**
 * Apply the exclude list of plugin names and return the filtered plugin list
 *
 * @param {Object} opts Options
 * @param {PluginList} opts.orgPlugins The list of plugins configured on the org
 * @param {string[]} opts.repoExcludeList A list of plugin names to exclude
 * @returns {PluginList} The filtered list of plugins
 */
export function applyExcludeList({ orgPlugins, repoExcludeList }) {
  return orgPlugins.filter(plugin => {
    if (typeof plugin === 'string') {
      return !repoExcludeList.includes(plugin);
    } else if (plugin.plugin) {
      return !repoExcludeList.includes(plugin.plugin);
    }

    // Default to leaving things in the plugin list
    return true;
  });
}
