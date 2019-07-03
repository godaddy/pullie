const assume = require('assume');
const sinon = require('sinon');

const ReviewersPlugin = require('../../../plugins/reviewers');
const Commenter = require('../../../commenter');

const sandbox = sinon.createSandbox();
const requestReviewersStub = sandbox.stub().resolves();
const getFileContentsStub = sandbox.stub().resolves({ status: 404 });
const userExistsStub = sandbox.stub().resolves({ status: 404 });
const addCommentStub = sandbox.stub();
const commenter = {
  addComment: addCommentStub,
  comments: null,
  flushToString: null
};

const reviewersPlugin = new ReviewersPlugin();

describe('ReviewersPlugin', function () {
  after(function () {
    sandbox.restore();
  });

  beforeEach(function () {
    sandbox.resetHistory();
  });

  it('is a constructor', function () {
    assume(ReviewersPlugin).is.a('function');
    assume(ReviewersPlugin).has.length(0);
    assume(reviewersPlugin).is.an('object');
  });

  const mockContext = {
    github: {
      pulls: {
        createReviewRequest: requestReviewersStub
      },
      repos: {
        checkCollaborator: userExistsStub,
        getContents: getFileContentsStub
      }
    },
    issue() {
      return {
        ...this.repo(),
        number: 1234
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
        number: 1234,
        user: {
          login: 'jdoe'
        }
      }
    }
  };

  it('does not process edits', function () {
    assume(reviewersPlugin.processesEdits).is.false();
  });

  describe('.processRequest', function () {
    it('is a function', function () {
      assume(reviewersPlugin.processRequest).is.an('asyncfunction');
      assume(reviewersPlugin.processRequest).has.length(3);
    });

    it('bails out if getPackageJson returns an error', async function () {
      const mockError = new Error('mock error');
      const getPackageJsonStub = sandbox.stub(reviewersPlugin, 'getPackageJson').rejects(mockError);
      try {
        // @ts-ignore
        await reviewersPlugin.processRequest(mockContext, commenter, null);
      } catch (err) {
        assume(err).equals(mockError);
      } finally {
        getPackageJsonStub.restore();
      }
    });

    it('bails out if no package.json is found', async function () {
      const getPackageJsonStub = sandbox.stub(reviewersPlugin, 'getPackageJson').resolves();
      // eslint-disable-next-line id-length
      const getAllPossibleReviewersSpy = sandbox.spy(reviewersPlugin, 'getAllPossibleReviewers');
      try {
        // @ts-ignore
        await reviewersPlugin.processRequest(mockContext, commenter, null);
        assume(getAllPossibleReviewersSpy.called).is.false();
      } finally {
        getPackageJsonStub.restore();
        getAllPossibleReviewersSpy.restore();
      }
    });

    it('properly passes package.json info to getAllPossibleReviewers and requestReviews', async () =>  {
      const mockPackageInfo = {};
      const getPackageJsonStub = sandbox.stub(reviewersPlugin, 'getPackageJson')
        .resolves(mockPackageInfo);
      const mockReviewers = ['one', 'two'];
      // eslint-disable-next-line id-length
      const getAllPossibleReviewersStub = sandbox.stub(reviewersPlugin, 'getAllPossibleReviewers')
        .returns(mockReviewers);
      const requestReviewsStub = sandbox.stub(reviewersPlugin, 'requestReviews').resolves();

      try {
        // @ts-ignore
        await reviewersPlugin.processRequest(mockContext, commenter, null);
        assume(getAllPossibleReviewersStub.calledWithMatch(
          sinon.match.same(mockPackageInfo)
        )).is.true();
        // @ts-ignore
        assume(requestReviewsStub.calledWithMatch(
          sinon.match.any,
          sinon.match.array.deepEquals(mockReviewers)
        )).is.true();
      } finally {
        getPackageJsonStub.restore();
        getAllPossibleReviewersStub.restore();
        requestReviewsStub.restore();
      }
    });

    it('skips loading candidate reviewers from package.json when reviewers are specified in config', async function () {
      const getPackageJsonStub = sandbox.stub(reviewersPlugin, 'getPackageJson');
      const mockReviewers = ['one', 'two'];
      const requestReviewsStub = sandbox.stub(reviewersPlugin, 'requestReviews').resolves();
      try {
        // @ts-ignore
        await reviewersPlugin.processRequest(mockContext, commenter, {
          reviewers: mockReviewers
        });
        assume(getPackageJsonStub.called).is.false();
        // @ts-ignore
        assume(requestReviewsStub.calledWithMatch(
          sinon.match.any,
          sinon.match.array.deepEquals(mockReviewers)
        )).is.true();
      } finally {
        getPackageJsonStub.restore();
        requestReviewsStub.restore();
      }
    });
  });

  describe('.getAllPossibleReviewers', function () {
    it('assembles the reviewers list from array contributors and maintainers fields, plus author in package.json', function () {
      assume(reviewersPlugin.getAllPossibleReviewers({
        contributors: [
          'one',
          'two'
        ],
        author: 'three',
        maintainers: [
          'four'
        ]
      })).deep.equals([
        'one',
        'two',
        'four',
        'three'
      ]);
    });

    it('assembles the reviewers list from string contributors, maintainers, and author fields in package.json', function () {
      assume(reviewersPlugin.getAllPossibleReviewers({
        contributors: 'one',
        author: 'two',
        maintainers: 'three'
      })).deep.equals([
        'one',
        'three',
        'two'
      ]);
    });

    it('assembles the reviewers list from a string author field in package.json', function () {
      assume(reviewersPlugin.getAllPossibleReviewers({
        author: 'one'
      })).deep.equals([
        'one'
      ]);
    });

    it('assembles the reviewers list from object fields in package.json', function () {
      assume(reviewersPlugin.getAllPossibleReviewers({
        contributors: [
          {
            name: 'one',
            email: 'one@test.com'
          },
          {
            name: 'two',
            email: 'two@test.com'
          }
        ],
        maintainers: {
          name: 'three',
          email: 'three@test.com'
        }
      })).deep.equals([
        {
          name: 'one',
          email: 'one@test.com'
        },
        {
          name: 'two',
          email: 'two@test.com'
        },
        {
          name: 'three',
          email: 'three@test.com'
        }
      ]);
    });
  });

  // normalizeReviewerField is already throroughly tested by the unit tests for getAllPossibleReviewers above

  describe('.requestReviews', function () {
    it('bails out if no reviewers are specified', async function () {
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList');
      try {
        // @ts-ignore
        await reviewersPlugin.requestReviews({}, null, null, null, commenter);
        assume(getUsersFromReviewersListStub.called).is.false();
      } finally {
        getUsersFromReviewersListStub.restore();
      }
    });

    it('bails out if getUsersFromReviewersList returns an error', async function () {
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .rejects(new Error('getUsersFromReviewersListError'));
      try {
        // @ts-ignore
        await reviewersPlugin.requestReviews({}, [], null, null, commenter);
      } catch (err) {
        assume(getUsersFromReviewersListStub.called).is.true();
        assume(err).is.truthy();
        assume(err.message).equals('getUsersFromReviewersListError');
      } finally {
        getUsersFromReviewersListStub.restore();
      }
    });

    it('bails out if no users are found to request review from', async function () {
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .resolves([]);
      try {
        // @ts-ignore
        await reviewersPlugin.requestReviews({}, ['one'], null, null, commenter);
        assume(getUsersFromReviewersListStub.called).is.true();
        assume(requestReviewersStub.called).is.false();
      } finally {
        getUsersFromReviewersListStub.restore();
      }
    });

    it('extracts a subset of candidate reviewers based on howMany parameter', async function () {
      const candidateReviewers = [
        'one',
        'two',
        'three'
      ];
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .resolves(candidateReviewers);
      const howManyRequested = 2;
      try {
        // @ts-ignore
        await reviewersPlugin.requestReviews(mockContext, candidateReviewers, howManyRequested, null, commenter);
        assume(getUsersFromReviewersListStub.called).is.true();
        assume(requestReviewersStub.calledWithMatch({
          reviewers: sinon.match(value => { // eslint-disable-line max-nested-callbacks
            return value && Array.isArray(value) && value.length === howManyRequested &&
              value.every(r => { // eslint-disable-line max-nested-callbacks
                return candidateReviewers.includes(r);
              });
          })
        })).is.true();
      } finally {
        getUsersFromReviewersListStub.restore();
      }
    });

    it('requests review from all candidate reviewers if howMany > numCandidates', async function () {
      const candidateReviewers = [
        'one',
        'two',
        'three'
      ];
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .resolves(candidateReviewers);
      const howManyRequested = 4;
      try {
        // @ts-ignore
        await reviewersPlugin.requestReviews(mockContext, candidateReviewers, howManyRequested, null, commenter);
        assume(getUsersFromReviewersListStub.called).is.true();
        assume(requestReviewersStub.calledWithMatch({
          reviewers: sinon.match.array.contains(candidateReviewers).and(sinon.match(value => {
            return value.length === candidateReviewers.length;
          }))
        })).is.true();
      } finally {
        getUsersFromReviewersListStub.restore();
      }
    });

    it('adds a comment listing requested reviewers when configured', async function () {
      const candidateReviewers = [
        'one',
        'two',
        'three'
      ];
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .resolves(candidateReviewers);
      try {
        // @ts-ignore
        await reviewersPlugin.requestReviews(mockContext, candidateReviewers, null, 'Some comment %s', commenter);
        assume(getUsersFromReviewersListStub.called).is.true();
        assume(addCommentStub.calledWithMatch('@one, @three, @two', Commenter.priority.Medium)).is.true();
      } finally {
        getUsersFromReviewersListStub.restore();
      }
    });

    it('requests review from all candidate reviewers if howMany is not specified', async function () {
      const candidateReviewers = [
        'one',
        'two',
        'three'
      ];
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .resolves(candidateReviewers);
      try {
        // @ts-ignore
        await reviewersPlugin.requestReviews(mockContext, candidateReviewers, null, null, commenter);
        assume(getUsersFromReviewersListStub.called).is.true();
        assume(requestReviewersStub.calledWithMatch({
          reviewers: sinon.match.array.contains(candidateReviewers).and(sinon.match(value => {
            return value.length === candidateReviewers.length;
          }))
        })).is.true();
      } finally {
        getUsersFromReviewersListStub.restore();
      }
    });
  });

  describe('.getPackageJson', function () {
    it('is a function', function () {
      assume(reviewersPlugin.getPackageJson).is.an('asyncfunction');
      assume(reviewersPlugin.getPackageJson).has.length(1);
    });

    it('bails out when package.json is missing', async function () {
      getFileContentsStub.resolves({ status: 404 });
      // @ts-ignore
      const ret = await reviewersPlugin.getPackageJson(mockContext);
      assume(ret).does.not.exist();
    });

    it('bails out when an error is encountered attempting to fetch package.json', async function () {
      const mockError = new Error('mock error');
      getFileContentsStub.rejects(mockError);
      try {
        // @ts-ignore
        await reviewersPlugin.getPackageJson(mockContext);
      } catch (err) {
        assume(err).equals(mockError);
      }
    });

    it('hands off the packaged file to parsePackageJson for parsing', async function () {
      const mockPackageJson = {
        foo: 'bar'
      };
      const mockPkg = {
        content: Buffer.from(JSON.stringify(mockPackageJson)).toString('base64')
      };
      getFileContentsStub.resolves({
        status: 200,
        data: mockPkg
      });
      // @ts-ignore
      const ret = await reviewersPlugin.getPackageJson(mockContext);
      assume(ret).eqls(mockPackageJson);
    });
  });

  describe('.getUsersFromReviewersList', function () {
    it('is a function', function () {
      assume(reviewersPlugin.getUsersFromReviewersList).is.an('asyncfunction');
      assume(reviewersPlugin.getUsersFromReviewersList).has.length(2);
    });

    it('bails out when reviewers is falsey', async function () {
      const users = await reviewersPlugin.getUsersFromReviewersList(null, null);
      assume(users).does.not.exist();
    });

    it('bails out when reviewers is empty', async function () {
      const users = await reviewersPlugin.getUsersFromReviewersList(null, []);
      assume(users).does.not.exist();
    });

    it('passes through an error when checkCollaborator fails', async function () {
      userExistsStub.rejects(new Error('userExists error'));
      try {
        // @ts-ignore
        await reviewersPlugin.getUsersFromReviewersList(mockContext, ['one', 'two']);
      } catch (err) {
        assume(err).is.truthy();
        assume(err.message).equals('userExists error');
      }
    });

    it('properly gets filtered users from the reviewers list', async function () {
      userExistsStub.resolves({ status: 204 });
      userExistsStub.withArgs(sinon.match({
        username: 'Bob McNoEmail'
      })).resolves({ status: 404 });
      // @ts-ignore
      const users = await reviewersPlugin.getUsersFromReviewersList(mockContext, [
        'Joe Schmoe <jschmoe@test.com>',
        'John Doe <jdoe@test.com>',
        'Bob McNoEmail',
        {
          name: 'Hans Objectson',
          email: 'hobjectson@test.com'
        },
        {
          name: 'Billy ObjectNoEmailHeimer'
        },
        12345
      ]);
      assume(users).eqls([
        'jschmoe',
        'hobjectson'
      ]);
    });
  });
});
