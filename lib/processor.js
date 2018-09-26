const async = require('async');

/**
 * Processor for incoming webhook requests
 *
 * @constructor
 * @public
 * @param {Slay.App} app Slay app
 * @param {Object} opts Options
 */
class Processor {
  constructor(app) {
    this.app = app;
  }

  /**
   * Method to process an incoming webhook request
   *
   * @memberof Processor
   * @public
   * @param {HTTPRequest} req Request object from Slay
   * @param {Function} done Continuation callback
   * @returns {Undefined} Nothing of significance
   */
  processRequest(req, done) {
    const eventType = req.headers['x-github-event'];
    if (eventType !== 'pull_request') {
      // Not a PR, nothing to do
      return done();
    }

    const requestId = req.headers['x-github-delivery'];

    const data = req.body;

    if (data.action !== 'opened' && data.action !== 'edited') {
      // Not a PR open or edit action, nothing to do
      return done();
    }

    this.app.log.info('Processing PR', { repository: data.repository.full_name, number: data.number, requestId });

    this.getRepoConfig(data.repository, (getRepoConfigErr, config) => {
      if (getRepoConfigErr) {
        this.app.log.error('Error getting repository config', { error: getRepoConfigErr, requestId });
        return done(getRepoConfigErr);
      }

      if (!config || !Array.isArray(config.plugins) || config.plugins.length === 0) {
        // No config specified for this repo, nothing to do
        this.app.log.info('No config specified for repo, nothing to do',
          { repository: data.repository.full_name, requestId });
        return done();
      }

      async.each(config.plugins, (pluginConfig, next) => {
        const pluginName = typeof pluginConfig === 'string' ? pluginConfig : pluginConfig.plugin;
        const plugin = this.app.plugins[pluginName];
        if (!plugin) {
          this.app.log.error('Invalid plugin specified in config',
            { repository: data.repository.full_name, plugin: pluginName, requestId });
          return next(new Error(`Invalid config: no plugin named '${pluginName}' exists.`));
        }

        if (data.action === 'edited' && !plugin.processesEdits) {
          return next();
        }

        plugin.processRequest(data, pluginConfig.config || {}, pluginProcessRequestErr => {
          if (pluginProcessRequestErr) {
            this.app.log.error('Error running plugin',
              { error: pluginProcessRequestErr, repository: data.repository.full_name, plugin: pluginName, requestId });
            return next(pluginProcessRequestErr);
          }
          next();
        });
      }, eachErr => {
        if (eachErr) return done(eachErr);

        this.app.log.info('Finished processing PR',
          { repository: data.repository.full_name, number: data.number, requestId });

        const comment = this.app.commenter.flushToString();
        if (comment) {
          this.app.github.createIssueComment(data.repository.full_name, data.pull_request.number, comment, done);
        } else {
          return done();
        }
      });
    });
  }

  /**
   * Get pullie config for the specified repository
   *
   * @memberof Processor
   * @private
   * @param {Object} repoInfo Information about the target repo retrieved from the webhook payload
   * @param {Function} done Continuation callback
   */
  getRepoConfig(repoInfo, done) {
    this.app.github.getFileContents(repoInfo.full_name, {
      path: '.pullierc'
    }, (getRcErr, pkg) => {
      if (getRcErr) {
        if (getRcErr.statusCode === 404) {
          return done();
        }
        return done(getRcErr);
      }

      this.app.github.parsePackageJson(pkg, done);
    });
  }
}

module.exports = Processor;
