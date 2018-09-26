class PluginManager {
  constructor(app) {
    this.jira = require('./jira')(app);
    this.requiredFile = require('./required-file')(app);
    this.reviewers = require('./reviewers')(app);
  }
}

module.exports = PluginManager;
