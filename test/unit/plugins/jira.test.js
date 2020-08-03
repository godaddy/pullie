const assume = require('assume');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

describe('JiraPlugin', function () {
  let addCommentStub, commenter, fetchStub, JiraPlugin, jiraPlugin;

  before(function () {
    addCommentStub = sinon.stub();
    commenter = {
      addComment: addCommentStub
    };
    fetchStub = sinon.stub();

    JiraPlugin =  proxyquire('../../../plugins/jira', {
      'node-fetch': fetchStub
    });

    jiraPlugin = new JiraPlugin();
  });

  after(function () {
    sinon.restore();
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
    beforeEach(function () {
      fetchStub.resetHistory();
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

      assume(fetchStub.called).is.false();
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

      assume(fetchStub.called).is.false();
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

      assume(fetchStub.called).is.false();
    });

    it('bails out on error from the Jira request', async function () {
      const mockError = new Error('mock error');
      fetchStub.rejects(mockError);
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
        assume(fetchStub.called).is.true();
      }
    });

    it('bails out on invalid HTTP response from Jira', async function () {
      fetchStub.resolves();
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
        assume(fetchStub.called).is.true();
      }
    });

    it('bails out on invalid HTTP status code from Jira', async function () {
      fetchStub.resolves({
        status: 404,
        ok: false
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
        assume(fetchStub.called).is.true();
      }
    });

    it('correctly parses 1 ticket from a PR and builds a comment with its title', async function () {
      fetchStub.resolves({
        status: 200,
        ok: true,
        async json() {
          return {
            issues: [
              {
                key: 'AB-1234',
                fields: {
                  summary: 'Mock ticket title'
                }
              }
            ]
          };
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
      assume(fetchStub.calledWithMatch(
        // @ts-ignore
        sinon.match.string,
        sinon.match({
          body: sinon.match(strBody => {
            const body = JSON.parse(strBody);
            return body.jql && body.jql.includes('AB-1234') && !body.jql.includes(',');
          })
        }))).is.true();
      assume(addCommentStub.calledWithMatch('\\[AB-1234\\] Mock ticket title')).is.true();
    });

    it('correctly parses 2 tickets from a PR and builds a comment with its title', async function () {
      fetchStub.resolves({
        status: 200,
        ok: true,
        async json() {
          return {
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
          };
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

      assume(fetchStub.calledWithMatch(
        // @ts-ignore
        sinon.match.string,
        sinon.match({
          body: sinon.match(strBody => {
            const body = JSON.parse(strBody);
            return body.jql && body.jql.includes('AB-1234') && body.jql.includes('FOO-5678') && body.jql.includes(',');
          })
        }))).is.true();
      assume(addCommentStub.calledWithMatch(sinon.match('\\[AB-1234\\] Mock ticket 1 title')
        .and(sinon.match('\\[FOO-5678\\] Mock ticket 2 title')))).is.true();
    });

    it('correctly parses 2 tickets without brackets from a PR and builds a comment with its title', async function () {
      fetchStub.resolves({
        status: 200,
        ok: true,
        async json() {
          return {
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
          };
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

      assume(fetchStub.calledWithMatch(
        // @ts-ignore
        sinon.match.string,
        sinon.match({
          body: sinon.match(strBody => {
            const body = JSON.parse(strBody);
            return body.jql && body.jql.includes('AB-1234') && body.jql.includes('FOO-5678') && body.jql.includes(',');
          })
        }))).is.true();
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
      fetchStub.resolves({
        status: 200,
        ok: true,
        async json() {
          return {
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
          };
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

      assume(fetchStub.calledWithMatch(
        // @ts-ignore
        sinon.match.string,
        sinon.match({
          body: sinon.match(strBody => {
            const body = JSON.parse(strBody);
            return body.jql && body.jql.includes('AB-1234') && body.jql.includes('FOO-5678') && body.jql.includes(',');
          })
        }))).is.true();
      assume(addCommentStub.calledWithMatch(sinon.match('\\[AB-1234\\] Mock ticket 1 title')
        .and(sinon.match('\\[FOO-5678\\] Mock ticket 2 title')))).is.true();
    });

    it('does not post when no Jira tickets are actually found in Jira query', async function () {
      fetchStub.resolves({
        status: 200,
        ok: true,
        async json() {
          return {
            issues: []
          };
        }
      });
      await jiraPlugin.processRequest({
        payload: {
          action: 'created',
          // @ts-ignore
          pull_request: {
            title: '[AB-1234][AB-3456] title with 2 Jira tickets'
          }
        }
      }, commenter);

      assume(fetchStub.calledWithMatch(
        // @ts-ignore
        sinon.match.string,
        sinon.match({
          body: sinon.match(strBody => {
            const body = JSON.parse(strBody);
            return body.jql && body.jql.includes('AB-1234') && body.jql.includes('AB-3456') && body.jql.includes(',');
          })
        }))).is.true();
      assume(addCommentStub.called).is.false();
    });
  });
});
