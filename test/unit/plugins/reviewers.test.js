const assume = require('assume');
const sinon = require('sinon');

assume.use(require('assume-sinon'));

const getReviewersPlugin = require('../../../lib/plugins/reviewers');
const Commenter = require('../../../lib/commenter');

const sandbox = sinon.createSandbox();
const requestReviewersStub = sandbox.stub().callsArgAsync(3);
const getFileContentsStub = sandbox.stub().callsArgAsync(2);
const parsePackageJsonStub = sandbox.stub().callsArgAsync(1);
const userExistsStub = sandbox.stub().callsArgAsync(1);
const addCommentStub = sandbox.stub();
const mockApp = {
  config: {
    get: sinon.stub()
  }
};
const mockApis = {
  commenter: {
    addComment: addCommentStub
  },
  github: {
    requestReviewers: requestReviewersStub,
    getFileContents: getFileContentsStub,
    parsePackageJson: parsePackageJsonStub,
    userExists: userExistsStub
  }
};

const reviewersPlugin = getReviewersPlugin(mockApp);

describe('ReviewersPlugin', () => {
  after(() => {
    sandbox.restore();
  });

  beforeEach(() => {
    sandbox.resetHistory();
  });

  it('is a generator function', () => {
    assume(getReviewersPlugin).is.a('function');
    assume(getReviewersPlugin).has.length(1);
    assume(reviewersPlugin).is.an('object');
  });

  const mockData = {
    repository: {
      full_name: 'org/repo'
    },
    pull_request: {
      number: 1234,
      user: {
        login: 'jdoe'
      }
    }
  };

  describe('.processRequest', () => {
    it('is a function', () => {
      assume(reviewersPlugin.processRequest).is.a('function');
      assume(reviewersPlugin.processRequest).has.length(4);
    });

    it('bails out if getPackageJson returns an error', (done) => {
      const mockError = new Error('mock error');
      const getPackageJsonStub = sandbox.stub(reviewersPlugin, 'getPackageJson').callsArgWithAsync(2, mockError);
      reviewersPlugin.processRequest(mockData, null, mockApis, (err) => {
        assume(err).equals(mockError);
        getPackageJsonStub.restore();
        done();
      });
    });

    it('bails out if no package.json is found', (done) => {
      const getPackageJsonStub = sandbox.stub(reviewersPlugin, 'getPackageJson').callsArgWithAsync(2, null, null);
      // eslint-disable-next-line id-length
      const getAllPossibleReviewersSpy = sandbox.spy(reviewersPlugin, 'getAllPossibleReviewers');
      reviewersPlugin.processRequest(mockData, null, mockApis, (err) => {
        assume(err).is.falsey();
        assume(getAllPossibleReviewersSpy).has.not.been.called();
        getPackageJsonStub.restore();
        getAllPossibleReviewersSpy.restore();
        done();
      });
    });

    it('properly passes package.json info to getAllPossibleReviewers and requestReviews', (done) =>  {
      const mockPackageInfo = {};
      const getPackageJsonStub = sandbox.stub(reviewersPlugin, 'getPackageJson')
        .callsArgWithAsync(2, null, mockPackageInfo);
      const mockReviewers = ['one', 'two'];
      // eslint-disable-next-line id-length
      const getAllPossibleReviewersStub = sandbox.stub(reviewersPlugin, 'getAllPossibleReviewers')
        .returns(mockReviewers);
      const requestReviewsStub = sandbox.stub(reviewersPlugin, 'requestReviews')
        .callsArgAsync(5);
      reviewersPlugin.processRequest(mockData, null, mockApis, (err) => {
        assume(err).is.falsey();
        assume(getAllPossibleReviewersStub).has.been.calledWithMatch(
          sinon.match.same(mockPackageInfo)
        );
        assume(requestReviewsStub).has.been.calledWithMatch(
          sinon.match.any,
          sinon.match.array.deepEquals(mockReviewers)
        );
        getPackageJsonStub.restore();
        getAllPossibleReviewersStub.restore();
        requestReviewsStub.restore();
        done();
      });
    });

    it('skips loading candidate reviewers from package.json when reviewers are specified in config', (done) => {
      const getPackageJsonStub = sandbox.stub(reviewersPlugin, 'getPackageJson');
      const mockReviewers = ['one', 'two'];
      const requestReviewsStub = sandbox.stub(reviewersPlugin, 'requestReviews')
        .callsArgAsync(5);
      reviewersPlugin.processRequest(mockData, {
        reviewers: mockReviewers
      }, mockApis, (err) => {
        assume(err).is.falsey();
        assume(getPackageJsonStub).has.not.been.called();
        assume(requestReviewsStub).has.been.calledWithMatch(
          sinon.match.any,
          sinon.match.array.deepEquals(mockReviewers)
        );
        getPackageJsonStub.restore();
        requestReviewsStub.restore();
        done();
      });
    });
  });

  describe('.getAllPossibleReviewers', () => {
    it('assembles the reviewers list from array contributors and maintainers fields, plus author in package.json', () => {
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

    it('assembles the reviewers list from string contributors, maintainers, and author fields in package.json', () => {
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

    it('assembles the reviewers list from a string author field in package.json', () => {
      assume(reviewersPlugin.getAllPossibleReviewers({
        author: 'one'
      })).deep.equals([
        'one'
      ]);
    });

    it('assembles the reviewers list from object fields in package.json', () => {
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

  describe('.requestReviews', () => {
    it('bails out if no reviewers are specified', (done) => {
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList');
      reviewersPlugin.requestReviews({}, null, null, null, null, () => {
        assume(getUsersFromReviewersListStub).has.not.been.called();
        getUsersFromReviewersListStub.restore();
        done();
      });
    });

    it('bails out if getUsersFromReviewersList returns an error', (done) => {
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .callsArgWithAsync(3, new Error('getUsersFromReviewersListError'));
      reviewersPlugin.requestReviews({}, [], null, null, null, (err) => {
        assume(getUsersFromReviewersListStub).has.been.called();
        assume(err).is.truthy();
        assume(err.message).equals('getUsersFromReviewersListError');
        getUsersFromReviewersListStub.restore();
        done();
      });
    });

    it('bails out if no users are found to request review from', (done) => {
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .callsArgWithAsync(3, null, []);
      reviewersPlugin.requestReviews({}, ['one'], null, null, null, () => {
        assume(getUsersFromReviewersListStub).has.been.called();
        assume(requestReviewersStub).has.not.been.called();
        getUsersFromReviewersListStub.restore();
        done();
      });
    });

    it('extracts a subset of candidate reviewers based on howMany parameter', (done) => {
      const candidateReviewers = [
        'one',
        'two',
        'three'
      ];
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .callsArgWithAsync(3, null, candidateReviewers);
      const howManyRequested = 2;
      reviewersPlugin.requestReviews({
        repository: {},
        pull_request: {}
      }, candidateReviewers, howManyRequested, null, mockApis, () => {
        assume(getUsersFromReviewersListStub).has.been.called();
        assume(requestReviewersStub).has.been.calledWithMatch(
          sinon.match.any,
          sinon.match.any,
          sinon.match(value => { // eslint-disable-line max-nested-callbacks
            return value && Array.isArray(value) && value.length === howManyRequested &&
              value.every(r => { // eslint-disable-line max-nested-callbacks
                return candidateReviewers.includes(r);
              });
          })
        );
        getUsersFromReviewersListStub.restore();
        done();
      });
    });

    it('requests review from all candidate reviewers if howMany > numCandidates', (done) => {
      const candidateReviewers = [
        'one',
        'two',
        'three'
      ];
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .callsArgWithAsync(3, null, candidateReviewers);
      const howManyRequested = 4;
      reviewersPlugin.requestReviews({
        repository: {},
        pull_request: {}
      }, candidateReviewers, howManyRequested, null, mockApis, () => {
        assume(getUsersFromReviewersListStub).has.been.called();
        assume(requestReviewersStub).has.been.calledWithMatch(
          sinon.match.any,
          sinon.match.any,
          // eslint-disable-next-line max-nested-callbacks
          sinon.match.array.contains(candidateReviewers).and(sinon.match(value => {
            return value.length === candidateReviewers.length;
          }))
        );
        getUsersFromReviewersListStub.restore();
        done();
      });
    });

    it('adds a comment listing requested reviewers when configured', (done) => {
      const candidateReviewers = [
        'one',
        'two',
        'three'
      ];
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .callsArgWithAsync(3, null, candidateReviewers);
      reviewersPlugin.requestReviews({
        repository: {},
        pull_request: {}
      }, candidateReviewers, null, 'Some comment %s', mockApis, () => {
        assume(getUsersFromReviewersListStub).has.been.called();
        assume(addCommentStub).has.been.calledWithMatch('@one, @three, @two', Commenter.priority.High);
        getUsersFromReviewersListStub.restore();
        done();
      });
    });

    it('requests review from all candidate reviewers if howMany is not specified', (done) => {
      const candidateReviewers = [
        'one',
        'two',
        'three'
      ];
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .callsArgWithAsync(3, null, candidateReviewers);
      reviewersPlugin.requestReviews({
        repository: {},
        pull_request: {}
      }, candidateReviewers, null, null, mockApis, () => {
        assume(getUsersFromReviewersListStub).has.been.called();
        assume(requestReviewersStub).has.been.calledWithMatch(
          sinon.match.any,
          sinon.match.any,
          // eslint-disable-next-line max-nested-callbacks
          sinon.match.array.contains(candidateReviewers).and(sinon.match(value => {
            return value.length === candidateReviewers.length;
          }))
        );
        getUsersFromReviewersListStub.restore();
        done();
      });
    });
  });

  describe('.getPackageJson', () => {
    it('is a function', () => {
      assume(reviewersPlugin.getPackageJson).is.a('function');
      assume(reviewersPlugin.getPackageJson).has.length(3);
    });

    it('bails out when package.json is missing', (done) => {
      getFileContentsStub.callsArgWithAsync(2, {
        statusCode: 404
      });
      reviewersPlugin.getPackageJson(mockData.repository, mockApis, (err) => {
        assume(err).is.falsey();
        assume(parsePackageJsonStub).has.not.been.called();
        done();
      });
    });

    it('bails out when an error is encountered attempting to fetch package.json', (done) => {
      const mockError = new Error('mock error');
      getFileContentsStub.callsArgWithAsync(2, mockError);
      reviewersPlugin.getPackageJson(mockData.repository, mockApis, (err) => {
        assume(err).equals(mockError);
        assume(parsePackageJsonStub).has.not.been.called();
        done();
      });
    });

    it('hands off the packaged file to githulk for parsing', (done) => {
      const mockPkg = {};
      getFileContentsStub.callsArgWithAsync(2, null, mockPkg);
      reviewersPlugin.getPackageJson(mockData.repository, mockApis, (err) => {
        assume(err).is.falsey();
        assume(parsePackageJsonStub).has.been.calledWith(mockPkg);
        done();
      });
    });
  });

  describe('.getUsersFromReviewersList', () => {
    it('is a function', () => {
      assume(reviewersPlugin.getUsersFromReviewersList).is.a('function');
      assume(reviewersPlugin.getUsersFromReviewersList).has.length(4);
    });

    it('bails out when reviewers is falsey', (done) => {
      reviewersPlugin.getUsersFromReviewersList(null, null, null, (err, users) => {
        assume(err).is.falsey();
        assume(users).is.falsey();
        done();
      });
    });

    it('bails out when reviewers is empty', (done) => {
      reviewersPlugin.getUsersFromReviewersList([], null, null, (err, users) => {
        assume(err).is.falsey();
        assume(users).is.falsey();
        done();
      });
    });

    it('passes through an error when userExists fails', (done) => {
      userExistsStub.callsArgWithAsync(1, new Error('userExists error'));
      reviewersPlugin.getUsersFromReviewersList(['one', 'two'], mockData.pull_request, mockApis, err => {
        assume(err).is.truthy();
        assume(err.message).equals('userExists error');
        done();
      });
    });

    it('properly gets filtered users from the reviewers list', (done) => {
      userExistsStub.callsArgWithAsync(1, null, true);
      userExistsStub.withArgs('Bob McNoEmail')
        .callsArgWithAsync(1, null, false);
      reviewersPlugin.getUsersFromReviewersList([
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
      ], mockData.pull_request, mockApis, (err, users) => {
        assume(err).is.falsey();
        assume(users).eqls([
          'jschmoe',
          'hobjectson'
        ]);
        done();
      });
    });
  });
});
