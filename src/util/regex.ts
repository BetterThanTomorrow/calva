import { trim } from 'lodash';

export const testCljOrJsRegex = (regexp: string, str: string) => {
  const clojureReMatches = regexp.match(/^#"(.*)"$/);
  const normalizedRe =
    (clojureReMatches && RegExp(clojureReMatches[1])) || RegExp(trim(regexp, '/'));
  return normalizedRe.test(str.replace(/^.*\//, ''));
};
