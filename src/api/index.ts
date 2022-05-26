import * as evaluate from './evaluate-code';

export function getApi() {
  return {
    v1: {
      evaluateCode: evaluate.evaluateCode,
    },
  };
}
