const assume = require('assume');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

let MOCK_COMMENT;
class MockCommenter {
  flushToString() {
    return MOCK_COMMENT;
  }
}
const processRequestStub1 = sinon.stub().resolves();
const processRequestStub2 = sinon.stub().resolves();
class MockPluginManager {
  constructor() {
    this.mockPlugin1 = {
      processesEdits: false,
      processRequest: processRequestStub1
    };
    this.mockPlugin2 = {
      processesEdits: true,
      processRequest: processRequestStub2
    };
  }
}
const processPR = proxyquire('../../processor', {
  './commenter': MockCommenter,
  './plugins': MockPluginManager,
  './utils': {
    parsePackageJson: sinon.stub().returnsArg(0)
  }
});

const infoLogStub = sinon.stub();
const errorLogStub = sinon.stub();
const createCommentStub = sinon.stub().resolves();
const getContentsStub = sinon.stub();
const mockContext = {
  log: {
    info: infoLogStub,
    error: errorLogStub
  },
  github: {
    issues: {
      createComment: createCommentStub
    },
    repos: {
      getContents: getContentsStub
    }
  },
  repo() {
    return {
      org: 'org',
      repo: 'repo'
    };
  },
  payload: null,
  id: 'MOCK-ID'
};

describe('Processor', () => {
  beforeEach(function () {
    mockContext.payload = {
      action: 'opened',
      number: 123,
      repository: {
        full_name: 'org/repo'
      }
    };
    getContentsStub.resolves({
      status: 200,
      data: {
        plugins: [
          'mockPlugin1',
          {
            plugin: 'mockPlugin2',
            config: {
              foo: 'bar'
            }
          }
        ]
      }
    });
    processRequestStub1.resolves();
    processRequestStub2.resolves();
    MOCK_COMMENT = 'MOCK COMMENT';
  });

  afterEach(function () {
    sinon.resetHistory();
  });

  it('is an async function', function () {
    assume(processPR).is.an('asyncfunction');
    assume(processPR).has.length(1);
  });

  it('bails when getRepoConfig rejects', async function () {
    const mockError = new Error('MOCK');
    getContentsStub.rejects(mockError);
    await processPR(mockContext);
    assume(errorLogStub.calledWithMatch('Error getting repository config', sinon.match({
      err: mockError
    }))).is.true();
  });

  it('bails when no config is present', async function () {
    getContentsStub.rejects({
      status: 404
    });
    await processPR(mockContext);
    assume(infoLogStub.calledWith('No config specified for repo, nothing to do'));
  });

  it('bails when no plugins array is present in config', async function () {
    getContentsStub.resolves({
      status: 200,
      data: {}
    });
    await processPR(mockContext);
    assume(infoLogStub.calledWith('No config specified for repo, nothing to do'));
  });

  it('bails when the config has an empty plugins array', async function () {
    getContentsStub.resolves({
      status: 200,
      data: {
        plugins: []
      }
    });
    await processPR(mockContext);
    assume(infoLogStub.calledWith('No config specified for repo, nothing to do'));
  });

  it('does not bail when an unknown plugin is requested', async function () {
    getContentsStub.resolves({
      status: 200,
      data: {
        plugins: [
          'unknownPlugin'
        ]
      }
    });
    await processPR(mockContext);
    assume(errorLogStub.calledWithMatch('Invalid plugin specified in config', sinon.match({
      plugin: 'unknownPlugin'
    })));
    assume(infoLogStub.calledWith('Finished processing PR'));
    assume(createCommentStub.called).is.true();
  });

  it('runs all specified plugins', async function () {
    await processPR(mockContext);
    assume(errorLogStub.called).is.false();
    assume(processRequestStub1.called).is.true();
    assume(processRequestStub2.called).is.true();
    assume(infoLogStub.calledWith('Finished processing PR'));
    assume(createCommentStub.called).is.true();
  });

  it('skips plugins that do not process edits when processing an edit', async function () {
    mockContext.payload.action = 'edited';
    await processPR(mockContext);
    assume(errorLogStub.called).is.false();
    assume(processRequestStub1.called).is.false();
    assume(processRequestStub2.called).is.true();
    assume(infoLogStub.calledWith('Finished processing PR'));
    assume(createCommentStub.called).is.true();
  });

  it('passes down plugin config', async function () {
    await processPR(mockContext);
    assume(processRequestStub2.calledWithMatch(sinon.match.object, sinon.match.object, sinon.match({
      foo: 'bar'
    }))).is.true();
  });

  it('does not bail when a plugin fails', async function () {
    const mockError = new Error('mock error');
    processRequestStub1.rejects(mockError);
    await processPR(mockContext);
    assume(errorLogStub.calledWithMatch('Error running plugin', sinon.match({
      error: mockError,
      repository: 'org/repo',
      number: 123,
      plugin: 'mockPlugin1',
      requestId: 'MOCK-ID'
    }))).is.true();
    assume(processRequestStub2.called).is.true();
    assume(infoLogStub.calledWith('Finished processing PR'));
    assume(createCommentStub.called).is.true();
  });

  it('does not post a comment when no comments are aggregated', async function () {
    MOCK_COMMENT = null;
    await processPR(mockContext);
    assume(createCommentStub.called).is.false();
  });
});
