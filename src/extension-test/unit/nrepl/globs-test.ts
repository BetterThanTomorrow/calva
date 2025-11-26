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
      primary: ['src/.joyride/**/*.cljs'],
      secondary: ['**/*.clj'],
    };

    const metadata = toGlobMetadata(tiers);
    expect(metadata.globs).toEqual(['src/.joyride/**/*.cljs', '**/*.clj']);
    expect(metadata.globSpecs).toEqual([
      {
        pattern: 'src/.joyride/**/*.cljs',
        normalizedPattern: 'src/.joyride/**/*.cljs',
        tier: 'primary',
        score: computeGlobScore('src/.joyride/**/*.cljs'),
      },
      {
        pattern: '**/*.clj',
        normalizedPattern: '**/*.clj',
        tier: 'secondary',
        score: computeGlobScore('**/*.clj'),
      },
    ]);
  });
});
