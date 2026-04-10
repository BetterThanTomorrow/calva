import { expect } from 'expect';
import * as connectSequenceInheritance from '../../../../src/nrepl/connect-sequence-inheritance';

describe('connect-sequence-inheritance', () => {
  describe('effectiveNReplPortFileSegments', () => {
    it('prefers the explicit connect sequence port file', () => {
      expect(
        connectSequenceInheritance.effectiveNReplPortFileSegments(
          { nReplPortFile: ['custom', '.nrepl-port'] },
          { defaultNReplPortFile: ['default', '.nrepl-port'] }
        )
      ).toStrictEqual(['custom', '.nrepl-port']);
    });

    it('inherits the project type default port file when sequence does not override it', () => {
      expect(
        connectSequenceInheritance.effectiveNReplPortFileSegments(
          {},
          { defaultNReplPortFile: ['default', '.nrepl-port'] }
        )
      ).toStrictEqual(['default', '.nrepl-port']);
    });

    it('returns undefined when neither sequence nor project type provides a port file', () => {
      expect(
        connectSequenceInheritance.effectiveNReplPortFileSegments({}, undefined)
      ).toBeUndefined();
    });

    it('returns a copy of the port file segments', () => {
      const projectTypeDefaults = { defaultNReplPortFile: ['default', '.nrepl-port'] };

      const resolvedPortFile = connectSequenceInheritance.effectiveNReplPortFileSegments(
        {},
        projectTypeDefaults
      );
      resolvedPortFile.push('mutated');

      expect(projectTypeDefaults.defaultNReplPortFile).toStrictEqual(['default', '.nrepl-port']);
    });
  });

  describe('effectiveFallbackPort', () => {
    it('prefers the explicit connect sequence fallback port', () => {
      expect(
        connectSequenceInheritance.effectiveFallbackPort(
          { fallbackPort: 4444 },
          { defaultFallbackPort: 3339 }
        )
      ).toBe(4444);
    });

    it('inherits the project type fallback port when sequence does not override it', () => {
      expect(
        connectSequenceInheritance.effectiveFallbackPort({}, { defaultFallbackPort: 3339 })
      ).toBe(3339);
    });

    it('returns undefined when neither sequence nor project type provides a fallback port', () => {
      expect(connectSequenceInheritance.effectiveFallbackPort({}, undefined)).toBeUndefined();
    });

    it('does not treat zero as undefined', () => {
      expect(connectSequenceInheritance.effectiveFallbackPort({ fallbackPort: 0 }, undefined)).toBe(
        0
      );
    });
  });
});
