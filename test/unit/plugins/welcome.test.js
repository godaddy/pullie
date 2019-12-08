const assume = require('assume');
const sinon = require('sinon');

const WelcomePlugin = require('../../../plugins/welcome');

const sandbox = sinon.createSandbox();
const addCommentStub = sandbox.stub();
const commenter = {
  addComment: addCommentStub
};

const welcomePlugin = new WelcomePlugin();

describe('WelcomePlugin', function () {
  after(function () {
    sandbox.restore();
  });

  let mockContext;

  beforeEach(function () {
    addCommentStub.reset();

    mockContext = {
      github: {
        issues: {
          listForRepo: function () {
            return {
              data: [{
                pull_request: {
                  number: 1234,
                  user: {
                    login: 'jdoe'
                  },
                  draft: false
                }
              }]
            };
          }
        }
      },
      repo() {
        return {
          owner: 'org',
          repo: 'repo'
        };
      },
      payload: {
        pull_request: {
          number: 1234,
          user: {
            login: 'jdoe'
          },
          draft: false
        }
      }
    };
  });

  it('is a constructor', function () {
    assume(WelcomePlugin).is.a('function');
    assume(WelcomePlugin).has.length(0);
    assume(welcomePlugin).is.an('object');
  });

  it('processes edits', function () {
    assume(welcomePlugin.processesEdits).is.false();
  });

  describe('.processRequest', function () {
    it('is a function', function () {
      assume(welcomePlugin.processRequest).is.an('asyncfunction');
      assume(welcomePlugin.processRequest).has.length(2);
    });

    it('will add the default welcome comment if the user is new to the repo', async function () {
      await welcomePlugin.processRequest(mockContext, commenter);

      assume(addCommentStub.called).is.true();
      assume(addCommentStub.getCall(0).args).eql(['Thanks for making a contribution to the project!', 0]);
    });

    it('will add a custom welcome comment if the user is new to the repo', async function () {
      process.env.WELCOME_MESSAGE = 'Howdy partner, thanks for joining the fun!';

      await welcomePlugin.processRequest(mockContext, commenter);

      assume(addCommentStub.called).is.true();
      assume(addCommentStub.getCall(0).args).eql(['Howdy partner, thanks for joining the fun!', 0]);
    });

    it('will do nothing if the user is already part of the repo', async function () {
      mockContext = {
        ...mockContext,
        github: {
          issues: {
            listForRepo: function () {
              return {
                data: [{
                  pull_request: {
                    number: 1234,
                    user: {
                      login: 'jdoe'
                    },
                    draft: false
                  }
                },
                {
                  pull_request: {
                    number: 5678,
                    user: {
                      login: 'jdoe'
                    },
                    draft: false
                  }
                }]
              };
            }
          }
        }
      };

      await welcomePlugin.processRequest(mockContext, commenter);

      assume(addCommentStub.called).is.false();
    });
  });
});
