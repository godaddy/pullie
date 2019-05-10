const assume = require('assume');

const Commenter = require('../../commenter');

describe('Commenter', function () {
  const commenter = new Commenter();

  it('is a constructor', function () {
    assume(Commenter).is.a('function');
    assume(Commenter).has.length(0);
    assume(commenter).is.instanceOf(Commenter);
  });

  describe('.priority', function () {
    it('is an enum', function () {
      assume(Commenter).hasOwn('priority');
      assume(Commenter.priority).has.length(3);
      assume(Commenter.priority).contains('Low');
      assume(Commenter.priority).contains('Medium');
      assume(Commenter.priority).contains('High');
      assume(Commenter.priority.Low).lt(Commenter.priority.Medium);
      assume(Commenter.priority.Medium).lt(Commenter.priority.High);
    });
  });

  describe('.addComment', function () {
    it('throws on empty message', function () {
      assume(() => commenter.addComment(null, Commenter.priority.Low)).throws();
    });

    it('throws on invalid priority', function () {
      // @ts-ignore
      assume(() => commenter.addComment('comment', 'Low')).throws();
      assume(() => commenter.addComment('comment', -1)).throws();
      assume(() => commenter.addComment('comment', 3)).throws();
    });

    it('Enqueues a comment properly', function () {
      assume(commenter.comments).has.length(0);
      commenter.addComment('comment', Commenter.priority.Low);
      assume(commenter.comments).has.length(1);
      const lastComment = commenter.comments.pop();
      assume(lastComment.msg).equals('comment');
      assume(lastComment.priority).equals(Commenter.priority.Low);
    });
  });

  describe('.flushToString', function () {
    it('bails when there are no queued comments', function () {
      assume(commenter.comments).has.length(0);
      assume(commenter.flushToString()).equals(null);
    });

    it('outputs a properly formatted comment', function () {
      commenter.addComment('comment', Commenter.priority.Low);
      assume(commenter.comments).has.length(1);
      assume(commenter.flushToString()).equals('comment');
      assume(commenter.comments).has.length(0);
    });

    it('outputs a sorted list of comments', function () {
      commenter.addComment('comment-low', Commenter.priority.Low);
      commenter.addComment('comment-high', Commenter.priority.High);
      commenter.addComment('comment-medium1', Commenter.priority.Medium);
      commenter.addComment('comment-medium2', Commenter.priority.Medium);
      assume(commenter.comments).has.length(4);
      assume(commenter.flushToString())
        .equals('comment-high\n\n---\n\ncomment-medium1\n\n---\n\ncomment-medium2\n\n---\n\ncomment-low');
      assume(commenter.comments).has.length(0);
    });
  });
});
