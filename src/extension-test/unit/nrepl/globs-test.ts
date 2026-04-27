import * as expectLib from 'expect';
import * as globs from '../../../../src/nrepl/globs';

describe('glob scoring utilities', () => {
  it('penalizes broader globs compared to specific ones', () => {
    const specific = globs.computeGlobScore('src/app/components/**/*.clj');
    const generic = globs.computeGlobScore('**/*.clj');

    expectLib.expect(specific).toBeGreaterThan(generic);
  });

  it('produces glob specs with tier and normalized metadata', () => {
    const tiers: globs.SessionGlobTiers = {
      'always-claim': ['src/.joyride/**/*.cljs'],
      'is-fallback-for': ['**/*.clj'],
    };

    const metadata = globs.toGlobMetadata(tiers);
    expectLib.expect(metadata.globs).toEqual(['src/.joyride/**/*.cljs', '**/*.clj']);
    expectLib.expect(metadata.globSpecs).toEqual([
      {
        pattern: 'src/.joyride/**/*.cljs',
        normalizedPattern: 'src/.joyride/**/*.cljs',
        displayPattern: 'src/.joyride/**/*.cljs',
        tier: 'always-claim',
        score: globs.computeGlobScore('src/.joyride/**/*.cljs'),
      },
      {
        pattern: '**/*.clj',
        normalizedPattern: '**/*.clj',
        displayPattern: '**/*.clj',
        tier: 'is-fallback-for',
        score: globs.computeGlobScore('**/*.clj'),
      },
    ]);
  });
});

describe('file pattern to glob construction', () => {
  describe('normalizeProjectRoot', () => {
    it('normalizes POSIX path without trailing slash', () => {
      expectLib
        .expect(globs.normalizeProjectRoot('/Users/pez/my-project'))
        .toEqual('/Users/pez/my-project');
    });

    it('removes trailing slash', () => {
      expectLib
        .expect(globs.normalizeProjectRoot('/Users/pez/my-project/'))
        .toEqual('/Users/pez/my-project');
    });

    it('converts Windows path to POSIX', () => {
      expectLib
        .expect(globs.normalizeProjectRoot('C:\\Users\\pez\\my-project'))
        .toEqual('C:/Users/pez/my-project');
    });
  });

  describe('constructGlobsFromFilePatterns', () => {
    it('constructs full globs from simple file patterns', () => {
      const specs = globs.constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['*.clj'],
        'always-claim'
      );

      expectLib.expect(specs).toHaveLength(1);
      expectLib.expect(specs[0].pattern).toEqual('/workspace/my-app/**/*.clj');
      expectLib.expect(specs[0].displayPattern).toEqual('*.clj');
      expectLib.expect(specs[0].tier).toEqual('always-claim');
    });

    it('handles multiple file patterns', () => {
      const specs = globs.constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['*.clj', '*.edn'],
        'always-claim'
      );

      expectLib.expect(specs).toHaveLength(2);
      expectLib.expect(specs[0].pattern).toEqual('/workspace/my-app/**/*.clj');
      expectLib.expect(specs[1].pattern).toEqual('/workspace/my-app/**/*.edn');
    });

    it('handles path-based patterns', () => {
      const specs = globs.constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['scripts/*.clj'],
        'always-claim'
      );

      expectLib.expect(specs[0].pattern).toEqual('/workspace/my-app/**/scripts/*.clj');
    });

    it('returns empty array for empty patterns', () => {
      const specs = globs.constructGlobsFromFilePatterns('/workspace/my-app', [], 'always-claim');
      expectLib.expect(specs).toHaveLength(0);
    });

    it('returns empty array for empty project root', () => {
      const specs = globs.constructGlobsFromFilePatterns('', ['*.clj'], 'always-claim');
      expectLib.expect(specs).toHaveLength(0);
    });

    it('assigns correct tier to specs', () => {
      const claimSpecs = globs.constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['*.clj'],
        'always-claim'
      );
      const fallbackSpecs = globs.constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['*.cljs'],
        'is-fallback-for'
      );

      expectLib.expect(claimSpecs[0].tier).toEqual('always-claim');
      expectLib.expect(fallbackSpecs[0].tier).toEqual('is-fallback-for');
    });

    it('computes correct scores for constructed globs', () => {
      const specs = globs.constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['*.clj'],
        'always-claim'
      );

      // Score should be computed based on the full pattern
      expectLib
        .expect(specs[0].score)
        .toEqual(globs.computeGlobScore('/workspace/my-app/**/*.clj'));
    });

    it('preserves workspace-wide patterns without project root prefixing', () => {
      const specs = globs.constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['**/*.bb', '**/bb.edn'],
        'is-fallback-for'
      );

      expectLib.expect(specs).toHaveLength(2);
      // Patterns starting with **/ should NOT be prefixed with project root
      expectLib.expect(specs[0].pattern).toEqual('**/*.bb');
      expectLib.expect(specs[1].pattern).toEqual('**/bb.edn');
    });

    it('mixes project-scoped and workspace-wide patterns correctly', () => {
      const specs = globs.constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['*.clj', '**/*.bb'],
        'always-claim'
      );

      expectLib.expect(specs).toHaveLength(2);
      // Regular pattern gets project root prefix
      expectLib.expect(specs[0].pattern).toEqual('/workspace/my-app/**/*.clj');
      // Workspace-wide pattern stays as-is
      expectLib.expect(specs[1].pattern).toEqual('**/*.bb');
    });
  });

  describe('createCatchAllGlobSpec', () => {
    it('creates catch-all glob for project root', () => {
      const spec = globs.createCatchAllGlobSpec('/workspace/my-app');

      expectLib.expect(spec.pattern).toEqual('/workspace/my-app/**/*');
      expectLib.expect(spec.displayPattern).toEqual('**/*');
      expectLib.expect(spec.tier).toEqual('project-fallback');
    });

    it('handles trailing slash in project root', () => {
      const spec = globs.createCatchAllGlobSpec('/workspace/my-app/');

      expectLib.expect(spec.pattern).toEqual('/workspace/my-app/**/*');
    });

    it('computes correct score for catch-all glob', () => {
      const spec = globs.createCatchAllGlobSpec('/workspace/my-app');

      expectLib.expect(spec.score).toEqual(globs.computeGlobScore('/workspace/my-app/**/*'));
    });
  });
});
