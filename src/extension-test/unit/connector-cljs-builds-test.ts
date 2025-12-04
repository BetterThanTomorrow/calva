import * as expect from 'expect';
import * as cljsBuilds from '../../connector-cljs-builds';
import * as connectSeq from '../../nrepl/connect-sequence-types';

describe('connector-cljs-builds', () => {
  describe('isShadowCljsReplType', () => {
    it('returns true for shadow-cljs enum type', () => {
      expect(cljsBuilds.isShadowCljsReplType(connectSeq.CljsTypes['shadow-cljs'])).toBe(true);
    });

    it('returns false for other enum types', () => {
      expect(cljsBuilds.isShadowCljsReplType(connectSeq.CljsTypes['Figwheel Main'])).toBe(false);
      expect(cljsBuilds.isShadowCljsReplType(connectSeq.CljsTypes['lein-figwheel'])).toBe(false);
      expect(cljsBuilds.isShadowCljsReplType(connectSeq.CljsTypes.none)).toBe(false);
    });

    it('returns true for config object with name shadow-cljs', () => {
      const config: connectSeq.CljsTypeConfig = {
        name: 'shadow-cljs',
        isStarted: false,
        connectCode: '',
      };
      expect(cljsBuilds.isShadowCljsReplType(config)).toBe(true);
    });

    it('returns true for config object with dependsOn shadow-cljs', () => {
      const config: connectSeq.CljsTypeConfig = {
        name: 'custom',
        dependsOn: connectSeq.CljsTypes['shadow-cljs'],
        isStarted: false,
        connectCode: '',
      };
      expect(cljsBuilds.isShadowCljsReplType(config)).toBe(true);
    });

    it('returns false for config object without shadow-cljs reference', () => {
      const config: connectSeq.CljsTypeConfig = {
        name: 'figwheel-main',
        isStarted: false,
        connectCode: '',
      };
      expect(cljsBuilds.isShadowCljsReplType(config)).toBe(false);
    });

    it('handles null and undefined gracefully', () => {
      expect(cljsBuilds.isShadowCljsReplType(null as any)).toBe(false);
      expect(cljsBuilds.isShadowCljsReplType(undefined as any)).toBe(false);
    });
  });

  describe('updateInitCode', () => {
    describe('with object-style initCode', () => {
      const initCode = {
        repl: '(start-repl %REPL%)',
        build: '(start-build %BUILD%)',
      };

      it('uses repl template for node-repl', () => {
        expect(cljsBuilds.updateInitCode('node-repl', initCode)).toBe('(start-repl node-repl)');
      });

      it('uses repl template for browser-repl', () => {
        expect(cljsBuilds.updateInitCode('browser-repl', initCode)).toBe(
          '(start-repl browser-repl)'
        );
      });

      it('uses build template for named builds, keywordizing the build', () => {
        expect(cljsBuilds.updateInitCode('app', initCode)).toBe('(start-build :app)');
      });

      it('handles builds that already have colons', () => {
        expect(cljsBuilds.updateInitCode(':app', initCode)).toBe('(start-build :app)');
      });
    });

    describe('with string-style initCode', () => {
      const initCode = '(connect %BUILD%)';

      it('replaces %BUILD% with quoted build name', () => {
        expect(cljsBuilds.updateInitCode('app', initCode)).toBe('(connect "app")');
      });

      it('handles builds with colons', () => {
        expect(cljsBuilds.updateInitCode(':app', initCode)).toBe('(connect ":app")');
      });
    });

    it('returns undefined when build is empty', () => {
      expect(cljsBuilds.updateInitCode('', { repl: 'x', build: 'y' })).toBeUndefined();
    });

    it('returns undefined when build is falsy', () => {
      expect(cljsBuilds.updateInitCode(null as any, 'code')).toBeUndefined();
    });
  });

  describe('parseClojureVectorResult', () => {
    it('parses keyword vector', () => {
      expect(cljsBuilds.parseClojureVectorResult('[:app :app-too]')).toEqual([':app', ':app-too']);
    });

    it('parses quoted string vector', () => {
      expect(cljsBuilds.parseClojureVectorResult('[":app" ":app-too"]')).toEqual([
        ':app',
        ':app-too',
      ]);
    });

    it('handles empty vector', () => {
      expect(cljsBuilds.parseClojureVectorResult('[]')).toEqual([]);
    });

    it('handles single element', () => {
      expect(cljsBuilds.parseClojureVectorResult('[:app]')).toEqual([':app']);
    });

    it('handles empty string', () => {
      expect(cljsBuilds.parseClojureVectorResult('')).toEqual([]);
    });

    it('handles null/undefined', () => {
      expect(cljsBuilds.parseClojureVectorResult(null as any)).toEqual([]);
      expect(cljsBuilds.parseClojureVectorResult(undefined as any)).toEqual([]);
    });

    it('handles extra whitespace', () => {
      expect(cljsBuilds.parseClojureVectorResult('[  :app   :app-too  ]')).toEqual([
        ':app',
        ':app-too',
      ]);
    });
  });

  describe('getActiveBuildQueryCode', () => {
    it('returns shadow-cljs query for shadow-cljs type', () => {
      const code = cljsBuilds.getActiveBuildQueryCode('shadow-cljs');
      expect(code).toContain('shadow.cljs.devtools.api/active-builds');
    });

    it('returns figwheel query for Figwheel Main type', () => {
      const code = cljsBuilds.getActiveBuildQueryCode('Figwheel Main');
      expect(code).toContain('figwheel.main/build-registry');
    });

    it('returns undefined for unsupported types', () => {
      expect(cljsBuilds.getActiveBuildQueryCode('lein-figwheel')).toBeUndefined();
      expect(cljsBuilds.getActiveBuildQueryCode('none')).toBeUndefined();
    });
  });

  describe('normalizeBuildKey', () => {
    it('removes leading colon', () => {
      expect(cljsBuilds.normalizeBuildKey(':app')).toBe('app');
    });

    it('leaves build without colon unchanged', () => {
      expect(cljsBuilds.normalizeBuildKey('app')).toBe('app');
    });

    it('handles empty string', () => {
      expect(cljsBuilds.normalizeBuildKey('')).toBe('');
    });
  });

  describe('buildRequiresWatcher', () => {
    it('returns false for node-repl', () => {
      expect(cljsBuilds.buildRequiresWatcher('node-repl')).toBe(false);
      expect(cljsBuilds.buildRequiresWatcher(':node-repl')).toBe(false);
    });

    it('returns false for browser-repl', () => {
      expect(cljsBuilds.buildRequiresWatcher('browser-repl')).toBe(false);
      expect(cljsBuilds.buildRequiresWatcher(':browser-repl')).toBe(false);
    });

    it('returns true for named builds', () => {
      expect(cljsBuilds.buildRequiresWatcher('app')).toBe(true);
      expect(cljsBuilds.buildRequiresWatcher(':app')).toBe(true);
      expect(cljsBuilds.buildRequiresWatcher('frontend')).toBe(true);
    });
  });

  describe('isBuildActive', () => {
    it('returns true for node-repl regardless of active builds', () => {
      expect(cljsBuilds.isBuildActive('node-repl', [])).toBe(true);
      expect(cljsBuilds.isBuildActive('node-repl', [':app'])).toBe(true);
      expect(cljsBuilds.isBuildActive('node-repl', undefined)).toBe(true);
    });

    it('returns true for browser-repl regardless of active builds', () => {
      expect(cljsBuilds.isBuildActive('browser-repl', [])).toBe(true);
      expect(cljsBuilds.isBuildActive('browser-repl', [':app'])).toBe(true);
    });

    it('returns true when activeBuilds is undefined (cannot determine)', () => {
      expect(cljsBuilds.isBuildActive('app', undefined)).toBe(true);
    });

    it('returns true when build is in active builds list', () => {
      expect(cljsBuilds.isBuildActive('app', [':app', ':test'])).toBe(true);
      expect(cljsBuilds.isBuildActive(':app', ['app', 'test'])).toBe(true);
    });

    it('returns false when build is not in active builds list', () => {
      expect(cljsBuilds.isBuildActive('app', [':test'])).toBe(false);
      expect(cljsBuilds.isBuildActive(':app', [])).toBe(false);
    });

    it('handles colon normalization in comparison', () => {
      expect(cljsBuilds.isBuildActive(':app', ['app'])).toBe(true);
      expect(cljsBuilds.isBuildActive('app', [':app'])).toBe(true);
    });
  });
});
