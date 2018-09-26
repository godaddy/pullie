const assume = require('assume');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

const sandbox = sinon.createSandbox();
const githulkRepositoryContentsStub = sandbox.stub().callsArgAsync(2);
const githulkCommentsCreateStub = sandbox.stub().callsArgAsync(3);
const githulkPullsFilesStub = sandbox.stub().callsArgAsync(3);
const githulkPullsRequestReviewersStub = sandbox.stub().callsArgAsync(3); // eslint-disable-line id-length
const githulkUsersGetStub = sandbox.stub().callsArgAsync(1);
const githulkStub = class GitHulkStub {
  constructor() {
    this.repository = {
      contents: githulkRepositoryContentsStub
    };
    this.comments = {
      create: githulkCommentsCreateStub
    };
    this.pulls = {
      files: githulkPullsFilesStub,
      requestReviewers: githulkPullsRequestReviewersStub
    };
    this.users = {
      get: githulkUsersGetStub
    };
  }
};

const GitHubClient = proxyquire('../../lib/github', {
  githulk: githulkStub
});

assume.use(require('assume-sinon'));

describe('GitHubClient', () => {
  const github = new GitHubClient({
    apiUrl: 'apiUrl',
    appId: '123',
    appKeyPath: 'test/fixtures/mock-key.pem'
  });

  before((done) => {
    const getAccessKeyStub = sandbox.stub(github, 'getAccessKey')
      .callsArgWithAsync(2, null, 'mocktoken');
    github.login(1, err => {
      getAccessKeyStub.restore();
      done(err);
    });
  });

  beforeEach(() => {
    sandbox.resetHistory();
  });

  after(() => {
    sandbox.restore();
  });

  it('is a constructor', () => {
    assume(GitHubClient).is.a('function');
    assume(GitHubClient).has.length(1);
    assume(github).is.instanceOf(GitHubClient);
  });

  describe('.login', () => {
    it('is a function', () => {
      assume(github.login).is.a('function');
      assume(github.login).has.length(2);
    });

    it('bails if it cannot load the app private key', (done) => {
      const getAppKeyStub = sandbox.stub(github, 'getAppKey')
        .yieldsAsync(new Error('getAppKey error'));
      github.login(1, err => {
        assume(err.message).equals('getAppKey error');
        getAppKeyStub.restore();
        done();
      });
    });

    it('bails if getAccessKey fails', (done) => {
      const getAccessKeyStub = sandbox.stub(github, 'getAccessKey')
        .callsArgWithAsync(2, new Error('getAccessKey error'));
      github.login(1, err => {
        assume(err.message).equals('getAccessKey error');
        getAccessKeyStub.restore();
        done();
      });
    });

    it('instantiates a GitHulk instance with the correct access key', (done) => {
      const getAccessKeyStub = sandbox.stub(github, 'getAccessKey')
        .callsArgWithAsync(2, null, 'mocktoken');
      github.login(1, err => {
        assume(err).is.falsey();
        assume(github.githulk).is.truthy();
        getAccessKeyStub.restore();
        done();
      });
    });
  });

  describe('.logout', () => {
    it('is a function', () => {
      assume(github.logout).is.a('function');
      assume(github.logout).has.length(0);
    });

    it('deletes a live GitHulk instance', () => {
      assume(github.githulk).is.truthy();
      const copy = github.githulk;
      github.logout();
      assume(github.githulk).is.falsey();
      github.githulk = copy;
    });
  });

  describe('.getFileContents', () => {
    it('is a function', () => {
      assume(github.getFileContents).is.a('function');
      assume(github.getFileContents).has.length(3);
    });

    it('calls githulk properly', (done) => {
      github.getFileContents('org/repo', { foo: 'bar' }, () => {
        assume(githulkRepositoryContentsStub).has.been.called();
        done();
      });
    });
  });

  describe('.parsePackageJson', () => {
    it('is a function', () => {
      assume(github.parsePackageJson).is.a('function');
      assume(github.parsePackageJson).has.length(2);
    });

    it('bails on null pkg', (done) => {
      github.parsePackageJson(null, (err, contents) => {
        assume(err).is.falsey();
        assume(contents).does.not.exist();
        done();
      });
    });

    it('bails on null pkg.content', (done) => {
      github.parsePackageJson({}, (err, contents) => {
        assume(err).is.falsey();
        assume(contents).does.not.exist();
        done();
      });
    });

    it('bails on invalid package contents', (done) => {
      github.parsePackageJson({
        content: 'this is definitely not base64 at all $%&$@&@$&%@$&&^*$%&@^#$'
      }, (err, contents) => {
        assume(err).is.truthy();
        assume(contents).does.not.exist();
        done();
      });
    });

    it('properly parses package contents', (done) => {
      github.parsePackageJson({
        content: 'eyJmb28iOiJiYXIifQ=='
      }, (err, contents) => {
        assume(err).is.falsey();
        assume(contents).is.an('object');
        assume(contents).hasOwn('foo', 'bar');
        done();
      });
    });
  });

  describe('.createIssueComment', () => {
    it('is a function', () => {
      assume(github.createIssueComment).is.a('function');
      assume(github.createIssueComment).has.length(4);
    });

    it('calls githulk properly', (done) => {
      github.createIssueComment('org/repo', 123, 'comment', () => {
        assume(githulkCommentsCreateStub).has.been.calledWithMatch('org/repo', 123, { body: 'comment' });
        done();
      });
    });
  });

  describe('.checkIfFileExists', () => {
    it('is a function', () => {
      assume(github.checkIfFileExists).is.a('function');
      assume(github.checkIfFileExists).has.length(3);
    });

    it('handles missing files properly', (done) => {
      githulkRepositoryContentsStub.callsArgWithAsync(2, {
        statusCode: 404
      });
      github.checkIfFileExists('org/repo', 'path', (err, exists) => {
        assume(err).is.falsey();
        assume(exists).is.false();
        assume(githulkRepositoryContentsStub).has.been.called();
        done();
      });
    });

    it('handles errors properly', (done) => {
      githulkRepositoryContentsStub.callsArgWithAsync(2, {
        message: 'error'
      });
      github.checkIfFileExists('org/repo', 'path', (err) => {
        assume(err).is.truthy();
        assume(err.message).equals('error');
        assume(githulkRepositoryContentsStub).has.been.called();
        done();
      });
    });

    it('handles present files properly', (done) => {
      githulkRepositoryContentsStub.callsArgAsync(2);
      github.checkIfFileExists('org/repo', 'path', (err, exists) => {
        assume(err).is.falsey();
        assume(exists).is.true();
        assume(githulkRepositoryContentsStub).has.been.called();
        done();
      });
    });
  });

  describe('.getFilesInPullRequest', () => {
    it('is a function', () => {
      assume(github.getFilesInPullRequest).is.a('function');
      assume(github.getFilesInPullRequest).has.length(3);
    });

    it('calls githulk properly', (done) => {
      github.getFilesInPullRequest('org/repo', 123, () => {
        assume(githulkPullsFilesStub).has.been.calledWithMatch('org/repo', 123, {});
        done();
      });
    });
  });

  describe('.requestReviewers', () => {
    it('is a function', () => {
      assume(github.requestReviewers).is.a('function');
      assume(github.requestReviewers).has.length(4);
    });

    it('calls githulk properly', (done) => {
      github.requestReviewers('org/repo', 123, ['bob'], () => {
        assume(githulkPullsRequestReviewersStub).has.been.called();
        done();
      });
    });
  });

  describe('.userExists', () => {
    it('is a function', () => {
      assume(github.userExists).is.a('function');
      assume(github.userExists).has.length(2);
    });

    it('returns false if the user is not found', (done) => {
      githulkUsersGetStub.callsArgWithAsync(1, {
        statusCode: 404
      });
      github.userExists('jimbob', (err, exists) => {
        assume(err).is.falsey();
        assume(exists).is.false();
        done();
      });
    });

    it('passes through an error from githulk', (done) => {
      githulkUsersGetStub.callsArgWithAsync(1, {
        statusCode: 500
      });
      github.userExists('jimbob', (err) => {
        assume(err).is.truthy();
        done();
      });
    });

    it('returns true if the user is found', (done) => {
      githulkUsersGetStub.callsArgWithAsync(1, null, {});
      github.userExists('jimbob', (err, exists) => {
        assume(err).is.falsey();
        assume(exists).is.true();
        done();
      });
    });
  });
});
