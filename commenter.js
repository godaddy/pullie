class Commenter {
  /**
   * Unified commenter module
   *
   * @constructor
   * @public
   */
  constructor() {
    this.comments = [];
  }

  /**
   * Add a comment to the queue
   *
   * @memberof Commenter
   * @public
   * @param {String} msg The message to post
   * @param {Commenter.priority} priority The priority of the comment
   */
  addComment(msg, priority) {
    if (!msg || typeof priority !== 'number' || priority < Commenter.priority.Low || priority > Commenter.priority.High) {
      throw new Error('Missing message or priority');
    }

    this.comments.push({
      msg,
      priority
    });
  }

  /**
   * Flush the comment queue to a sorted string
   *
   * @memberof Commenter
   * @public
   * @returns {String} All the queued comments, sorted by descending order, concatenated into a string with appropriate formatting
   */
  flushToString() {
    if (this.comments.length === 0) return null;

    this.comments.sort((a, b) => {
      return a.priority === b.priority ? 0 : a.priority > b.priority ? -1 : 1; // eslint-disable-line no-nested-ternary
    });

    const commentList = this.comments.map(c => c.msg).join('\n\n---\n\n');

    this.comments = [];

    return commentList;
  }
}

/**
 * Priority options to pass to `addComment`
 *
 * @enum {Number}
 * @readonly
 * @public
 */
Commenter.priority = {
  Low: 0,
  Medium: 1,
  High: 2
};

module.exports = Commenter;
