const assume = require('assume');
const sinon = require('sinon');

const Plugins = require('../../plugins');

describe('Plugins', function () {
  it('Exposes all plugins as an object', function () {
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
