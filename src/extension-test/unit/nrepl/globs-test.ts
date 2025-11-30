import * as expect from 'expect';
import {
  computeGlobScore,
  toGlobMetadata,
  constructGlobsFromFilePatterns,
  createCatchAllGlobSpec,
  normalizeProjectRoot,
  type SessionGlobTiers,
} from '../../../../src/nrepl/globs';

describe('glob scoring utilities', () => {
  it('penalizes broader globs compared to specific ones', () => {
    const specific = computeGlobScore('src/app/components/**/*.clj');
    const generic = computeGlobScore('**/*.clj');

    expect(specific).toBeGreaterThan(generic);
  });

  it('produces glob specs with tier and normalized metadata', () => {
    const tiers: SessionGlobTiers = {
      'always-claim': ['src/.joyride/**/*.cljs'],
      'is-fallback-for': ['**/*.clj'],
    };

    const metadata = toGlobMetadata(tiers);
    expect(metadata.globs).toEqual(['src/.joyride/**/*.cljs', '**/*.clj']);
    expect(metadata.globSpecs).toEqual([
      {
        pattern: 'src/.joyride/**/*.cljs',
        normalizedPattern: 'src/.joyride/**/*.cljs',
        displayPattern: 'src/.joyride/**/*.cljs',
        tier: 'always-claim',
        score: computeGlobScore('src/.joyride/**/*.cljs'),
      },
      {
        pattern: '**/*.clj',
        normalizedPattern: '**/*.clj',
        displayPattern: '**/*.clj',
        tier: 'is-fallback-for',
        score: computeGlobScore('**/*.clj'),
      },
    ]);
  });
});

describe('file pattern to glob construction', () => {
  describe('normalizeProjectRoot', () => {
    it('normalizes POSIX path without trailing slash', () => {
      expect(normalizeProjectRoot('/Users/pez/my-project')).toEqual('/Users/pez/my-project');
    });

    it('removes trailing slash', () => {
      expect(normalizeProjectRoot('/Users/pez/my-project/')).toEqual('/Users/pez/my-project');
    });

    it('converts Windows path to POSIX', () => {
      expect(normalizeProjectRoot('C:\\Users\\pez\\my-project')).toEqual('C:/Users/pez/my-project');
    });
  });

  describe('constructGlobsFromFilePatterns', () => {
    it('constructs full globs from simple file patterns', () => {
      const specs = constructGlobsFromFilePatterns('/workspace/my-app', ['*.clj'], 'always-claim');

      expect(specs).toHaveLength(1);
      expect(specs[0].pattern).toEqual('/workspace/my-app/**/*.clj');
      expect(specs[0].displayPattern).toEqual('*.clj');
      expect(specs[0].tier).toEqual('always-claim');
    });

    it('handles multiple file patterns', () => {
      const specs = constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['*.clj', '*.edn'],
        'always-claim'
      );

      expect(specs).toHaveLength(2);
      expect(specs[0].pattern).toEqual('/workspace/my-app/**/*.clj');
      expect(specs[1].pattern).toEqual('/workspace/my-app/**/*.edn');
    });

    it('handles path-based patterns', () => {
      const specs = constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['scripts/*.clj'],
        'always-claim'
      );

      expect(specs[0].pattern).toEqual('/workspace/my-app/**/scripts/*.clj');
    });

    it('returns empty array for empty patterns', () => {
      const specs = constructGlobsFromFilePatterns('/workspace/my-app', [], 'always-claim');
      expect(specs).toHaveLength(0);
    });

    it('returns empty array for empty project root', () => {
      const specs = constructGlobsFromFilePatterns('', ['*.clj'], 'always-claim');
      expect(specs).toHaveLength(0);
    });

    it('assigns correct tier to specs', () => {
      const claimSpecs = constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['*.clj'],
        'always-claim'
      );
      const fallbackSpecs = constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['*.cljs'],
        'is-fallback-for'
      );

      expect(claimSpecs[0].tier).toEqual('always-claim');
      expect(fallbackSpecs[0].tier).toEqual('is-fallback-for');
    });

    it('computes correct scores for constructed globs', () => {
      const specs = constructGlobsFromFilePatterns('/workspace/my-app', ['*.clj'], 'always-claim');

      // Score should be computed based on the full pattern
      expect(specs[0].score).toEqual(computeGlobScore('/workspace/my-app/**/*.clj'));
    });

    it('preserves workspace-wide patterns without project root prefixing', () => {
      const specs = constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['**/*.bb', '**/bb.edn'],
        'is-fallback-for'
      );

      expect(specs).toHaveLength(2);
      // Patterns starting with **/ should NOT be prefixed with project root
      expect(specs[0].pattern).toEqual('**/*.bb');
      expect(specs[1].pattern).toEqual('**/bb.edn');
    });

    it('mixes project-scoped and workspace-wide patterns correctly', () => {
      const specs = constructGlobsFromFilePatterns(
        '/workspace/my-app',
        ['*.clj', '**/*.bb'],
        'always-claim'
      );

      expect(specs).toHaveLength(2);
      // Regular pattern gets project root prefix
      expect(specs[0].pattern).toEqual('/workspace/my-app/**/*.clj');
      // Workspace-wide pattern stays as-is
      expect(specs[1].pattern).toEqual('**/*.bb');
    });
  });

  describe('createCatchAllGlobSpec', () => {
    it('creates catch-all glob for project root', () => {
      const spec = createCatchAllGlobSpec('/workspace/my-app');

      expect(spec.pattern).toEqual('/workspace/my-app/**/*');
      expect(spec.displayPattern).toEqual('**/*');
      expect(spec.tier).toEqual('is-fallback-for');
    });

    it('handles trailing slash in project root', () => {
      const spec = createCatchAllGlobSpec('/workspace/my-app/');

      expect(spec.pattern).toEqual('/workspace/my-app/**/*');
    });

    it('computes correct score for catch-all glob', () => {
      const spec = createCatchAllGlobSpec('/workspace/my-app');

      expect(spec.score).toEqual(computeGlobScore('/workspace/my-app/**/*'));
    });
  });
});
