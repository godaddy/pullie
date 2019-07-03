const assume = require('assume');
const sinon = require('sinon');

const WIPPlugin = require('../../../plugins/wip');

const sandbox = sinon.createSandbox();
const updateStub = sandbox.stub().resolves();
const mockContext = {
  repo: sinon.stub().callsFake(extra => ({ owner: 'org', repo: 'repo', ...extra })),
  github: {
    pulls: {
      update: updateStub
    }
  }
};

const wipPlugin = new WIPPlugin();

describe('WIPPlugin', function () {
  after(function () {
    sandbox.restore();
  });

  it('is a constructor', function () {
    assume(WIPPlugin).is.a('function');
    assume(WIPPlugin).has.length(0);
    assume(wipPlugin).is.an('object');
  });

  it('processes edits', function () {
    assume(wipPlugin.processesEdits).is.true();
  });

  describe('.processRequest', function () {
    it('is a function', function () {
      assume(wipPlugin.processRequest).is.an('asyncfunction');
      assume(wipPlugin.processRequest).has.length(1);
    });

    it(`bails out if the PR action is an edit and the title hasn't changed`, async function () {
      await wipPlugin.processRequest({
        ...mockContext,
        payload: {
          action: 'edited',
          changes: {
            title: {
              from: 'title'
            }
          },
          pull_request: {
            number: 123,
            title: 'title'
          }
        }
      });

      assume(updateStub.called).is.false();
    });

    it(`bails out if the PR action is an edit and the title isn't listed as changed`, async function () {
      await wipPlugin.processRequest({
        ...mockContext,
        payload: {
          action: 'edited',
          changes: {
            body: {
              from: 'body'
            }
          },
          pull_request: {
            number: 123,
            title: 'title'
          }
        }
      });

      assume(updateStub.called).is.false();
    });

    it(`doesn't do anything if the title does not contain WIP and it is not an edit`, async function () {
      await wipPlugin.processRequest({
        ...mockContext,
        payload: {
          action: 'created',
          pull_request: {
            number: 123,
            title: 'Something else'
          }
        }
      });

      assume(updateStub.called).is.false();
    });

    it(`doesn't do anything if the title does not contain WIP during an edit but it didn't before either`, async function () {
      await wipPlugin.processRequest({
        ...mockContext,
        payload: {
          action: 'edited',
          changes: {
            title: {
              from: 'Something'
            }
          },
          pull_request: {
            number: 123,
            title: 'Something else'
          }
        }
      });

      assume(updateStub.called).is.false();
    });

    it(`doesn't do anything if the title contains WIP but the PR was already a draft`, async function () {
      await wipPlugin.processRequest({
        ...mockContext,
        payload: {
          action: 'created',
          pull_request: {
            number: 123,
            title: 'WIP Something else',
            draft: true
          }
        }
      });

      assume(updateStub.called).is.false();
    });

    it(`doesn't do anything if the WIP is removed from the title during an edit but the PR is already not a draft`,
      async function () {
        await wipPlugin.processRequest({
          ...mockContext,
          payload: {
            action: 'edited',
            changes: {
              title: {
                from: 'WIP Something else'
              }
            },
            pull_request: {
              number: 123,
              title: 'Something else',
              draft: false
            }
          }
        });

        assume(updateStub.called).is.false();
      });

    it(`makes the PR a draft when the title contains WIP and it wasn't already a draft`, async function () {
      await wipPlugin.processRequest({
        ...mockContext,
        payload: {
          action: 'created',
          pull_request: {
            number: 123,
            title: 'WIP Something else',
            draft: false
          }
        }
      });

      assume(updateStub.calledWithMatch({
        owner: 'org',
        repo: 'repo',
        pull_number: 123,
        draft: true
      })).is.true();
    });

    it(`makes the PR ready for review (i.e. not a draft) when WIP is removed from the title during an edit`, async function () {
      await wipPlugin.processRequest({
        ...mockContext,
        payload: {
          action: 'edited',
          changes: {
            title: {
              from: 'WIP Something else'
            }
          },
          pull_request: {
            number: 123,
            title: 'Something else',
            draft: true
          }
        }
      });

      assume(updateStub.calledWithMatch({
        owner: 'org',
        repo: 'repo',
        pull_number: 123,
        draft: false
      })).is.true();
    });
  });
});
