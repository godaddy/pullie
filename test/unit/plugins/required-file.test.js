const assume = require('assume');
const sinon = require('sinon');

assume.use(require('assume-sinon'));

const getRequiredFilePlugin = require('../../../lib/plugins/required-file');

const sandbox = sinon.createSandbox();
const checkIfFileExistsStub = sandbox.stub().callsArgWithAsync(2, null, true);
const getFilesInPullRequestStub = sandbox.stub().callsArgWithAsync(2, null, []);
const addCommentStub = sandbox.stub();
const mockApp = {
  github: {
    checkIfFileExists: checkIfFileExistsStub,
    getFilesInPullRequest: getFilesInPullRequestStub
  },
  commenter: {
    addComment: addCommentStub
  }
};

const requiredFilePlugin = getRequiredFilePlugin(mockApp);

describe('RequiredFilePlugin', () => {
  after(() => {
    sandbox.restore();
  });

  beforeEach(() => {
    sandbox.resetHistory();
  });

  it('is a generator function', () => {
    assume(getRequiredFilePlugin).is.a('function');
    assume(getRequiredFilePlugin).has.length(1);
    assume(requiredFilePlugin).is.an('object');
  });

  describe('.processRequest', () => {
    it('is a function', () => {
      assume(requiredFilePlugin.processRequest).is.a('function');
      assume(requiredFilePlugin.processRequest).has.length(3);
    });

    it('bails out if no files list is specified in the plugin config', (done) => {
      const checkFileSpy = sandbox.spy(requiredFilePlugin, 'checkFile');
      requiredFilePlugin.processRequest(null, null, (err) => {
        assume(err).is.truthy();
        assume(checkFileSpy).has.not.been.called();
        checkFileSpy.restore();
        done();
      });
    });

    it('runs checkFile on all specified files', (done) => {
      const checkFileStub = sandbox.stub(requiredFilePlugin, 'checkFile').callsArgAsync(2);
      requiredFilePlugin.processRequest(null, {
        files: [
          'one',
          'two',
          'three'
        ]
      }, (err) => {
        assume(err).is.falsey();
        assume(checkFileStub).has.been.called(3);
        checkFileStub.restore();
        done();
      });
    });
  });

  describe('.checkFile', () => {
    const mockData = {
      repository: {
        full_name: 'org/repo'
      },
      pull_request: {
        number: 1234
      }
    };

    it('bails out if no file path is passed in', (done) => {
      requiredFilePlugin.checkFile(mockData, null, (err) => {
        assume(err).is.truthy();
        assume(err.message).equals('No file path specified for required file.');
        done();
      });
    });

    it('bails out if no file path is passed in with the file object', (done) => {
      requiredFilePlugin.checkFile(mockData, {}, (err) => {
        assume(err).is.truthy();
        assume(err.message).equals('No file path specified for required file.');
        done();
      });
    });

    it('bails out if checkIfFileExists returns an error', (done) => {
      const mockError = new Error('mock error');
      checkIfFileExistsStub.callsArgWithAsync(2, mockError);
      requiredFilePlugin.checkFile(mockData, 'file', (err) => {
        assume(err).equals(mockError);
        done();
      });
    });

    it(`bails out if the file doesn't exist in the first place`, (done) => {
      checkIfFileExistsStub.callsArgWithAsync(2, null, false);
      requiredFilePlugin.checkFile(mockData, 'file', (err) => {
        assume(err).is.falsey();
        assume(getFilesInPullRequestStub).has.not.been.called();
        done();
      });
    });

    it('bails out if getFilesInPullRequest returns an error', (done) => {
      checkIfFileExistsStub.callsArgWithAsync(2, null, true);
      const mockError = new Error('mock error');
      getFilesInPullRequestStub.callsArgWithAsync(2, mockError);
      requiredFilePlugin.checkFile(mockData, 'file', (err) => {
        assume(err).equals(mockError);
        assume(addCommentStub).has.not.been.called();
        done();
      });
    });

    it('is a no-op when the required file is included in the PR', (done) => {
      checkIfFileExistsStub.callsArgWithAsync(2, null, true);
      getFilesInPullRequestStub.callsArgWithAsync(2, null, [{ filename: 'file' }]);
      requiredFilePlugin.checkFile(mockData, 'file', (err) => {
        assume(err).is.falsey();
        assume(addCommentStub).has.not.been.called();
        done();
      });
    });

    it('adds a comment when a required file is not included in the PR', (done) => {
      checkIfFileExistsStub.callsArgWithAsync(2, null, true);
      getFilesInPullRequestStub.callsArgWithAsync(2, null, [{ filename: 'file' }]);
      requiredFilePlugin.checkFile(mockData, 'file2', (err) => {
        assume(err).is.falsey();
        assume(addCommentStub).has.been.calledWithMatch('file2');
        done();
      });
    });

    it(`bails out if the file doesn't exist in the first place and the file is an object`, (done) => {
      checkIfFileExistsStub.callsArgWithAsync(2, null, false);
      requiredFilePlugin.checkFile(mockData, { path: 'file' }, (err) => {
        assume(err).is.falsey();
        assume(getFilesInPullRequestStub).has.not.been.called();
        done();
      });
    });

    it('is a no-op when the required file is included in the PR and the file is an object', (done) => {
      checkIfFileExistsStub.callsArgWithAsync(2, null, true);
      getFilesInPullRequestStub.callsArgWithAsync(2, null, [{ filename: 'file' }]);
      requiredFilePlugin.checkFile(mockData, { path: 'file' }, (err) => {
        assume(err).is.falsey();
        assume(addCommentStub).has.not.been.called();
        done();
      });
    });

    it('adds a comment when a required file is not included in the PR and the file is an object', (done) => {
      checkIfFileExistsStub.callsArgWithAsync(2, null, true);
      getFilesInPullRequestStub.callsArgWithAsync(2, null, [{ filename: 'file' }]);
      requiredFilePlugin.checkFile(mockData, { path: 'file2' }, (err) => {
        assume(err).is.falsey();
        assume(addCommentStub).has.been.calledWithMatch('file2');
        done();
      });
    });

    it('adds a custom comment when a required file is not included in the PR and the file is an object', (done) => {
      checkIfFileExistsStub.callsArgWithAsync(2, null, true);
      getFilesInPullRequestStub.callsArgWithAsync(2, null, [{ filename: 'file' }]);
      requiredFilePlugin.checkFile(mockData, { path: 'file2', message: 'custom' }, (err) => {
        assume(err).is.falsey();
        assume(addCommentStub).has.been.calledWithMatch('custom');
        done();
      });
    });
  });
});
