import { trim } from 'lodash';

export const testCljOrJsRegex = (regexp: string, str: string) => {
  if (str.startsWith(':')) {
    // We don't want to match keywords
    // https://github.com/weavejester/cljfmt/issues/298
    return false;
  }
  const clojureReMatches = regexp.match(/^#"(.*)"$/);
  const normalizedRe =
    (clojureReMatches && RegExp(clojureReMatches[1])) || RegExp(trim(regexp, '/'));
  return normalizedRe.test(str.replace(/^.*\//, ''));
};
