import assume from 'assume';

import * as Utils from '../../utils.js';

describe('Utils', function () {
  describe('.parseBase64Json', function () {
    const mockPkg = {
      content: 'eyJmb28iOiAiYmFyIn0K',
      encoding: 'base64',
      url: 'mock',
      sha: 'mock',
      size: 1234
    };

    it('is a function', function () {
      assume(Utils.parseBase64Json).is.a('function');
      assume(Utils.parseBase64Json).has.length(1);
    });

    it('returns undefined when passed a falsey input', function () {
      assume(Utils.parseBase64Json(void 0)).does.not.exist();
    });

    it('returns undefined when passed an input without a content field', function () {
      // @ts-ignore
      assume(Utils.parseBase64Json({})).does.not.exist();
    });

    it('properly parses a base64-encoded JSON package', function () {
      assume(Utils.parseBase64Json(mockPkg)).eqls({
        foo: 'bar'
      });
    });
  });
});
