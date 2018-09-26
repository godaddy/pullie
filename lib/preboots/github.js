const GitHubClient = require('../github');

function GitHubPreboot(app, opts, callback) {
  const config = app.config.get('github');
  app.github = new GitHubClient(config);
  callback();
}

module.exports = GitHubPreboot;
