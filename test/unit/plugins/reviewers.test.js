import assume from 'assume';
import assumeSinon from 'assume-sinon';
import sinon from 'sinon';
import clone from 'clone-deep';

assume.use(assumeSinon);

import ReviewersPlugin from '../../../plugins/reviewers/index.js';
import Commenter from '../../../commenter.js';

const sandbox = sinon.createSandbox();
let requestReviewersStub;
let getFileContentsStub;
let userExistsStub;
let addCommentStub;
let commenter;

const reviewersPlugin = new ReviewersPlugin();

describe('ReviewersPlugin', function () {
  afterEach(function () {
    sandbox.restore();
  });

  let mockContext;

  beforeEach(function () {
    requestReviewersStub = sandbox.stub().resolves();
    getFileContentsStub = sandbox.stub().resolves({ status: 404 });
    userExistsStub = sandbox.stub().resolves({ status: 404 });
    addCommentStub = sandbox.stub();
    commenter = {
      addComment: addCommentStub,
      comments: null,
      flushToString: null
    };

    mockContext = {
      octokit: {
        pulls: {
          requestReviewers: requestReviewersStub
        },
        repos: {
          checkCollaborator: userExistsStub,
          getContent: getFileContentsStub
        }
      },
      issue() {
        return {
          ...this.repo(),
          number: 1234
        };
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
        action: 'opened',
        repository: {
          full_name: 'org/repo'
        },
        pull_request: {
          number: 1234,
          user: {
            login: 'jdoe'
          },
          draft: false
        }
      }
    };
  });

  it('is a constructor', function () {
    assume(ReviewersPlugin).is.a('function');
    assume(ReviewersPlugin).has.length(0);
    assume(reviewersPlugin).is.an('object');
  });

  it('does not process edits', function () {
    assume(reviewersPlugin.processesEdits).is.false();
  });

  it('processes "ready for review" actions', function () {
    assume(reviewersPlugin.processesReadyForReview).is.true();
  });

  describe('.processRequest', function () {
    it('is a function', function () {
      assume(reviewersPlugin.processRequest).is.an('asyncfunction');
      assume(reviewersPlugin.processRequest).has.length(3);
    });

    it('bails out if PR is a draft and requestForDrafts is false', async function () {
      const draftContext = clone(mockContext);
      draftContext.payload.pull_request.draft = true;

      const requestReviewsStub = sandbox.stub(reviewersPlugin, 'requestReviews');
      await reviewersPlugin.processRequest(draftContext, commenter, null);
      assume(requestReviewsStub).has.not.been.called();
    });

    it('requests reviews if PR is a draft and requestForDrafts is true', async function () {
      const draftContext = clone(mockContext);
      draftContext.payload.pull_request.draft = true;

      const requestReviewsStub = sandbox.stub(reviewersPlugin, 'requestReviews').resolves();
      await reviewersPlugin.processRequest(draftContext, commenter, {
        requestForDrafts: true,
        reviewers: ['foo'],
        howMany: 1
      });
      assume(requestReviewsStub).has.been.called();
    });

    it('requests reviews if PR is marked ready for review and requestForDrafts is false', async function () {
      const draftContext = clone(mockContext);
      draftContext.payload.action = 'ready_for_review';

      const requestReviewsStub = sandbox.stub(reviewersPlugin, 'requestReviews').resolves();
      await reviewersPlugin.processRequest(draftContext, commenter, {
        requestForDrafts: false,
        reviewers: ['foo'],
        howMany: 1
      });
      assume(requestReviewsStub).has.been.called();
    });

    it('bails out if PR is marked ready for review and requestForDrafts is true', async function () {
      // Since reviews would have already been requested when draft was opened
      const draftContext = clone(mockContext);
      draftContext.payload.action = 'ready_for_review';

      const requestReviewsStub = sandbox.stub(reviewersPlugin, 'requestReviews').resolves();
      await reviewersPlugin.processRequest(draftContext, commenter, {
        requestForDrafts: true,
        reviewers: ['foo'],
        howMany: 1
      });
      assume(requestReviewsStub).has.not.been.called();
    });

    it('bails out if getPackageJson returns an error', async function () {
      const mockError = new Error('mock error');
      sandbox.stub(reviewersPlugin, 'getPackageJson').rejects(mockError);
      try {
        // @ts-ignore
        await reviewersPlugin.processRequest(mockContext, commenter, null);
      } catch (err) {
        assume(err).equals(mockError);
      }
    });

    it('bails out if no package.json is found', async function () {
      sandbox.stub(reviewersPlugin, 'getPackageJson').resolves();
      // eslint-disable-next-line id-length
      const getAllPossibleReviewersSpy = sandbox.spy(reviewersPlugin, 'getAllPossibleReviewers');
      // @ts-ignore
      await reviewersPlugin.processRequest(mockContext, commenter, null);
      assume(getAllPossibleReviewersSpy).has.not.been.called();
    });

    it('properly passes package.json info to getAllPossibleReviewers and requestReviews', async () =>  {
      const mockPackageInfo = {};
      sandbox.stub(reviewersPlugin, 'getPackageJson')
        .resolves(mockPackageInfo);
      const mockReviewers = ['one', 'two'];
      // eslint-disable-next-line id-length
      const getAllPossibleReviewersStub = sandbox.stub(reviewersPlugin, 'getAllPossibleReviewers')
        .returns(mockReviewers);
      const requestReviewsStub = sandbox.stub(reviewersPlugin, 'requestReviews').resolves();

      // @ts-ignore
      await reviewersPlugin.processRequest(mockContext, commenter, null);
      assume(getAllPossibleReviewersStub).calledWithMatch(
        sinon.match.same(mockPackageInfo)
      );
      // @ts-ignore
      assume(requestReviewsStub).calledWithMatch(
        sinon.match.any,
        sinon.match.array.deepEquals(mockReviewers)
      );
    });

    it('skips loading candidate reviewers from package.json when reviewers are specified in config', async function () {
      const getPackageJsonStub = sandbox.stub(reviewersPlugin, 'getPackageJson');
      const mockReviewers = ['one', 'two'];
      const requestReviewsStub = sandbox.stub(reviewersPlugin, 'requestReviews').resolves();
      // @ts-ignore
      await reviewersPlugin.processRequest(mockContext, commenter, {
        reviewers: mockReviewers
      });
      assume(getPackageJsonStub).has.not.been.called();
      // @ts-ignore
      assume(requestReviewsStub).calledWithMatch(
        sinon.match.any,
        sinon.match.array.deepEquals(mockReviewers)
      );
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
      // @ts-ignore
      await reviewersPlugin.requestReviews({}, null, null, null, commenter);
      assume(getUsersFromReviewersListStub).has.not.been.called();
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
      }
    });

    it('bails out if no users are found to request review from', async function () {
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .resolves([]);
      // @ts-ignore
      await reviewersPlugin.requestReviews({}, ['one'], null, null, commenter);
      assume(getUsersFromReviewersListStub.called).is.true();
      assume(requestReviewersStub).has.not.been.called();
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
      // @ts-ignore
      await reviewersPlugin.requestReviews(mockContext, candidateReviewers, howManyRequested, null, commenter);
      assume(getUsersFromReviewersListStub).has.been.called();
      assume(requestReviewersStub).calledWithMatch({
        reviewers: sinon.match(value => { // eslint-disable-line max-nested-callbacks
          return value && Array.isArray(value) && value.length === howManyRequested &&
            value.every(r => { // eslint-disable-line max-nested-callbacks
              return candidateReviewers.includes(r);
            });
        })
      });
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
      // @ts-ignore
      await reviewersPlugin.requestReviews(mockContext, candidateReviewers, howManyRequested, null, commenter);
      assume(getUsersFromReviewersListStub).has.been.called();
      assume(requestReviewersStub).calledWithMatch({
        reviewers: sinon.match.array.contains(candidateReviewers).and(sinon.match(value => {
          return value.length === candidateReviewers.length;
        }))
      });
    });

    it('adds a comment listing requested reviewers when configured', async function () {
      const candidateReviewers = [
        'one',
        'two',
        'three'
      ];
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .resolves(candidateReviewers);
      // @ts-ignore
      await reviewersPlugin.requestReviews(mockContext, candidateReviewers, null, 'Some comment %s', commenter);
      assume(getUsersFromReviewersListStub).has.been.called();
      assume(addCommentStub).calledWithMatch('@one, @three, @two', Commenter.priority.Medium);
    });

    it('requests review from all candidate reviewers if howMany is not specified', async function () {
      const candidateReviewers = [
        'one',
        'two',
        'three'
      ];
      const getUsersFromReviewersListStub = sandbox.stub(reviewersPlugin, 'getUsersFromReviewersList')
        .resolves(candidateReviewers);
      // @ts-ignore
      await reviewersPlugin.requestReviews(mockContext, candidateReviewers, null, null, commenter);
      assume(getUsersFromReviewersListStub).has.been.called();
      assume(requestReviewersStub).calledWithMatch({
        reviewers: sinon.match.array.contains(candidateReviewers).and(sinon.match(value => {
          return value.length === candidateReviewers.length;
        }))
      });
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

    it('hands off the packaged file to parseBase64Json for parsing', async function () {
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
