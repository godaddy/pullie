const request = require('request');
const Commenter = require('../../commenter');

const HAS_JIRA_TICKET = /([A-Z]+-[1-9][0-9]*)/g;

class JiraPlugin {
  /**
   * JIRA plugin - uses PR title to link related JIRA ticket(s)
   *
   * @constructor
   * @public
   * @param {Slay.App} app Slay app
   */
  constructor(app) {
    this.app = app;
    this.jiraConfig = app.config.get('jira');
  }

  /**
   * Whether this plugin processes edit actions
   * @public
   * @returns {Boolean} Whether this plugin processes edit actions
   */
  get processesEdits() {
    return true;
  }

  /**
   * Process a PR webhook and perform needed JIRA actions
   *
   * @memberof JiraPlugin
   * @public
   * @param {Object} data PR webhook data
   * @param {Object} config Configuration for plugin
   * @param {Object} apis A set of APIs needed to process the request
   * @param {Commenter} apis.commenter Commenter object for aggregating comments to post
   * @param {GitHubClient} apis.github A GitHubClient instance for this request
   * @param {Function} done Continuation callback
   * @returns {Undefined} Nothing of significance
   */
  processRequest(data, config, apis, done) { // eslint-disable-line max-statements
    const isEdit = data.action === 'edited';
    let oldTitle = null;

    if (isEdit) {
      oldTitle = data.changes && data.changes.title && data.changes.title.from;
      if (!oldTitle || oldTitle === data.pull_request.title) {
        // Title hasn't changed, nothing to do
        return void done();
      }
    }

    const title = data.pull_request.title;
    let ticketIds = this.extractTicketsFromString(title);

    if (ticketIds.length === 0) {
      // No tickets referenced in title, nothing to do
      return void done();
    }

    if (isEdit && oldTitle) {
      const oldTicketIds = this.extractTicketsFromString(oldTitle);
      ticketIds = ticketIds.filter(t => !oldTicketIds.includes(t));
    }

    if (ticketIds.length === 0) {
      // No tickets referenced in title, nothing to do
      return void done();
    }

    this.findTicketsAndPost(ticketIds, apis.commenter, done);
  }

  /**
   * Find details on the specified list of tickets from Jira and post a comment with links
   *
   * @memberof JiraPlugin
   * @private
   * @param {String[]} ticketIds A list of ticket IDs
   * @param {Commenter} commenter Commenter object for aggregating comments to post
   * @param {Function} done Continuation callback
   */
  findTicketsAndPost(ticketIds, commenter, done) {
    const jql = `id in ('${ticketIds.join("', '")}')`;

    request.post(`${this.jiraConfig.protocol}://${this.jiraConfig.host}/rest/api/2/search`, {
      json: true,
      headers: {
        Accept: 'application/json'
      },
      auth: {
        username: this.jiraConfig.username,
        password: this.jiraConfig.password
      },
      body: {
        jql,
        startAt: 0,
        fields: ['summary']
      }
    }, (err, res, body) => {
      if (err) return void done(err);
      if (!res || res.statusCode < 200 || res.statusCode > 299) return void done(
        new Error(`Error retrieving Jira ticket info. Status code: ${(res && res.statusCode) || 'unknown'} from Jira.`));

      const ticketList = body.issues.reduce((acc, ticket) => {
        return acc +
          // eslint-disable-next-line max-len
          `\n- [\\[${ticket.key}\\] ${ticket.fields.summary}](${this.jiraConfig.protocol}://${this.jiraConfig.host}/browse/${ticket.key})`;
      }, '');

      // call some API to post the comment on the PR
      const comment = `I found the following Jira ticket(s) referenced in this PR:\n${ticketList}`;
      commenter.addComment(comment, Commenter.priority.Low);
      done();
    });
  }

  /**
   * Extract Jira ticket IDs from the specified string
   *
   * @memberof JiraPlugin
   * @private
   * @param {String} str The string from which to extract ticket IDs
   * @returns {String[]} A list of ticket IDs that were extracted
   */
  extractTicketsFromString(str) {
    let match;
    const ticketIds = [];
    // eslint-disable-next-line no-cond-assign
    while ((match = HAS_JIRA_TICKET.exec(str)) !== null) {
      ticketIds.push(match[1]);
    }

    return ticketIds;
  }
}

module.exports = function JiraPluginFactory(app) {
  return new JiraPlugin(app);
};
