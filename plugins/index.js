class PluginManager {
  constructor() {
    this.jira = new (require('./jira'))();
    this.requiredFile = new (require('./required-file'))();
    this.reviewers = new (require('./reviewers'))();
    this.wip = new (require('./wip'))();
  }
}

module.exports = PluginManager;
