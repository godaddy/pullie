/* eslint max-statements: 0, no-console: 0 */

import assume from 'assume';
import assumeSinon from 'assume-sinon';
import sinon from 'sinon';
import BasePlugin from '../../plugins/base.js';
import processPRReal, { processPRInternal } from '../../processor.js';

assume.use(assumeSinon);

let MOCK_COMMENT;
class MockCommenter {
  flushToString() {
    return MOCK_COMMENT;
  }
}
const processRequestStub1 = sinon.stub().resolves();
const processRequestStub2 = sinon.stub().resolves();
const processRequestStub3 = sinon.stub().resolves();
class MockPluginManager {
  constructor() {
    this.mockPlugin1 = {
      processesEdits: false,
      processRequest: processRequestStub1,
      mergeConfig: BasePlugin.prototype.mergeConfig
    };
    this.mockPlugin2 = {
      processesEdits: true,
      processRequest: processRequestStub2,
      mergeConfig: BasePlugin.prototype.mergeConfig
    };
    this.mockPlugin3 = {
      processesEdits: true,
      processesReadyForReview: true,
      processRequest: processRequestStub3,
      mergeConfig: BasePlugin.prototype.mergeConfig
    };
  }
}

/**
 * @typedef {import('../../processor').ProbotContext} ProbotContext
 */
/**
 * ProcessPR function with some dependencies injected
 * @param {ProbotContext} context PR webhook context
 * @returns {Promise<void>} Completion promise
 */
async function processPR(context) {
  return processPRInternal(context, MockCommenter, MockPluginManager);
}

/**
 * Convert an object into a base64-encoded JSON string
 *
 * @param {Object} obj Object to convert
 * @returns {string} base64-encoded JSON string
 */
function otoa(obj) {
  return { content: Buffer.from(JSON.stringify(obj)).toString('base64') };
}

const infoLogStub = sinon.stub();
const errorLogStub = sinon.stub();
const warnLogStub = sinon.stub();
const createCommentStub = sinon.stub().resolves();
const getContentStub = sinon.stub();
const mockContext = {
  log: {
    info: infoLogStub,
    warn: warnLogStub,
    error: errorLogStub
  },
  octokit: {
    issues: {
      createComment: createCommentStub
    },
    repos: {
      getContent: getContentStub
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

describe('Processor', function () {
  beforeEach(function () {
    mockContext.payload = {
      action: 'opened',
      number: 123,
      repository: {
        full_name: 'org/repo',
        private: false,
        owner: {
          login: 'org'
        }
      }
    };
    getContentStub.resolves({
      status: 200,
      data: otoa({
        plugins: [
          'mockPlugin1',
          {
            plugin: 'mockPlugin2',
            config: {
              foo: 'bar'
            }
          }
        ]
      })
    });
    getContentStub.withArgs(sinon.match({
      repo: '.github'
    })).resolves({
      status: 200,
      data: otoa({
        plugins: [
          {
            plugin: 'mockPlugin2',
            config: {
              baz: 'blah'
            }
          },
          'mockPlugin3'
        ]
      })
    });
    processRequestStub1.resolves();
    processRequestStub2.resolves();
    processRequestStub3.resolves();
    MOCK_COMMENT = 'MOCK COMMENT';
    delete process.env.GH_ENTERPRISE_ID;
    delete process.env.NO_PUBLIC_REPOS;
  });

  afterEach(function () {
    sinon.resetHistory();
  });

  it('is an async function', function () {
    assume(processPRReal).is.an('asyncfunction');
    assume(processPRReal).has.length(1);
  });

  it('bails when PR is not from an Enterprise when one is required', async function () {
    process.env.GH_ENTERPRISE_ID = '123';
    await processPR(mockContext);
    assume(infoLogStub).has.been.calledWith('PR is not from the configured Enterprise, nothing to do');
    assume(getContentStub).has.not.been.called();
  });

  it('bails when PR is not from the configured Enterprise', async function () {
    process.env.GH_ENTERPRISE_ID = '123';
    mockContext.payload.enterprise = {
      id: 456
    };
    await processPR(mockContext);
    assume(infoLogStub).calledWith('PR is not from the configured Enterprise, nothing to do');
    assume(getContentStub).has.not.been.called();
  });

  it('does not bail when PR is from the configured Enterprise', async function () {
    process.env.GH_ENTERPRISE_ID = '123';
    mockContext.payload.enterprise = {
      id: 123
    };
    await processPR(mockContext);
    assume(infoLogStub).calledWith('PR is from the configured Enterprise');
    assume(getContentStub).has.been.called();
  });

  it('bails when PR is from a public repo and NO_PUBLIC_REPOS is enabled', async function () {
    process.env.NO_PUBLIC_REPOS = 'true';
    await processPR(mockContext);
    assume(infoLogStub).calledWith('Pullie has been disabled on public repos, nothing to do');
    assume(getContentStub).has.not.been.called();
  });

  it('bails when getRepoConfig rejects', async function () {
    const mockError = new Error('MOCK');
    getContentStub.rejects(mockError);
    await processPR(mockContext);
    assume(errorLogStub).calledWithMatch(sinon.match({
      err: mockError
    }), 'Error getting repository config');
  });

  it('bails when no config is present', async function () {
    getContentStub.rejects({
      status: 404
    });
    await processPR(mockContext);
    assume(infoLogStub).calledWith(sinon.match.object, 'No config specified for repo, nothing to do');
  });

  it('logs a warning when an error is encountered loading org-level config', async function () {
    getContentStub.withArgs(sinon.match({
      repo: '.github'
    })).rejects({
      status: 500,
      message: 'Some mock error'
    });
    await processPR(mockContext);
    assume(warnLogStub).calledWith(sinon.match.object, 'Error getting org config');
    assume(createCommentStub).has.been.called();
  });

  it('does not bail when no org-level config is found', async function () {
    getContentStub.withArgs(sinon.match({
      repo: '.github'
    })).rejects({
      status: 404
    });
    await processPR(mockContext);
    assume(warnLogStub).has.not.been.called();
    assume(createCommentStub).has.been.called();
  });

  it('bails when no plugins array is present in config', async function () {
    getContentStub.resetBehavior();
    getContentStub.resolves({
      status: 200,
      data: otoa({})
    });
    await processPR(mockContext);
    assume(infoLogStub).calledWith(sinon.match.object, 'No plugins to run, nothing to do');
  });

  it('bails when the config has an empty plugins array', async function () {
    getContentStub.resetBehavior();
    getContentStub.resolves({
      status: 200,
      data: otoa({
        plugins: []
      })
    });
    await processPR(mockContext);
    assume(infoLogStub).calledWith(sinon.match.object, 'No plugins to run, nothing to do');
  });

  it('does not bail when an unknown plugin is requested in repo config', async function () {
    getContentStub.resolves({
      status: 200,
      data: otoa({
        plugins: [
          'unknownPlugin'
        ]
      })
    });
    await processPR(mockContext);
    assume(errorLogStub).calledWithMatch(sinon.match({
      plugin: 'unknownPlugin'
    }), 'Invalid plugin specified in repo config');
    assume(infoLogStub).calledWith(sinon.match.object, 'Finished processing PR');
    assume(createCommentStub).has.been.called();
  });

  it('does not bail when an unknown plugin is requested in org config', async function () {
    getContentStub.withArgs(sinon.match({
      repo: '.github'
    })).resolves({
      status: 200,
      data: otoa({
        plugins: [
          'unknownPlugin'
        ]
      })
    });
    await processPR(mockContext);
    assume(errorLogStub).calledWithMatch(sinon.match({
      plugin: 'unknownPlugin'
    }), 'Invalid plugin specified in config');
    assume(infoLogStub).calledWith(sinon.match.object, 'Finished processing PR');
    assume(createCommentStub).has.been.called();
  });

  it('runs all specified plugins', async function () {
    await processPR(mockContext);
    assume(errorLogStub).has.not.been.called();
    assume(processRequestStub1).has.been.called();
    assume(processRequestStub2).has.been.called();
    assume(processRequestStub3).has.been.called();
    assume(infoLogStub).calledWith(sinon.match.object, 'Finished processing PR');
    assume(createCommentStub).has.been.called();
  });

  it('properly merges repo-level and org-level config for a plugin', async function () {
    await processPR(mockContext);
    assume(processRequestStub2).calledWithMatch(mockContext, sinon.match.instanceOf(MockCommenter), sinon.match({
      foo: 'bar',
      baz: 'blah'
    }));
  });

  it('skips plugins that do not process edits when processing an edit', async function () {
    mockContext.payload.action = 'edited';
    await processPR(mockContext);
    assume(errorLogStub).has.not.been.called();
    assume(processRequestStub1).has.not.been.called();
    assume(processRequestStub2).has.been.called();
    assume(processRequestStub3).has.been.called();
    assume(infoLogStub).calledWith(sinon.match.object, 'Finished processing PR');
    assume(createCommentStub).has.been.called();
  });

  it('skips plugins that do not process "ready for review" when processing a PR being marked as such',
    async function () {
      mockContext.payload.action = 'ready_for_review';
      await processPR(mockContext);
      assume(errorLogStub).has.not.been.called();
      assume(processRequestStub1).has.not.been.called();
      assume(processRequestStub2).has.not.been.called();
      assume(processRequestStub3).has.been.called();
      assume(infoLogStub).calledWith(sinon.match.object, 'Finished processing PR');
      assume(createCommentStub).has.been.called();
    });

  it('passes down plugin config', async function () {
    await processPR(mockContext);
    assume(processRequestStub2).calledWithMatch(sinon.match.object, sinon.match.object, sinon.match({
      foo: 'bar'
    }));
  });

  it('does not bail when a plugin fails', async function () {
    const mockError = new Error('mock error');
    processRequestStub1.rejects(mockError);
    await processPR(mockContext);
    assume(errorLogStub).calledWithMatch(sinon.match({
      error: mockError,
      repository: 'org/repo',
      number: 123,
      plugin: 'mockPlugin1',
      requestId: 'MOCK-ID'
    }), 'Error running plugin');
    assume(processRequestStub2).has.been.called();
    assume(infoLogStub).calledWith(sinon.match.object, 'Finished processing PR');
    assume(createCommentStub).has.been.called();
  });

  it('does not post a comment when no comments are aggregated', async function () {
    MOCK_COMMENT = null;
    await processPR(mockContext);
    assume(createCommentStub).has.not.been.called();
  });
});
