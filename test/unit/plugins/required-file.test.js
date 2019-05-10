const assume = require('assume');
const sinon = require('sinon');

const RequiredFilePlugin = require('../../../plugins/required-file');

const sandbox = sinon.createSandbox();
const getContentsStub = sandbox.stub().resolves({ status: 200 });
const getFilesInPullRequestStub = sandbox.stub().resolves([]);
const addCommentStub = sandbox.stub();
const commenter = {
  addComment: addCommentStub,
  comments: null,
  flushToString: null
};

const requiredFilePlugin = new RequiredFilePlugin();

describe('RequiredFilePlugin', () => {
  after(() => {
    sandbox.restore();
  });

  beforeEach(() => {
    sandbox.resetHistory();
  });

  it('is a constructor', () => {
    assume(RequiredFilePlugin).is.a('function');
    assume(RequiredFilePlugin).has.length(0);
    assume(requiredFilePlugin).is.an('object');
  });

  it('does not process edits', function () {
    assume(requiredFilePlugin.processesEdits).is.false();
  });

  describe('.processRequest', () => {
    it('is a function', () => {
      assume(requiredFilePlugin.processRequest).is.an('asyncfunction');
      assume(requiredFilePlugin.processRequest).has.length(3);
    });

    it('bails out if no files list is specified in the plugin config', async function () {
      const checkFileSpy = sandbox.spy(requiredFilePlugin, 'checkFile');
      try {
        // @ts-ignore
        await requiredFilePlugin.processRequest(null, commenter, {});
      } catch (err) {
        assume(err).is.truthy();
        assume(checkFileSpy.called).is.false();
      } finally {
        checkFileSpy.restore();
      }
    });

    it('runs checkFile on all specified files', async function () {
      const checkFileStub = sandbox.stub(requiredFilePlugin, 'checkFile').resolves();
      try {
        await requiredFilePlugin.processRequest(null, commenter, {
          files: [
            'one',
            'two',
            'three'
          ]
        });

        assume(checkFileStub.callCount).equals(3);
      } finally {
        checkFileStub.restore();
      }
    });
  });

  describe('.checkFile', () => {
    const mockContext = {
      github: {
        pulls: {
          listFiles: {
            endpoint: {
              merge: sandbox.stub()
            }
          }
        },
        repos: {
          getContents: getContentsStub
        },
        paginate: getFilesInPullRequestStub
      },
      repo() {
        return {
          owner: 'org',
          repo: 'repo'
        }
      },
      payload: {
        repository: {
          full_name: 'org/repo'
        },
        pull_request: {
          number: 1234
        }
      }
    };

    it('bails out if no file path is passed in', async function () {
      try {
        // @ts-ignore
        await requiredFilePlugin.checkFile(mockContext, commenter, null);
      } catch (err) {
        assume(err).is.truthy();
        assume(err.message).equals('No file path specified for required file.');
      }
    });

    it('bails out if no file path is passed in with the file object', async function () {
      try {
        // @ts-ignore
        await requiredFilePlugin.checkFile(mockContext, commenter, {});
      } catch (err) {
        assume(err).is.truthy();
        assume(err.message).equals('No file path specified for required file.');
      }
    });

    it('bails out if checkIfFileExists returns an error', async function () {
      const mockError = new Error('mock error');
      getContentsStub.rejects(mockError);
      try {
        // @ts-ignore
        await requiredFilePlugin.checkFile(mockContext, commenter, 'file');
      } catch (err) {
        assume(err).equals(mockError);
      }
    });

    it(`bails out if the file doesn't exist in the first place`, async function () {
      getContentsStub.resolves({ status: 404 });
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, 'file');
      assume(getFilesInPullRequestStub.called).is.false();
    });

    it('bails out if getFilesInPullRequest returns an error', async function () {
      getContentsStub.resolves({ status: 200 });
      const mockError = new Error('mock error');
      getFilesInPullRequestStub.rejects(mockError);
      try {
        // @ts-ignore
        await requiredFilePlugin.checkFile(mockContext, commenter, 'file');
      } catch (err) {
        assume(err).equals(mockError);
        assume(addCommentStub.called).is.false();
      }
    });

    it('is a no-op when the required file is included in the PR', async function () {
      getContentsStub.resolves({ status: 200 });
      getFilesInPullRequestStub.resolves([{ filename: 'file' }]);
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, 'file');
      assume(addCommentStub.called).is.false();
    });

    it('adds a comment when a required file is not included in the PR', async function () {
      getContentsStub.resolves({ status: 200 });
      getFilesInPullRequestStub.resolves([{ filename: 'file' }]);
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, 'file2');
      assume(addCommentStub.calledWithMatch('file2')).is.true();
    });

    it(`bails out if the file doesn't exist in the first place and the file is an object`, async function () {
      getContentsStub.resolves({ status: 404 });
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, { path: 'file' });
      assume(getFilesInPullRequestStub.called).is.false();
    });

    it('is a no-op when the required file is included in the PR and the file is an object', async function () {
      getContentsStub.resolves({ status: 200 });
      getFilesInPullRequestStub.resolves([{ filename: 'file' }]);
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, { path: 'file' });
      assume(addCommentStub.called).is.false();
    });

    it('adds a comment when a required file is not included in the PR and the file is an object', async function () {
      getContentsStub.resolves({ status: 200 });
      getFilesInPullRequestStub.resolves([{ filename: 'file' }]);
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, { path: 'file2' });
      assume(addCommentStub.calledWithMatch('file2')).is.true();
    });

    it('adds a custom comment when a required file is not included in the PR and the file is an object', async function () {
      getContentsStub.resolves({ status: 200 });
      getFilesInPullRequestStub.resolves([{ filename: 'file' }]);
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, { path: 'file2', message: 'custom' });
      assume(addCommentStub.calledWithMatch('custom')).is.true();
    });
  });
});
