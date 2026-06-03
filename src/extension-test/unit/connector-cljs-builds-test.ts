import * as expectLib from 'expect';
import * as cljsBuilds from '../../connector-cljs-builds';
import * as connectSeq from '../../nrepl/connect-sequence-types';

describe('connector-cljs-builds', () => {
  describe('isShadowCljsConnector', () => {
    it('returns true for shadow-cljs enum type', () => {
      expectLib
        .expect(cljsBuilds.isShadowCljsConnector(connectSeq.CljsTypes['shadow-cljs']))
        .toBe(true);
    });

    it('returns false for other enum types', () => {
      expectLib
        .expect(cljsBuilds.isShadowCljsConnector(connectSeq.CljsTypes['Figwheel Main']))
        .toBe(false);
      expectLib
        .expect(cljsBuilds.isShadowCljsConnector(connectSeq.CljsTypes['lein-figwheel']))
        .toBe(false);
      expectLib.expect(cljsBuilds.isShadowCljsConnector(connectSeq.CljsTypes.none)).toBe(false);
    });

    it('returns true for config object with name shadow-cljs', () => {
      const config: connectSeq.CljsTypeConfig = {
        name: 'shadow-cljs',
        isStarted: false,
        connectCode: '',
      };
      expectLib.expect(cljsBuilds.isShadowCljsConnector(config)).toBe(true);
    });

    it('returns true for config object with dependsOn shadow-cljs', () => {
      const config: connectSeq.CljsTypeConfig = {
        name: 'custom',
        dependsOn: connectSeq.CljsTypes['shadow-cljs'],
        isStarted: false,
        connectCode: '',
      };
      expectLib.expect(cljsBuilds.isShadowCljsConnector(config)).toBe(true);
    });

    it('returns false for config object without shadow-cljs reference', () => {
      const config: connectSeq.CljsTypeConfig = {
        name: 'figwheel-main',
        isStarted: false,
        connectCode: '',
      };
      expectLib.expect(cljsBuilds.isShadowCljsConnector(config)).toBe(false);
    });

    it('handles null and undefined gracefully', () => {
      expectLib.expect(cljsBuilds.isShadowCljsConnector(null as any)).toBe(false);
      expectLib.expect(cljsBuilds.isShadowCljsConnector(undefined as any)).toBe(false);
    });
  });

  describe('updateInitCode', () => {
    describe('with object-style initCode', () => {
      const initCode = {
        repl: '(start-repl %REPL%)',
        build: '(start-build %BUILD%)',
      };

      it('uses repl template for node-repl', () => {
        expectLib
          .expect(cljsBuilds.updateInitCode('node-repl', initCode))
          .toBe('(start-repl node-repl)');
      });

      it('uses repl template for browser-repl', () => {
        expectLib
          .expect(cljsBuilds.updateInitCode('browser-repl', initCode))
          .toBe('(start-repl browser-repl)');
      });

      it('uses build template for named builds, keywordizing the build', () => {
        expectLib.expect(cljsBuilds.updateInitCode('app', initCode)).toBe('(start-build :app)');
      });

      it('handles builds that already have colons', () => {
        expectLib.expect(cljsBuilds.updateInitCode(':app', initCode)).toBe('(start-build :app)');
      });
    });

    describe('with string-style initCode', () => {
      const initCode = '(connect %BUILD%)';

      it('replaces %BUILD% with quoted build name', () => {
        expectLib.expect(cljsBuilds.updateInitCode('app', initCode)).toBe('(connect "app")');
      });

      it('handles builds with colons', () => {
        expectLib.expect(cljsBuilds.updateInitCode(':app', initCode)).toBe('(connect ":app")');
      });
    });

    it('returns undefined when build is empty', () => {
      expectLib.expect(cljsBuilds.updateInitCode('', { repl: 'x', build: 'y' })).toBeUndefined();
    });

    it('returns undefined when build is falsy', () => {
      expectLib.expect(cljsBuilds.updateInitCode(null as any, 'code')).toBeUndefined();
    });
  });

  describe('parseClojureVectorResult', () => {
    it('parses keyword vector', () => {
      expectLib
        .expect(cljsBuilds.parseClojureVectorResult('[:app :app-too]'))
        .toEqual([':app', ':app-too']);
    });

    it('parses quoted string vector', () => {
      expectLib
        .expect(cljsBuilds.parseClojureVectorResult('[":app" ":app-too"]'))
        .toEqual([':app', ':app-too']);
    });

    it('handles empty vector', () => {
      expectLib.expect(cljsBuilds.parseClojureVectorResult('[]')).toEqual([]);
    });

    it('handles single element', () => {
      expectLib.expect(cljsBuilds.parseClojureVectorResult('[:app]')).toEqual([':app']);
    });

    it('handles empty string', () => {
      expectLib.expect(cljsBuilds.parseClojureVectorResult('')).toEqual([]);
    });

    it('handles null/undefined', () => {
      expectLib.expect(cljsBuilds.parseClojureVectorResult(null as any)).toEqual([]);
      expectLib.expect(cljsBuilds.parseClojureVectorResult(undefined as any)).toEqual([]);
    });

    it('handles extra whitespace', () => {
      expectLib
        .expect(cljsBuilds.parseClojureVectorResult('[  :app   :app-too  ]'))
        .toEqual([':app', ':app-too']);
    });
  });

  describe('getActiveBuildQueryCode', () => {
    it('returns shadow-cljs query for shadow-cljs type', () => {
      const code = cljsBuilds.getActiveBuildQueryCode('shadow-cljs');
      expectLib.expect(code).toContain('shadow.cljs.devtools.api/active-builds');
    });

    it('returns figwheel query for Figwheel Main type', () => {
      const code = cljsBuilds.getActiveBuildQueryCode('Figwheel Main');
      expectLib.expect(code).toContain('figwheel.main/build-registry');
    });

    it('returns undefined for unsupported types', () => {
      expectLib.expect(cljsBuilds.getActiveBuildQueryCode('lein-figwheel')).toBeUndefined();
      expectLib.expect(cljsBuilds.getActiveBuildQueryCode('none')).toBeUndefined();
    });
  });

  describe('normalizeBuildKey', () => {
    it('removes leading colon', () => {
      expectLib.expect(cljsBuilds.normalizeBuildKey(':app')).toBe('app');
    });

    it('leaves build without colon unchanged', () => {
      expectLib.expect(cljsBuilds.normalizeBuildKey('app')).toBe('app');
    });

    it('handles empty string', () => {
      expectLib.expect(cljsBuilds.normalizeBuildKey('')).toBe('');
    });
  });

  describe('buildRequiresWatcher', () => {
    it('returns false for node-repl', () => {
      expectLib.expect(cljsBuilds.buildRequiresWatcher('node-repl')).toBe(false);
      expectLib.expect(cljsBuilds.buildRequiresWatcher(':node-repl')).toBe(false);
    });

    it('returns false for browser-repl', () => {
      expectLib.expect(cljsBuilds.buildRequiresWatcher('browser-repl')).toBe(false);
      expectLib.expect(cljsBuilds.buildRequiresWatcher(':browser-repl')).toBe(false);
    });

    it('returns true for named builds', () => {
      expectLib.expect(cljsBuilds.buildRequiresWatcher('app')).toBe(true);
      expectLib.expect(cljsBuilds.buildRequiresWatcher(':app')).toBe(true);
      expectLib.expect(cljsBuilds.buildRequiresWatcher('frontend')).toBe(true);
    });
  });

  describe('isBuildActive', () => {
    it('returns true for node-repl regardless of active builds', () => {
      expectLib.expect(cljsBuilds.isBuildActive('node-repl', [])).toBe(true);
      expectLib.expect(cljsBuilds.isBuildActive('node-repl', [':app'])).toBe(true);
      expectLib.expect(cljsBuilds.isBuildActive('node-repl', undefined)).toBe(true);
    });

    it('returns true for browser-repl regardless of active builds', () => {
      expectLib.expect(cljsBuilds.isBuildActive('browser-repl', [])).toBe(true);
      expectLib.expect(cljsBuilds.isBuildActive('browser-repl', [':app'])).toBe(true);
    });

    it('returns true when activeBuilds is undefined (cannot determine)', () => {
      expectLib.expect(cljsBuilds.isBuildActive('app', undefined)).toBe(true);
    });

    it('returns true when build is in active builds list', () => {
      expectLib.expect(cljsBuilds.isBuildActive('app', [':app', ':test'])).toBe(true);
      expectLib.expect(cljsBuilds.isBuildActive(':app', ['app', 'test'])).toBe(true);
    });

    it('returns false when build is not in active builds list', () => {
      expectLib.expect(cljsBuilds.isBuildActive('app', [':test'])).toBe(false);
      expectLib.expect(cljsBuilds.isBuildActive(':app', [])).toBe(false);
    });

    it('handles colon normalization in comparison', () => {
      expectLib.expect(cljsBuilds.isBuildActive(':app', ['app'])).toBe(true);
      expectLib.expect(cljsBuilds.isBuildActive('app', [':app'])).toBe(true);
    });
  });
});
