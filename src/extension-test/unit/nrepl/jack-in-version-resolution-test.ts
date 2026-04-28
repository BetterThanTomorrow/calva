import * as expectLib from 'expect';
import * as jackInVersionResolution from '../../../../src/nrepl/jack-in-version-resolution';

describe('jack-in version resolution', () => {
  describe('isPrereleaseVersion', () => {
    it('detects semver prereleases', () => {
      expectLib.expect(jackInVersionResolution.isPrereleaseVersion('1.6.0-alpha3')).toBe(true);
      expectLib.expect(jackInVersionResolution.isPrereleaseVersion('1.6.0-rc1')).toBe(true);
      expectLib.expect(jackInVersionResolution.isPrereleaseVersion('1.5.1')).toBe(false);
    });

    it('detects common non-semver prerelease tokens', () => {
      expectLib
        .expect(jackInVersionResolution.isPrereleaseVersion('2025.10.1-SNAPSHOT'))
        .toBe(true);
      expectLib.expect(jackInVersionResolution.isPrereleaseVersion('2.0.0-preview')).toBe(true);
    });
  });

  describe('selectLatestStableAndPrerelease', () => {
    it('returns latest stable and prerelease from mixed candidates', () => {
      const versions = ['1.5.4', '1.6.0-alpha3', '1.5.3', '1.6.0-beta1', '1.6.0-alpha1'];

      const result = jackInVersionResolution.selectLatestStableAndPrerelease(versions);

      expectLib.expect(result).toStrictEqual({ stable: '1.5.4', prerelease: '1.6.0-beta1' });
    });

    it('returns only stable when no prerelease exists', () => {
      const result = jackInVersionResolution.selectLatestStableAndPrerelease(['1.4.0', '1.3.9']);

      expectLib.expect(result).toStrictEqual({ stable: '1.4.0', prerelease: undefined });
    });

    it('returns only prerelease when no stable exists', () => {
      const result = jackInVersionResolution.selectLatestStableAndPrerelease([
        '1.6.0-alpha1',
        '1.6.0-alpha3',
      ]);

      expectLib.expect(result).toStrictEqual({ stable: undefined, prerelease: '1.6.0-alpha3' });
    });
  });
});
