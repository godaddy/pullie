const assume = require('assume');
const sinon = require('sinon');

const Processor = require('../../lib/processor');

assume.use(require('assume-sinon'));

describe('Processor', () => { // eslint-disable-line max-statements
  const sandbox = sinon.createSandbox();

  const mockError = new Error('mock error');
  const mockProcessRequestStub = sandbox.stub().callsArgAsync(2);
  const mockNoEditsProcessRequestStub = sandbox.stub().callsArgAsync(2);
  const errorsProcessRequestStub = sandbox.stub().callsArgWithAsync(2, mockError);
  const flushToStringStub = sandbox.stub().returns('mock comment');
  const createIssueCommentStub = sandbox.stub().callsArgAsync(3);
  const getFileContentsStub = sandbox.stub().callsArgWithAsync(2, null, 'mockJson');
  const parsePackageJsonStub = sandbox.stub().callsArgAsync(1);
  const mockApp = {
    plugins: {
      mock: {
        get processesEdits() { return true; },
        processRequest: mockProcessRequestStub
      },
      mockNoEdits: {
        get processesEdits() { return false; },
        processRequest: mockNoEditsProcessRequestStub
      },
      errors: {
        get processesEdits() { return true; },
        processRequest: errorsProcessRequestStub
      }
    },
    commenter: {
      flushToString: flushToStringStub
    },
    github: {
      createIssueComment: createIssueCommentStub,
      getFileContents: getFileContentsStub,
      parsePackageJson: parsePackageJsonStub
    },
    log: {
      info: sandbox.stub(),
      error: sandbox.stub()
    }
  };

  const mockReq = {
    headers: {
      'x-github-event': 'pull_request'
    },
    body: {
      action: 'opened',
      repository: {
        full_name: 'mock/repo'
      },
      pull_request: {
        number: 123
      }
    }
  };

  const mockEditReq = {
    headers: {
      'x-github-event': 'pull_request'
    },
    body: {
      action: 'edited',
      repository: {
        full_name: 'mock/repo'
      },
      pull_request: {
        number: 123,
        title: 'New title'
      },
      changes: {
        title: {
          from: 'Original title',
          to: 'New title'
        }
      }
    }
  };

  const processor = new Processor(mockApp);

  beforeEach(() => {
    sandbox.resetHistory();
  });

  after(() => {
    sandbox.restore();
  });

  it('is a constructor', () => {
    assume(Processor).is.a('function');
    assume(Processor).has.length(1);
    assume(processor).is.instanceOf(Processor);
  });

  describe('.processRequest', () => {
    it('is a function', () => {
      assume(processor.processRequest).is.a('function');
      assume(processor.processRequest).has.length(2);
    });

    it('bails out on unknown event types', (done) => {
      const getRepoConfigSpy = sandbox.spy(processor, 'getRepoConfig');
      processor.processRequest({
        headers: {
          'x-github-event': 'unknown'
        }
      }, (err) => {
        assume(err).is.falsey();
        assume(getRepoConfigSpy).has.not.been.called();
        getRepoConfigSpy.restore();
        done();
      });
    });

    it('bails out on unknown actions', (done) => {
      const getRepoConfigSpy = sandbox.spy(processor, 'getRepoConfig');
      processor.processRequest({
        headers: {
          'x-github-event': 'pull_request'
        },
        body: {
          action: 'unknown'
        }
      }, (err) => {
        assume(err).is.falsey();
        assume(getRepoConfigSpy).has.not.been.called();
        getRepoConfigSpy.restore();
        done();
      });
    });

    it('bails out when config fetch errors', (done) => {
      const getRepoConfigStub = sandbox.stub(processor, 'getRepoConfig').callsArgWithAsync(1, mockError);
      processor.processRequest(mockReq, (err) => {
        assume(getRepoConfigStub).has.been.called();
        assume(err).equals(mockError);
        getRepoConfigStub.restore();
        done();
      });
    });

    it('bails out when no config is found', (done) => {
      const getRepoConfigStub = sandbox.stub(processor, 'getRepoConfig').callsArgWithAsync(1, null);
      processor.processRequest(mockReq, (err) => {
        assume(getRepoConfigStub).has.been.called();
        assume(err).is.falsey();
        getRepoConfigStub.restore();
        done();
      });
    });

    it('bails out when no plugins are specified', (done) => {
      const getRepoConfigStub = sandbox.stub(processor, 'getRepoConfig').callsArgWithAsync(1, null, {});
      processor.processRequest(mockReq, (err) => {
        assume(getRepoConfigStub).has.been.called();
        assume(err).is.falsey();
        getRepoConfigStub.restore();
        done();
      });
    });

    it('bails out when the plugins list is empty', (done) => {
      const getRepoConfigStub = sandbox.stub(processor, 'getRepoConfig').callsArgWithAsync(1, null, {
        plugins: []
      });
      processor.processRequest(mockReq, (err) => {
        assume(getRepoConfigStub).has.been.called();
        assume(err).is.falsey();
        getRepoConfigStub.restore();
        done();
      });
    });

    it('bails out when an invalid plugin is specified', (done) => {
      const getRepoConfigStub = sandbox.stub(processor, 'getRepoConfig').callsArgWithAsync(1, null, {
        plugins: [
          'fake'
        ]
      });
      processor.processRequest(mockReq, (err) => {
        assume(getRepoConfigStub).has.been.called();
        assume(err).is.truthy();
        assume(err).hasOwn('message', `Invalid config: no plugin named 'fake' exists.`);
        getRepoConfigStub.restore();
        done();
      });
    });

    it(`runs plugins' processRequest methods`, (done) => {
      const getRepoConfigStub = sandbox.stub(processor, 'getRepoConfig').callsArgWithAsync(1, null, {
        plugins: [
          'mock'
        ]
      });
      processor.processRequest(mockReq, (err) => {
        assume(getRepoConfigStub).has.been.called();
        assume(mockProcessRequestStub).has.been.calledWith(mockReq.body, {});
        assume(err).is.falsey();
        assume(flushToStringStub).has.been.called();
        assume(createIssueCommentStub).has.been.called();
        getRepoConfigStub.restore();
        done();
      });
    });

    it(`runs plugins' processRequest methods with config`, (done) => {
      const getRepoConfigStub = sandbox.stub(processor, 'getRepoConfig').callsArgWithAsync(1, null, {
        plugins: [
          {
            plugin: 'mock',
            config: {
              foo: 'bar'
            }
          }
        ]
      });
      processor.processRequest(mockReq, (err) => {
        assume(getRepoConfigStub).has.been.called();
        assume(mockProcessRequestStub).has.been.calledWith(mockReq.body, {
          foo: 'bar'
        });
        assume(err).is.falsey();
        assume(flushToStringStub).has.been.called();
        assume(createIssueCommentStub).has.been.called();
        getRepoConfigStub.restore();
        done();
      });
    });

    it(`skips plugins' processRequest methods on edit actions when the plugin doesn't handle edits`, (done) => {
      const getRepoConfigStub = sandbox.stub(processor, 'getRepoConfig').callsArgWithAsync(1, null, {
        plugins: [
          'mockNoEdits'
        ]
      });
      processor.processRequest(mockEditReq, (err) => {
        assume(getRepoConfigStub).has.been.called();
        assume(mockNoEditsProcessRequestStub).has.not.been.called();
        assume(err).is.falsey();
        assume(flushToStringStub).has.been.called();
        assume(createIssueCommentStub).has.been.called();
        getRepoConfigStub.restore();
        done();
      });
    });

    it(`handles errors from plugins' processRequest methods`, (done) => {
      const getRepoConfigStub = sandbox.stub(processor, 'getRepoConfig').callsArgWithAsync(1, null, {
        plugins: [
          'errors'
        ]
      });
      processor.processRequest(mockReq, (err) => {
        assume(getRepoConfigStub).has.been.called();
        assume(errorsProcessRequestStub).has.been.calledWith(mockReq.body, {});
        assume(err).is.truthy();
        assume(err).equals(mockError);
        assume(flushToStringStub).has.not.been.called();
        assume(createIssueCommentStub).has.not.been.called();
        getRepoConfigStub.restore();
        done();
      });
    });
  });

  describe('.getRepoConfig', () => {
    it('is a function', () => {
      assume(processor.getRepoConfig).is.a('function');
      assume(processor.getRepoConfig).has.length(2);
    });

    it('errrors on error retrieving config file', (done) => {
      getFileContentsStub.callsArgWithAsync(2, mockError);
      processor.getRepoConfig(mockReq.body.repository, (err) => {
        assume(getFileContentsStub).has.been.called();
        assume(err).is.truthy();
        assume(err).equals(mockError);
        done();
      });
    });

    it('bails on 404 retrieving config file', (done) => {
      getFileContentsStub.callsArgWithAsync(2, {
        statusCode: 404
      });
      processor.getRepoConfig(mockReq.body.repository, (err) => {
        assume(getFileContentsStub).has.been.called();
        assume(err).is.falsey();
        done();
      });
    });

    it('handles a valid config file', (done) => {
      getFileContentsStub.callsArgWithAsync(2, null, 'mockJson');
      processor.getRepoConfig(mockReq.body.repository, (err) => {
        assume(getFileContentsStub).has.been.called();
        assume(err).is.falsey();
        assume(parsePackageJsonStub).has.been.calledWith('mockJson');
        done();
      });
    });
  });
});
