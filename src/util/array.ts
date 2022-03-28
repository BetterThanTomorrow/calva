import _ = require('lodash');

export const replaceAt = <A>(array: A[], index: number, replacement: A): A[] => {
  return array
    .slice(0, index)
    .concat([replacement])
    .concat(array.slice(index + 1));
};

_.mixin({
  replaceAt,
});
