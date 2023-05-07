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
 *
 * The function takes the following rules into account when merging configurations:
 *
 * 1. If the default value is a string:
 *    a. A `null` value in a config should override the merged value, essentially setting the merged value to `null`.
 *    b. If the config value is a non-null string and not equal to the default value, it should be concatenated to the merged value.
 *    c. If the config value is equal to the default value, it should be disregarded and not concatenated.
 *
 * 2. If the default value is `null`:
 *    a. A `null` value in a config should be disregarded.
 *    b. A non-null string value in a config should be concatenated to the merged value.
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

          if (defaultValue === null) {
            if (currentValue !== null) {
              merged[key][lang] =
                mergedValue === null ? currentValue : `${mergedValue}\n${currentValue}`;
            }
          } else {
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
    }
    return merged;
  }, JSON.parse(JSON.stringify(defaultConfig)));
}
