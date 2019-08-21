const assume = require('assume');
const sinon = require('sinon');
const request = require('request-promise-native');

const JiraPlugin = require('../../../plugins/jira');

const sandbox = sinon.createSandbox();
const addCommentStub = sandbox.stub();
const commenter = {
  addComment: addCommentStub
};

const jiraPlugin = new JiraPlugin();

describe('JiraPlugin', function () {
  after(function () {
    sandbox.restore();
  });

  it('is a constructor', function () {
    assume(JiraPlugin).is.a('function');
    assume(JiraPlugin).has.length(0);
    assume(jiraPlugin).is.an('object');
  });

  it('processes edits', function () {
    assume(jiraPlugin.processesEdits).is.true();
  });

  describe('.processRequest', function () {
    const requestPostStub = sandbox.stub(request, 'post').resolves();
    beforeEach(function () {
      requestPostStub.resetHistory();
      addCommentStub.resetHistory();
    });

    it('is a function', function () {
      assume(jiraPlugin.processRequest).is.an('asyncfunction');
      assume(jiraPlugin.processRequest).has.length(2);
    });

    it(`bails out if the PR action is an edit and the title hasn't changed`, async function () {
      await jiraPlugin.processRequest({
        payload: {
          action: 'edited',
          changes: {
            title: {
              from: 'title'
            }
          },
          // @ts-ignore
          pull_request: {
            title: 'title'
          }
        }
      }, commenter);

      assume(requestPostStub.called).is.false();
    });

    it(`bails out if the PR action is an edit and the title isn't listed as changed`, async function () {
      await jiraPlugin.processRequest({
        payload: {
          action: 'edited',
          changes: {
            body: {
              from: 'body'
            }
          },
          // @ts-ignore
          pull_request: {
            title: 'title'
          }
        }
      }, commenter);

      assume(requestPostStub.called).is.false();
    });

    it('bails out if there are no ticket IDs in the PR title', async function () {
      await jiraPlugin.processRequest({
        payload: {
          action: 'created',
          // @ts-ignore
          pull_request: {
            title: 'title with no Jira tickets'
          }
        }
      }, commenter);

      assume(requestPostStub.called).is.false();
    });

    it('bails out on error from the Jira request', async function () {
      const mockError = new Error('mock error');
      requestPostStub.rejects(mockError);
      try {
        await jiraPlugin.processRequest({
          payload: {
            action: 'created',
            // @ts-ignore
            pull_request: {
              title: '[AB-1234] title with 1 Jira ticket'
            }
          }
        }, commenter);
      } catch (err) {
        assume(err).is.truthy();
        assume(err).equals(mockError);
        assume(requestPostStub.called).is.true();
      }
    });

    it('bails out on invalid HTTP response from Jira', async function () {
      requestPostStub.resolves();
      try {
        await jiraPlugin.processRequest({
          payload: {
            action: 'created',
            // @ts-ignore
            pull_request: {
              title: '[AB-1234] title with 1 Jira ticket'
            }
          }
        }, commenter);
      } catch (err) {
        assume(err).is.truthy();
        assume(err.message).contains('Status code: unknown');
        assume(requestPostStub.called).is.true();
      }
    });

    it('bails out on invalid HTTP status code from Jira', async function () {
      requestPostStub.resolves({
        statusCode: 404
      });
      try {
        await jiraPlugin.processRequest({
          payload: {
            action: 'created',
            // @ts-ignore
            pull_request: {
              title: '[AB-1234] title with 1 Jira ticket'
            }
          }
        }, commenter);
      } catch (err) {
        assume(err).is.truthy();
        assume(err.message).contains('Status code: 404');
        assume(requestPostStub.called).is.true();
      }
    });

    it('correctly parses 1 ticket from a PR and builds a comment with its title', async function () {
      requestPostStub.resolves({
        statusCode: 200,
        body: {
          issues: [
            {
              key: 'AB-1234',
              fields: {
                summary: 'Mock ticket title'
              }
            }
          ]
        }
      });
      await jiraPlugin.processRequest({
        payload: {
          action: 'created',
          // @ts-ignore
          pull_request: {
            title: '[AB-1234] title with 1 Jira ticket'
          }
        }
      }, commenter);

      // @ts-ignore
      assume(requestPostStub.calledWithMatch(
        // @ts-ignore
        sinon.match.string,
        sinon.match.hasNested('body.jql', sinon.match('AB-1234').and(sinon.match((value) => {
          return !~value.indexOf(',');
        }))))).is.true();
      assume(addCommentStub.calledWithMatch('\\[AB-1234\\] Mock ticket title')).is.true();
    });

    it('correctly parses 2 tickets from a PR and builds a comment with its title', async function () {
      requestPostStub.resolves({
        statusCode: 200,
        body: {
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
        }
      });
      await jiraPlugin.processRequest({
        payload: {
          action: 'created',
          // @ts-ignore
          pull_request: {
            title: '[AB-1234] title with 2 Jira tickets [FOO-5678]'
          }
        }
      }, commenter);

      assume(requestPostStub.calledWithMatch(
        // @ts-ignore
        sinon.match.string,
        sinon.match.hasNested('body.jql', sinon.match('AB-1234')
          .and(sinon.match('FOO-5678'))
          .and(sinon.match(','))))).is.true();
      assume(addCommentStub.calledWithMatch(sinon.match('\\[AB-1234\\] Mock ticket 1 title')
        .and(sinon.match('\\[FOO-5678\\] Mock ticket 2 title')))).is.true();
    });

    it('correctly parses 2 tickets without brackets from a PR and builds a comment with its title', async function () {
      requestPostStub.resolves({
        statusCode: 200,
        body: {
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
        }
      });
      await jiraPlugin.processRequest({
        payload: {
          action: 'created',
          // @ts-ignore
          pull_request: {
            title: 'AB-1234 title with 2 Jira tickets FOO-5678'
          }
        }
      }, commenter);

      assume(requestPostStub.calledWithMatch(
        // @ts-ignore
        sinon.match.string,
        sinon.match.hasNested('body.jql', sinon.match('AB-1234')
          .and(sinon.match('FOO-5678'))
          .and(sinon.match(','))))).is.true();
      assume(addCommentStub.calledWithMatch(sinon.match('\\[AB-1234\\] Mock ticket 1 title')
        .and(sinon.match('\\[FOO-5678\\] Mock ticket 2 title')))).is.true();
    });

    it(`bails if action is edit and ticket list hasn't changed`, async function () {
      await jiraPlugin.processRequest({
        payload: {
          action: 'edited',
          // @ts-ignore
          pull_request: {
            title: '[AB-1234] title with 2 Jira tickets [FOO-5678]'
          },
          changes: {
            title: {
              from: '[AB-1234] title that has changed with 2 Jira tickets [FOO-5678]'
            }
          }
        }
      }, commenter);

      assume(addCommentStub.called).is.false();
    });

    it('correctly parses 2 tickets from a PR edit and builds a comment with its title', async function () {
      requestPostStub.resolves({
        statusCode: 200,
        body: {
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
        }
      });
      await jiraPlugin.processRequest({
        payload: {
          action: 'edited',
          // @ts-ignore
          pull_request: {
            title: '[AB-1234][AB-3456] title with 2 Jira tickets [FOO-5678][FOO-7980]'
          },
          changes: {
            title: {
              from: '[AB-3456] title with 2 Jira tickets [FOO-7980]'
            }
          }
        }
      }, commenter);

      assume(requestPostStub.calledWithMatch(
        // @ts-ignore
        sinon.match.string,
        sinon.match.hasNested('body.jql', sinon.match('AB-1234')
          .and(sinon.match('FOO-5678'))
          .and(sinon.match(','))))).is.true();
      assume(addCommentStub.calledWithMatch(sinon.match('\\[AB-1234\\] Mock ticket 1 title')
        .and(sinon.match('\\[FOO-5678\\] Mock ticket 2 title')))).is.true();
    });
  });
});
