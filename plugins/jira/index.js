/** @type {(url: string, options?: RequestInit) => Promise<Response>} */
import fetch from 'node-fetch';
import BasePlugin from '../base.js';
import Commenter from '../../commenter.js';

const HAS_JIRA_TICKET = /([A-Z]+-[1-9][0-9]*)/g;

export default class JiraPlugin extends BasePlugin {
  constructor() {
    super();
    this.jiraConfig = {
      protocol: process.env.JIRA_PROTOCOL,
      host: process.env.JIRA_HOST,
      username: process.env.JIRA_USERNAME,
      password: process.env.JIRA_PASSWORD
    };
  }

  /**
   * Whether this plugin processes edit actions
   * @public
   * @override
   * @returns {Boolean} Whether this plugin processes edit actions
   */
  get processesEdits() {
    return true;
  }

  /**
   * @typedef {import('@octokit/webhooks').EventPayloads.WebhookPayloadPullRequest} WebhookPayloadPullRequest
   * @typedef {WebhookPayloadPullRequest & { changes: Object }} WebhookPayloadPullRequestWithChanges
   * @typedef {import('probot').Context<WebhookPayloadPullRequestWithChanges>} ProbotContext
   */
  /**
   * Process a PR webhook and perform needed JIRA actions
   *
   * @memberof JiraPlugin
   * @public
   * @override
   * @param {ProbotContext} context webhook context
   * @param {Commenter} commenter Commenter
   */
  async processRequest(context, commenter) { // eslint-disable-line max-statements
    const data = context.payload;
    const isEdit = data.action === 'edited';
    let oldTitle = null;

    if (isEdit) {
      oldTitle = data.changes && data.changes.title && data.changes.title.from;
      if (!oldTitle || oldTitle === data.pull_request.title) {
        // Title hasn't changed, nothing to do
        return;
      }
    }

    const title = data.pull_request.title;
    let ticketIds = this.extractTicketsFromString(title);

    if (ticketIds.length === 0) {
      // No tickets referenced in title, nothing to do
      return;
    }

    if (isEdit && oldTitle) {
      const oldTicketIds = this.extractTicketsFromString(oldTitle);
      ticketIds = ticketIds.filter(t => !oldTicketIds.includes(t));
    }

    if (ticketIds.length === 0) {
      // No tickets referenced in title, nothing to do
      return;
    }

    return this.findTicketsAndPost(commenter, ticketIds);
  }

  /**
   * Find details on the specified list of tickets from Jira and post a comment with links
   *
   * @memberof JiraPlugin
   * @private
   * @param {Commenter} commenter Commenter
   * @param {String[]} ticketIds A list of ticket IDs
   */
  async findTicketsAndPost(commenter, ticketIds) {
    const jql = `id in ('${ticketIds.join("', '")}')`;

    const res = await this.fetch(`${this.jiraConfig.protocol}://${this.jiraConfig.host}/rest/api/2/search`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(this.jiraConfig.username + ':' + this.jiraConfig.password)
          .toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jql,
        startAt: 0,
        fields: ['summary']
      })
    });

    if (!res || !res.ok) {
      throw new Error(
        `Error retrieving Jira ticket info. Status code: ${(res && res.status) || 'unknown'} from Jira.`);
    }

    const body = await res.json();

    if (!body.issues.length) return;

    const ticketList = body.issues.reduce((acc, ticket) => {
      return acc +
        // eslint-disable-next-line max-len
        `\n- [\\[${ticket.key}\\] ${ticket.fields.summary}](${this.jiraConfig.protocol}://${this.jiraConfig.host}/browse/${ticket.key})`;
    }, '');

    // call some API to post the comment on the PR
    const comment = `I found the following Jira ticket(s) referenced in this PR:\n${ticketList}`;
    commenter.addComment(comment, Commenter.priority.Low);
  }

  /**
   * Wrapper of Fetch API
   *
   * @param {string} url URL for request
   * @param {RequestInit} options Request options
   * @returns {Response} Response
   * @private
   */
  fetch(url, options) {
    return fetch(url, options);
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
