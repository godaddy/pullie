const assume = require('assume');
const sinon = require('sinon');

const WelcomePlugin = require('../../../plugins/welcome');
const Commenter = require('../../../commenter');

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
            return Promise.resolve({
              data: [{
                pull_request: {
                  number: 1234,
                  user: {
                    login: 'jdoe'
                  },
                  draft: false
                }
              }]
            });
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

  it('does not process edits', function () {
    assume(welcomePlugin.processesEdits).is.false();
  });

  describe('.processRequest', function () {
    it('is a function', function () {
      assume(welcomePlugin.processRequest).is.an('asyncfunction');
      assume(welcomePlugin.processRequest).has.length(2);
    });

    it('will return if no message is defined', async function () {
      await welcomePlugin.processRequest(mockContext, commenter, {});

      assume(addCommentStub.called).is.false();
    });

    it('will add the welcome comment from env file if the user is new to the repo', async function () {
      process.env.WELCOME_MESSAGE = 'Thanks for making a contribution to the project!';

      const instance = new WelcomePlugin();

      await instance.processRequest(mockContext, commenter);

      assume(addCommentStub.called).is.true();
      assume(addCommentStub.getCall(0).args).eql(['Thanks for making a contribution to the project!', Commenter.priority.High]);
    });

    it('will add the welcome comment from custom config if the user is new to the repo', async function () {
      await welcomePlugin.processRequest(mockContext, commenter, { welcomeMessage: 'Welcome to the project!' });

      assume(addCommentStub.called).is.true();
      assume(addCommentStub.getCall(0).args).eql(['Welcome to the project!', Commenter.priority.High]);
    });

    it('will do nothing if the user is already part of the repo', async function () {
      mockContext = {
        ...mockContext,
        github: {
          issues: {
            listForRepo: function () {
              return Promise.resolve({
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
              });
            }
          }
        }
      };

      await welcomePlugin.processRequest(mockContext, commenter, { welcomeMessage: 'hey hey hey!' });

      assume(addCommentStub.called).is.false();
    });
  });
});
