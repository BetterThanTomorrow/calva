import * as expect from 'expect';
import {
  computeGlobScore,
  toGlobMetadata,
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
        tier: 'always-claim',
        score: computeGlobScore('src/.joyride/**/*.cljs'),
      },
      {
        pattern: '**/*.clj',
        normalizedPattern: '**/*.clj',
        tier: 'is-fallback-for',
        score: computeGlobScore('**/*.clj'),
      },
    ]);
  });
});
