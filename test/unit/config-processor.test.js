const assume = require('assume');
const sinon = require('sinon');
const processConfig = require('../../config-processor');

/**
 * @typedef {Object} Plugin
 * @prop {string} plugin The name of the plugin
 * @prop {Object} [config] Arbitrary plugin-specific configuration
 */

const mergeConfigStub = sinon.stub();
const mockPluginManager = {
  one: {
    processesEdits: false,
    processRequest: async (context, commenter, config) => { void context; void commenter; void config; },
    mergeConfig: mergeConfigStub
  },
  two: {
    processesEdits: false,
    processRequest: async (context, commenter, config) => { void context; void commenter; void config; },
    mergeConfig: mergeConfigStub
  },
  three: {
    processesEdits: false,
    processRequest: async (context, commenter, config) => { void context; void commenter; void config; },
    mergeConfig: mergeConfigStub
  },
  four: {
    processesEdits: false,
    processRequest: async (context, commenter, config) => { void context; void commenter; void config; },
    mergeConfig: mergeConfigStub
  }
};

describe('processConfig', function () {
  it('is a function', function () {
    assume(processConfig).is.a('function');
    assume(processConfig).has.length(4);
  });

  it('returns the org config when no repo config is specified', function () {
    const orgConfig = {
      foo: 'bar',
      plugins: [
        'blah'
      ]
    };

    const processed = processConfig(mockPluginManager, orgConfig, null);
    // Not same object instance
    assume(processed).does.not.equal(orgConfig);
    assume(processed).deep.equals(orgConfig);
  });

  it('returns the org config when the repo config is an empty object', function () {
    const orgConfig = {
      foo: 'bar',
      plugins: [
        'blah'
      ]
    };

    const processed = processConfig(mockPluginManager, orgConfig, {});
    // Not same object instance
    assume(processed).does.not.equal(orgConfig);
    assume(processed).deep.equals(orgConfig);
  });

  it('merges properly when org config is not specified', function () {
    const repoConfig = {
      foo: 'rab',
      blah: {
        a: false,
        c: true
      },
      plugins: []
    };

    const processed = processConfig(mockPluginManager, null, repoConfig);
    // Not same object instance
    assume(processed).does.not.equal(repoConfig);
    assume(processed).deep.equals(repoConfig);
  });

  it('transforms an override-manifest-style repo config to a normal config when org config is not specified',
    function () {
      const repoConfig = {
        plugins: {
          include: [
            'one'
          ],
          exclude: [
            'fakePlugin'
          ]
        }
      };

      const processed = processConfig(mockPluginManager, null, repoConfig);

      assume(processed).deep.equals({
        plugins: [
          'one'
        ]
      });
    });

  it('deep merges fields other than plugins', function () {
    const orgConfig = {
      foo: 'bar',
      blah: {
        a: true,
        b: false
      },
      plugins: []
    };
    const repoConfig = {
      foo: 'rab',
      blah: {
        a: false,
        c: true
      },
      plugins: []
    };

    assume(processConfig(mockPluginManager, orgConfig, repoConfig)).deep.equals({
      foo: 'rab',
      blah: {
        a: false,
        b: false,
        c: true
      },
      plugins: []
    });
  });

  it('merges in a basic array of repo plugins', function () {
    const orgConfig = {
      plugins: [
        'one',
        'two'
      ]
    };

    const repoConfig = {
      plugins: [
        'two',
        'three'
      ]
    };

    assume(processConfig(mockPluginManager, orgConfig, repoConfig)).deep.equals({
      plugins: [
        'one',
        'two',
        'three'
      ]
    });
  });

  it('merges in an overrides-manifest-style repo plugins set that only has an include list', function () {
    const orgConfig = {
      plugins: [
        'one',
        'two'
      ]
    };

    const repoConfig = {
      plugins: {
        include: [
          'two',
          'three'
        ]
      }
    };

    assume(processConfig(mockPluginManager, orgConfig, repoConfig)).deep.equals({
      plugins: [
        'one',
        'two',
        'three'
      ]
    });
  });

  it('merges in an overrides-manifest-style repo plugins set that only has an exclude list', function () {
    const orgConfig = {
      plugins: [
        'one',
        'two'
      ]
    };

    const repoConfig = {
      plugins: {
        exclude: [
          'one',
          'four'
        ]
      }
    };

    assume(processConfig(mockPluginManager, orgConfig, repoConfig)).deep.equals({
      plugins: [
        'two'
      ]
    });
  });

  it('merges in an overrides-manifest-style repo plugins set', function () {
    const orgConfig = {
      plugins: [
        'one',
        'two'
      ]
    };

    const repoConfig = {
      plugins: {
        include: [
          'two',
          'three'
        ],
        exclude: [
          'one',
          'four'
        ]
      }
    };

    assume(processConfig(mockPluginManager, orgConfig, repoConfig)).deep.equals({
      plugins: [
        'two',
        'three'
      ]
    });
  });

  it('calls the onInvalidPlugin callback when an invalid plugin is encountered', function () {
    const orgConfig = {
      plugins: [
        'one',
        'two'
      ]
    };

    const repoConfig = {
      plugins: [
        'fake'
      ]
    };

    const onInvalidPluginStub = sinon.stub();
    processConfig(mockPluginManager, orgConfig, repoConfig, onInvalidPluginStub);
    assume(onInvalidPluginStub.calledWith('fake')).is.true();
  });

  describe('.applyIncludeList', function () {
    const applyIncludeList = processConfig._applyIncludeList;

    it('is a function', function () {
      assume(applyIncludeList).is.a('function');
      assume(applyIncludeList).has.length(1);
    });

    it('does not mutate the orgPlugins parameter', function () {
      const orgPlugins = [
        'one',
        'two'
      ];
      applyIncludeList({ pluginManager: mockPluginManager, orgPlugins, repoIncludeList: ['three'] });
      assume(orgPlugins).deep.equals([
        'one',
        'two'
      ]);
    });

    it('adds a plugin by name', function () {
      const orgPlugins = [
        'one',
        'two'
      ];
      assume(applyIncludeList({ pluginManager: mockPluginManager, orgPlugins, repoIncludeList: ['three'] })).deep.equals([
        'one',
        'two',
        'three'
      ]);
    });

    it('does nothing when a string plugin already exists', function () {
      const orgPlugins = [
        'one',
        'two'
      ];
      assume(applyIncludeList({ pluginManager: mockPluginManager, orgPlugins, repoIncludeList: ['two'] })).deep.equals([
        'one',
        'two'
      ]);
    });

    it('does not change an existing plugin object when listed by name in the include list', function () {
      const orgPlugins = [
        'one',
        {
          plugin: 'two',
          config: {
            foo: 'bar'
          }
        }
      ];
      assume(applyIncludeList({ pluginManager: mockPluginManager, orgPlugins, repoIncludeList: ['two'] })).deep.equals([
        'one',
        {
          plugin: 'two',
          config: {
            foo: 'bar'
          }
        }
      ]);
    });

    it('ignores non-string-nor-object plugins', function () {
      const orgPlugins = [
        'one',
        'two'
      ];
      // @ts-ignore
      assume(applyIncludeList({ pluginManager: mockPluginManager, orgPlugins, repoIncludeList: [123] })).deep.equals([
        'one',
        'two'
      ]);
    });

    it('ignores objects without a `plugin` field', function () {
      const orgPlugins = [
        'one',
        'two'
      ];
      // @ts-ignore
      assume(applyIncludeList({ pluginManager: mockPluginManager, orgPlugins, repoIncludeList: [{}] })).deep.equals([
        'one',
        'two'
      ]);
    });

    it('adds in object plugins that were not previously present', function () {
      const orgPlugins = [
        'one',
        'two'
      ];
      assume(applyIncludeList({ pluginManager: mockPluginManager, orgPlugins, repoIncludeList: [{
        plugin: 'three',
        config: {
          foo: 'bar'
        }
      }] })).deep.equals([
        'one',
        'two',
        {
          plugin: 'three',
          config: {
            foo: 'bar'
          }
        }
      ]);
    });

    it('replaces existing string plugins with new object plugins', function () {
      const orgPlugins = [
        'one',
        'two'
      ];
      assume(applyIncludeList({ pluginManager: mockPluginManager, orgPlugins, repoIncludeList: [{
        plugin: 'two',
        config: {
          foo: 'bar'
        }
      }] })).deep.equals([
        'one',
        {
          plugin: 'two',
          config: {
            foo: 'bar'
          }
        }
      ]);
    });

    it('replaces existing object plugins that have no config field', function () {
      const orgPlugins = [
        'one',
        {
          plugin: 'two',
          somethingElse: true
        }
      ];
      assume(applyIncludeList({ pluginManager: mockPluginManager, orgPlugins, repoIncludeList: [{
        plugin: 'two',
        config: {
          foo: 'bar'
        }
      }] })).deep.equals([
        'one',
        {
          plugin: 'two',
          config: {
            foo: 'bar'
          }
        }
      ]);
    });

    it('ignores object plugins that are not known by the plugin manager', function () {
      const orgPlugins = [
        {
          plugin: 'one',
          config: {
            foo: 'bar'
          }
        }
      ];
      const onInvalidPluginStub = sinon.stub();
      assume(applyIncludeList({ pluginManager: mockPluginManager, orgPlugins, repoIncludeList: [{
        plugin: 'unknownPlugin',
        config: {
          baz: 'blah'
        }
      },
      'anotherUnknownPlugin'], onInvalidPlugin: onInvalidPluginStub })).deep.equals([
        {
          plugin: 'one',
          config: {
            foo: 'bar'
          }
        }
      ]);
      assume(onInvalidPluginStub.calledWith('unknownPlugin')).is.true();
    });

    it('merges config of existing object plugins with new object', function () {
      /** @type {(string | Plugin)[]} */
      const orgPlugins = [
        'one',
        {
          plugin: 'two',
          config: {
            foo: 'bar',
            baz: 'blah'
          }
        }
      ];
      const repoIncludeList = [{
        plugin: 'two',
        config: {
          foo: 'rab',
          gah: 'meh'
        }
      }];
      applyIncludeList({ pluginManager: mockPluginManager, orgPlugins, repoIncludeList });

      const orgTwoConfig = /** @type {Plugin} */ (orgPlugins[1]).config;
      const repoTwoConfig = repoIncludeList[0].config;

      assume(mergeConfigStub.calledWithMatch(
        orgTwoConfig,
        repoTwoConfig
      )).is.true();
    });
  });

  describe('.applyExcludeList', function () {
    const applyExcludeList = processConfig._applyExcludeList;

    it('is a function', function () {
      assume(applyExcludeList).is.a('function');
      assume(applyExcludeList).has.length(1);
    });

    it('keeps all plugins in the list by default', function () {
      const orgPlugins = [
        'one',
        'two'
      ];
      assume(applyExcludeList({ orgPlugins, repoExcludeList: [] })).deep.equals(orgPlugins);
    });

    it('ignores invalid entries in the org plugin list and keeps plugins by default', function () {
      const orgPlugins = [
        'one',
        'two',
        123
      ];
      assume(applyExcludeList({ orgPlugins, repoExcludeList: [123] })).deep.equals(orgPlugins);
    });

    it('excludes plugins that are listed by name', function () {
      const orgPlugins = [
        'one',
        'two'
      ];
      assume(applyExcludeList({ orgPlugins, repoExcludeList: ['one'] })).deep.equals(['two']);
    });

    it('excludes plugins that are listed as objects', function () {
      const orgPlugins = [
        {
          plugin: 'one',
          config: {}
        },
        {
          plugin: 'two'
        }
      ];
      assume(applyExcludeList({ orgPlugins, repoExcludeList: ['one'] })).deep.equals([{ plugin: 'two' }]);
    });

    it('works properly with heterogeneous sets of org plugins', function () {
      const orgPlugins = [
        {
          plugin: 'one',
          config: {}
        },
        {
          plugin: 'two'
        },
        'three',
        'four'
      ];
      assume(applyExcludeList({ orgPlugins, repoExcludeList: ['one', 'three'] })).deep.equals([
        { plugin: 'two' }, 'four'
      ]);
    });
  });
});
