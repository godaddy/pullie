import assume from 'assume';

import Plugins from '../../plugins/index.js';

describe('Plugins', function () {
  it('Exposes all plugins as an object', function () {
    assume(Plugins).is.a('function');
    const plugins = new Plugins();
    assume(plugins).is.instanceOf(Plugins);
    assume(plugins).contains('jira');
    assume(plugins).contains('requiredFile');
    assume(plugins).contains('reviewers');
    assume(plugins).contains('welcome');
  });
});
