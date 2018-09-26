const assume = require('assume');
const sinon = require('sinon');
const request = require('request');

assume.use(require('assume-sinon'));

const getJiraPlugin = require('../../../lib/plugins/jira');

const sandbox = sinon.createSandbox();
const addCommentStub = sandbox.stub();
const mockApp = {
  config: {
    get: sandbox.stub().returns({
      username: 'username',
      password: 'password'
    })
  },
  commenter: {
    addComment: addCommentStub
  }
};

const jiraPlugin = getJiraPlugin(mockApp);

describe('JiraPlugin', () => {
  after(() => {
    sandbox.restore();
  });

  it('is a generator function', () => {
    assume(getJiraPlugin).is.a('function');
    assume(getJiraPlugin).has.length(1);
    assume(jiraPlugin).is.an('object');
  });

  describe('.processRequest', () => {
    const requestPostStub = sandbox.stub(request, 'post').callsArgAsync(2);
    beforeEach(() => {
      requestPostStub.resetHistory();
      addCommentStub.resetHistory();
    });

    it('is a function', () => {
      assume(jiraPlugin.processRequest).is.a('function');
      assume(jiraPlugin.processRequest).has.length(3);
    });

    it(`bails out if the PR action is an edit and the title hasn't changed`, (done) => {
      jiraPlugin.processRequest({
        action: 'edited',
        changes: {
          title: {
            from: 'title'
          }
        },
        pull_request: {
          title: 'title'
        }
      }, null, (err) => {
        assume(err).is.falsey();
        assume(requestPostStub).has.not.been.called();
        done();
      });
    });

    it(`bails out if the PR action is an edit and the title isn't listed as changed`, (done) => {
      jiraPlugin.processRequest({
        action: 'edited',
        changes: {
          body: {
            from: 'body'
          }
        },
        pull_request: {
          title: 'title'
        }
      }, null, (err) => {
        assume(err).is.falsey();
        assume(requestPostStub).has.not.been.called();
        done();
      });
    });

    it('bails out if there are no ticket IDs in the PR title', (done) => {
      jiraPlugin.processRequest({
        action: 'created',
        pull_request: {
          title: 'title with no Jira tickets'
        }
      }, null, (err) => {
        assume(err).is.falsey();
        assume(requestPostStub).has.not.been.called();
        done();
      });
    });

    it('bails out on error from the Jira request', (done) => {
      const mockError = new Error('mock error');
      requestPostStub.callsArgWithAsync(2, mockError);
      jiraPlugin.processRequest({
        action: 'created',
        pull_request: {
          title: '[AB-1234] title with 1 Jira ticket'
        }
      }, null, (err) => {
        assume(err).is.truthy();
        assume(err).equals(mockError);
        assume(requestPostStub).has.been.called();
        done();
      });
    });

    it('bails out on invalid HTTP response from Jira', (done) => {
      requestPostStub.callsArgWithAsync(2, null, null);
      jiraPlugin.processRequest({
        action: 'created',
        pull_request: {
          title: '[AB-1234] title with 1 Jira ticket'
        }
      }, null, (err) => {
        assume(err).is.truthy();
        assume(err.message).contains('Status code: unknown');
        assume(requestPostStub).has.been.called();
        done();
      });
    });

    it('bails out on invalid HTTP status code from Jira', (done) => {
      requestPostStub.callsArgWithAsync(2, null, {
        statusCode: 404
      });
      jiraPlugin.processRequest({
        action: 'created',
        pull_request: {
          title: '[AB-1234] title with 1 Jira ticket'
        }
      }, null, (err) => {
        assume(err).is.truthy();
        assume(err.message).contains('Status code: 404');
        assume(requestPostStub).has.been.called();
        done();
      });
    });

    it('correctly parses 1 ticket from a PR and builds a comment with its title', (done) => {
      requestPostStub.callsArgWithAsync(2, null, {
        statusCode: 200
      }, {
        issues: [
          {
            key: 'AB-1234',
            fields: {
              summary: 'Mock ticket title'
            }
          }
        ]
      });
      jiraPlugin.processRequest({
        action: 'created',
        pull_request: {
          title: '[AB-1234] title with 1 Jira ticket'
        }
      }, null, (err) => {
        assume(err).is.falsey();
        assume(requestPostStub).has.been.calledWithMatch(
          sinon.match.string,
          sinon.match.hasNested('body.jql', sinon.match('AB-1234').and((value) => { // eslint-disable-line max-nested-callbacks
            return !~value.indexOf(',');
          })));
        assume(addCommentStub).has.been.calledWithMatch('\\[AB-1234\\] Mock ticket title');
        done();
      });
    });

    it('correctly parses 2 tickets from a PR and builds a comment with its title', (done) => {
      requestPostStub.callsArgWithAsync(2, null, {
        statusCode: 200
      }, {
        issues: [
          {
            key: 'AB-1234',
            fields: {
              summary: 'Mock ticket 1 title'
            }
          },
          {
            key: 'FOO-5678',
            fields: {
              summary: 'Mock ticket 2 title'
            }
          }
        ]
      });
      jiraPlugin.processRequest({
        action: 'created',
        pull_request: {
          title: '[AB-1234] title with 2 Jira tickets [FOO-5678]'
        }
      }, null, (err) => {
        assume(err).is.falsey();
        assume(requestPostStub).has.been.calledWithMatch(
          sinon.match.string,
          sinon.match.hasNested('body.jql', sinon.match('AB-1234')
            .and(sinon.match('FOO-5678'))
            .and(sinon.match(','))));
        assume(addCommentStub).has.been.calledWithMatch(sinon.match('\\[AB-1234\\] Mock ticket 1 title')
          .and(sinon.match('\\[FOO-5678\\] Mock ticket 2 title')));
        done();
      });
    });

    it('correctly parses 2 tickets without brackets from a PR and builds a comment with its title', (done) => {
      requestPostStub.callsArgWithAsync(2, null, {
        statusCode: 200
      }, {
        issues: [
          {
            key: 'AB-1234',
            fields: {
              summary: 'Mock ticket 1 title'
            }
          },
          {
            key: 'FOO-5678',
            fields: {
              summary: 'Mock ticket 2 title'
            }
          }
        ]
      });
      jiraPlugin.processRequest({
        action: 'created',
        pull_request: {
          title: 'AB-1234 title with 2 Jira tickets FOO-5678'
        }
      }, null, (err) => {
        assume(err).is.falsey();
        assume(requestPostStub).has.been.calledWithMatch(
          sinon.match.string,
          sinon.match.hasNested('body.jql', sinon.match('AB-1234')
            .and(sinon.match('FOO-5678'))
            .and(sinon.match(','))));
        assume(addCommentStub).has.been.calledWithMatch(sinon.match('\\[AB-1234\\] Mock ticket 1 title')
          .and(sinon.match('\\[FOO-5678\\] Mock ticket 2 title')));
        done();
      });
    });

    it(`bails if action is edit and ticket list hasn't changed`, (done) => {
      jiraPlugin.processRequest({
        action: 'edited',
        pull_request: {
          title: '[AB-1234] title with 2 Jira tickets [FOO-5678]'
        },
        changes: {
          title: {
            from: '[AB-1234] title that has changed with 2 Jira tickets [FOO-5678]'
          }
        }
      }, null, (err) => {
        assume(err).is.falsey();
        assume(addCommentStub).has.not.been.called();
        done();
      });
    });

    it('correctly parses 2 tickets from a PR edit and builds a comment with its title', (done) => {
      requestPostStub.callsArgWithAsync(2, null, {
        statusCode: 200
      }, {
        issues: [
          {
            key: 'AB-1234',
            fields: {
              summary: 'Mock ticket 1 title'
            }
          },
          {
            key: 'FOO-5678',
            fields: {
              summary: 'Mock ticket 2 title'
            }
          }
        ]
      });
      jiraPlugin.processRequest({
        action: 'edited',
        pull_request: {
          title: '[AB-1234][AB-3456] title with 2 Jira tickets [FOO-5678][FOO-7980]'
        },
        changes: {
          title: {
            from: '[AB-3456] title with 2 Jira tickets [FOO-7980]'
          }
        }
      }, null, (err) => {
        assume(err).is.falsey();
        assume(requestPostStub).has.been.calledWithMatch(
          sinon.match.string,
          sinon.match.hasNested('body.jql', sinon.match('AB-1234')
            .and(sinon.match('FOO-5678'))
            .and(sinon.match(','))));
        assume(addCommentStub).has.been.calledWithMatch(sinon.match('\\[AB-1234\\] Mock ticket 1 title')
          .and(sinon.match('\\[FOO-5678\\] Mock ticket 2 title')));
        done();
      });
    });
  });
});
