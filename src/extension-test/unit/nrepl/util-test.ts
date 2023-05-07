import * as expect from 'expect';
import * as fc from 'fast-check';
import * as nreplUtil from '../../../../src/nrepl/util';

const defaults: nreplUtil.AutoEvaluateCodeConfig = {
  onConnect: {
    clj: 'clj',
    cljs: 'cljs',
  },
  onFileLoaded: {
    clj: null,
    cljs: null,
  },
};

const createCustomConfig = (custom: string): nreplUtil.AutoEvaluateCodeConfig => ({
  onConnect: {
    clj: custom,
    cljs: custom,
  },
  onFileLoaded: {
    clj: custom,
    cljs: custom,
  },
});

describe('config', () => {
  describe('mergeAutoEvaluateConfigs', () => {
    it('Keeps defaults if no config overrides', () => {
      expect(
        nreplUtil.mergeAutoEvaluateConfigs([defaults, defaults, defaults], defaults)
      ).toStrictEqual(defaults);
    });

    it('Keeps defaults if no config overrides, also if a config is undefined', () => {
      expect(
        nreplUtil.mergeAutoEvaluateConfigs([defaults, defaults, undefined], defaults)
      ).toStrictEqual(defaults);
    });

    it('Overrides default string with null value', () => {
      const configs: nreplUtil.AutoEvaluateCodeConfig[] = [
        { ...defaults, onConnect: { clj: null, cljs: null } },
        { ...defaults, onConnect: { clj: null, cljs: null } },
      ];
      const expectedResult: nreplUtil.AutoEvaluateCodeConfig = {
        ...defaults,
        onConnect: { clj: null, cljs: null },
      };
      expect(nreplUtil.mergeAutoEvaluateConfigs(configs, defaults)).toStrictEqual(expectedResult);
    });

    it('Concatenates non-default strings and disregards default strings', () => {
      const configs: nreplUtil.AutoEvaluateCodeConfig[] = [
        { ...defaults, onConnect: { clj: 'custom1', cljs: 'custom1' } },
        { ...defaults, onConnect: { clj: 'clj', cljs: 'custom2' } },
      ];
      const expectedResult: nreplUtil.AutoEvaluateCodeConfig = {
        ...defaults,
        onConnect: { clj: 'custom1', cljs: 'custom1\ncustom2' },
      };
      expect(nreplUtil.mergeAutoEvaluateConfigs(configs, defaults)).toStrictEqual(expectedResult);
    });

    it('Concatenates all strings when default value is null', () => {
      const configs: nreplUtil.AutoEvaluateCodeConfig[] = [
        { ...defaults, onFileLoaded: { clj: 'custom1', cljs: 'custom1' } },
        { ...defaults, onFileLoaded: { clj: 'custom2', cljs: 'custom2' } },
      ];
      const expectedResult: nreplUtil.AutoEvaluateCodeConfig = {
        ...defaults,
        onFileLoaded: { clj: 'custom1\ncustom2', cljs: 'custom1\ncustom2' },
      };
      expect(nreplUtil.mergeAutoEvaluateConfigs(configs, defaults)).toStrictEqual(expectedResult);
    });

    it('Overrides null default value with string value', () => {
      const configs: nreplUtil.AutoEvaluateCodeConfig[] = [
        { ...defaults, onFileLoaded: { clj: 'custom1', cljs: null } },
        { ...defaults, onFileLoaded: { clj: null, cljs: 'custom2' } },
      ];
      const expectedResult: nreplUtil.AutoEvaluateCodeConfig = {
        ...defaults,
        onFileLoaded: { clj: null, cljs: 'custom2' },
      };
      expect(nreplUtil.mergeAutoEvaluateConfigs(configs, defaults)).toStrictEqual(expectedResult);
    });

    it('Ignores null values when default value is null', () => {
      const configs: nreplUtil.AutoEvaluateCodeConfig[] = [
        { ...defaults, onFileLoaded: { clj: 'custom1', cljs: null } },
        { ...defaults, onFileLoaded: { clj: null, cljs: null } },
      ];

      const expectedResult: nreplUtil.AutoEvaluateCodeConfig = {
        ...defaults,
        onFileLoaded: { clj: null, cljs: null },
      };

      expect(nreplUtil.mergeAutoEvaluateConfigs(configs, defaults)).toStrictEqual(expectedResult);
    });

    it('Concatenates all non-default strings, generated', () => {
      const nonDefaultString = (defaultString: string) =>
        fc.string().filter((s) => s !== defaultString);
      fc.assert(
        fc.property(
          nonDefaultString(defaults.onConnect.clj),
          nonDefaultString(defaults.onConnect.cljs),
          nonDefaultString(defaults.onFileLoaded.clj),
          (custom1, custom2, custom3) => {
            const config1 = createCustomConfig(custom1);
            const config2 = createCustomConfig(custom2);
            const config3 = createCustomConfig(custom3);

            const merged = nreplUtil.mergeAutoEvaluateConfigs(
              [config1, config2, config3],
              defaults
            );

            const expectedOnFileLoaded = [custom1, custom2, custom3].join('\n');
            const expectedOnConnectClj = [custom1, custom2, custom3].join('\n');
            const expectedOnConnectCljs = [custom1, custom2, custom3].join('\n');
            expect(merged.onFileLoaded.clj).toEqual(expectedOnFileLoaded);
            expect(merged.onFileLoaded.cljs).toEqual(expectedOnFileLoaded);
            expect(merged.onConnect.clj).toEqual(expectedOnConnectClj);
            expect(merged.onConnect.cljs).toEqual(expectedOnConnectCljs);
          }
        )
      );
    });
  });
});
