const assume = require('assume');

const Utils = require('../../utils');

describe('Utils', () => {
  it('is an object', function () {
    assume(Utils).is.an('object');
  });

  describe('.parsePackageJson', function () {
    const mockPkg = {
      content: 'eyJmb28iOiAiYmFyIn0K',
      encoding: 'base64',
      url: 'mock',
      sha: 'mock',
      size: 1234
    };

    it('is a function', function () {
      assume(Utils.parsePackageJson).is.a('function');
      assume(Utils.parsePackageJson).has.length(1);
    });

    it('returns undefined when passed a falsey input', function () {
      assume(Utils.parsePackageJson(void 0)).does.not.exist();
    });

    it('returns undefined when passed an input without a content field', function () {
      // @ts-ignore
      assume(Utils.parsePackageJson({})).does.not.exist();
    });

    it('properly parses a base64-encoded JSON package', function () {
      assume(Utils.parsePackageJson(mockPkg)).eqls({
        foo: 'bar'
      });
    });
  });
});
