import assume from 'assume';
import BasePlugin from '../../../plugins/base.js';

describe('Base plugin', function () {
  /** @type {BasePlugin} */
  let basePlugin;
  beforeEach(function () {
    basePlugin = new BasePlugin();
  });

  it('is a constructor', function () {
    assume(BasePlugin).is.a('function');
    assume(basePlugin).is.instanceOf(BasePlugin);
  });

  describe('.mergeConfig', function () {
    it('is a function', function () {
      assume(basePlugin.mergeConfig).is.a('function');
      assume(basePlugin.mergeConfig).has.length(2);
    });

    it('handles null base', function () {
      assume(basePlugin.mergeConfig(null, { foo: 'bar' })).deep.equals({
        foo: 'bar'
      });
    });

    it('handles null overrides', function () {
      assume(basePlugin.mergeConfig({ foo: 'bar' }, null)).deep.equals({
        foo: 'bar'
      });
    });

    it('shallow merges overrides over base', function () {
      assume(basePlugin.mergeConfig({ foo: 'bar', baz: 'blah' }, { foo: 'ack', woo: 'wah' })).deep.equals({
        foo: 'ack',
        baz: 'blah',
        woo: 'wah'
      });
    });
  });

  describe('.processesEdits', function () {
    it('is a getter', function () {
      const descriptor = Object.getOwnPropertyDescriptor(BasePlugin.prototype, 'processesEdits');
      assume(descriptor).hasOwn('get');
      assume(descriptor.get).is.a('function');
    });

    it('returns false', function () {
      assume(basePlugin.processesEdits).is.false();
    });
  });

  describe('.processesReadyForReview', function () {
    it('is a getter', function () {
      const descriptor = Object.getOwnPropertyDescriptor(BasePlugin.prototype, 'processesReadyForReview');
      assume(descriptor).hasOwn('get');
      assume(descriptor.get).is.a('function');
    });

    it('returns false', function () {
      assume(basePlugin.processesReadyForReview).is.false();
    });
  });

  describe('.processRequest', function () {
    it('is an async function', function () {
      assume(basePlugin.processRequest).is.an('asyncfunction');
      assume(basePlugin.processRequest).has.length(3);
    });

    it('throws since it is abstract', async function () {
      let rejected = false;
      try {
        await basePlugin.processRequest(null, null, null);
      } catch (err) {
        rejected = true;
        assume(err).is.truthy();
      }
      assume(rejected).is.true();
    });
  });
});
