export interface AutoEvaluateCodeConfig {
  onConnect: {
    clj: string | null;
    cljs: string | null;
  };
  onFileLoaded: {
    clj: string | null;
    cljs: string | null;
  };
}

/**
 * Merges an array of AutoEvaluateCodeConfig objects, respecting their default values and overriding rules.
 * Generally we want to evaluate all code that is configured, so we generally concatenate all non-null strings.
 * However, we also want the allow disabling the evaluation all together by setting the value to `null`.
 *
 * @param configs An array of AutoEvaluateCodeConfig objects to be merged.
 * @param defaultConfig The default AutoEvaluateCodeConfig object containing default values for each property.
 * @returns The merged AutoEvaluateCodeConfig object resulting from the combination of the provided configs and default config.
 */
export function mergeAutoEvaluateConfigs(
  configs: AutoEvaluateCodeConfig[],
  defaultConfig: AutoEvaluateCodeConfig
): AutoEvaluateCodeConfig {
  return configs.reduce<AutoEvaluateCodeConfig>((merged, config) => {
    if (config) {
      for (const key of ['onConnect', 'onFileLoaded'] as const) {
        for (const lang of ['clj', 'cljs'] as const) {
          const defaultValue = defaultConfig[key][lang];
          const currentValue = config[key][lang];
          const mergedValue = merged[key][lang];
          if (currentValue === null) {
            merged[key][lang] = null;
          } else if (currentValue !== defaultValue) {
            merged[key][lang] =
              mergedValue === null || mergedValue === defaultValue
                ? currentValue
                : `${mergedValue}\n${currentValue}`;
          }
        }
      }
    }
    return merged;
  }, JSON.parse(JSON.stringify(defaultConfig)));
}
