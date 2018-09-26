const Commenter = require('../../commenter');
const async = require('async');

class RequiredFilePlugin {
  /**
   * RequiredFile plugin - nags when a PR is missing an update to a required file
   *
   * @constructor
   * @public
   * @param {Slay.App} app Slay app
   */
  constructor(app) {
    this.app = app;
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
   * Process a PR webhook and perform needed required file checks
   *
   * @memberof RequiredFilePlugin
   * @public
   * @param {Object} data PR webhook data
   * @param {Object} config Configuration for this plugin
   * @param {String[]} config.files File paths to require in the PR
   * @param {Function} done Continuation callback
   * @returns {Undefined} Nothing of significance
   */
  processRequest(data, config, done) {
    const files = config && config.files;
    if (!files) {
      return done(new Error('Missing `files` field in plugin config'));
    }

    async.each(files, this.checkFile.bind(this, data), done);
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
   * @param {Object} data PR webhook data
   * @param {String|RequiredFile} file The file object, or path to check, relative to the root of the repo
   * @param {Function} done Continuation callback
   * @returns {Undefined} Nothing of significance
   */
  checkFile(data, file, done) {
    const filePath = typeof file === 'string' ? file : (file && file.path);
    if (!filePath) {
      return done(new Error('No file path specified for required file.'));
    }
    const message = file.message ||
      `You're missing a change to ${filePath}, which is a requirement for changes to this repo.`;
    this.app.github.checkIfFileExists(data.repository.full_name, filePath, (checkFileExistsErr, exists) => {
      if (checkFileExistsErr) return done(checkFileExistsErr);

      if (!exists) {
        // File doesn't exist in this repo in the first place, nothing to do
        return done();
      }

      this.app.github.getFilesInPullRequest(data.repository.full_name, data.pull_request.number, (getPRFilesErr, files) => {
        if (getPRFilesErr) return done(getPRFilesErr);

        if (!files.some(f => {
          return f.filename === filePath;
        })) {
          this.app.commenter.addComment(message, Commenter.priority.High);
        }

        return void done();
      });
    });
  }
}

module.exports = function RequiredFilePluginFactory(app) {
  return new RequiredFilePlugin(app);
};
