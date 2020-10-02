const assume = require('assume');
const sinon = require('sinon');

const RequiredFilePlugin = require('../../../plugins/required-file');

const sandbox = sinon.createSandbox();
let getContentStub;
let getFilesInPullRequestStub;
let addCommentStub;
let commenter;

const requiredFilePlugin = new RequiredFilePlugin();

describe('RequiredFilePlugin', function () {
  afterEach(function () {
    sandbox.restore();
  });

  beforeEach(function () {
    getContentStub = sandbox.stub().resolves({ status: 200 });
    getFilesInPullRequestStub = sandbox.stub().resolves([]);
    addCommentStub = sandbox.stub();
    commenter = {
      addComment: addCommentStub,
      comments: null,
      flushToString: null
    };
  });

  it('is a constructor', function () {
    assume(RequiredFilePlugin).is.a('function');
    assume(RequiredFilePlugin).has.length(0);
    assume(requiredFilePlugin).is.an('object');
  });

  it('does not process edits', function () {
    assume(requiredFilePlugin.processesEdits).is.false();
  });

  describe('.mergeConfig', function () {
    it('explicitly replaces the base `files` array', function () {
      const baseConfig = {
        files: ['one', 'two', 'three'],
        foo: 'bar',
        baz: 'blah'
      };
      const overrideConfig = {
        files: ['four', 'five', 'six'],
        foo: 'rab',
        gah: 'meh'
      };
      assume(requiredFilePlugin.mergeConfig(baseConfig, overrideConfig)).deep.equals({
        files: ['four', 'five', 'six'],
        foo: 'rab',
        baz: 'blah',
        gah: 'meh'
      });
    });
  });

  describe('.processRequest', function () {
    it('is a function', function () {
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
      }
    });

    it('runs checkFile on all specified files', async function () {
      const checkFileStub = sandbox.stub(requiredFilePlugin, 'checkFile').resolves();
      await requiredFilePlugin.processRequest(null, commenter, {
        files: [
          'one',
          'two',
          'three'
        ]
      });

      assume(checkFileStub.callCount).equals(3);
    });
  });

  describe('.checkFile', function () {
    let mockContext;

    beforeEach(function () {
      mockContext = {
        github: {
          pulls: {
            listFiles: {
              endpoint: {
                merge: sandbox.stub()
              }
            }
          },
          repos: {
            getContent: getContentStub
          },
          paginate: getFilesInPullRequestStub
        },
        pullRequest() {
          return {
            ...this.repo(),
            pull_number: 1234
          };
        },
        repo() {
          return {
            owner: 'org',
            repo: 'repo'
          };
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
    });

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
      getContentStub.rejects(mockError);
      try {
        // @ts-ignore
        await requiredFilePlugin.checkFile(mockContext, commenter, 'file');
      } catch (err) {
        assume(err).equals(mockError);
      }
    });

    it(`bails out if the file doesn't exist in the first place`, async function () {
      getContentStub.resolves({ status: 404 });
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, 'file');
      assume(getFilesInPullRequestStub.called).is.false();
    });

    it('bails out if getFilesInPullRequest returns an error', async function () {
      getContentStub.resolves({ status: 200 });
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
      getContentStub.resolves({ status: 200 });
      getFilesInPullRequestStub.resolves([{ filename: 'file' }]);
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, 'file');
      assume(addCommentStub.called).is.false();
    });

    it('adds a comment when a required file is not included in the PR', async function () {
      getContentStub.resolves({ status: 200 });
      getFilesInPullRequestStub.resolves([{ filename: 'file' }]);
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, 'file2');
      assume(addCommentStub.calledWithMatch('file2')).is.true();
    });

    it(`bails out if the file doesn't exist in the first place and the file is an object`, async function () {
      getContentStub.resolves({ status: 404 });
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, { path: 'file' });
      assume(getFilesInPullRequestStub.called).is.false();
    });

    it('is a no-op when the required file is included in the PR and the file is an object', async function () {
      getContentStub.resolves({ status: 200 });
      getFilesInPullRequestStub.resolves([{ filename: 'file' }]);
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, { path: 'file' });
      assume(addCommentStub.called).is.false();
    });

    it('adds a comment when a required file is not included in the PR and the file is an object', async function () {
      getContentStub.resolves({ status: 200 });
      getFilesInPullRequestStub.resolves([{ filename: 'file' }]);
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, { path: 'file2' });
      assume(addCommentStub.calledWithMatch('file2')).is.true();
    });

    it('adds a custom comment when a required file is not included in the PR and the file is an object', async function () {
      getContentStub.resolves({ status: 200 });
      getFilesInPullRequestStub.resolves([{ filename: 'file' }]);
      // @ts-ignore
      await requiredFilePlugin.checkFile(mockContext, commenter, { path: 'file2', message: 'custom' });
      assume(addCommentStub.calledWithMatch('custom')).is.true();
    });
  });
});
