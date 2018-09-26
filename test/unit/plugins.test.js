const assume = require('assume');
const sinon = require('sinon');

const Plugins = require('../../lib/plugins');

describe('Plugins', () => {
  it('Exposes all plugins as an object', () => {
    assume(Plugins).is.a('function');
    const plugins = new Plugins({
      config: {
        get: sinon.stub().returns({})
      }
    });
    assume(plugins).is.instanceOf(Plugins);
    assume(plugins).contains('jira');
    assume(plugins).contains('requiredFile');
    assume(plugins).contains('reviewers');
  });
});
