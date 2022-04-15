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

/**
 * Perhaps silly utility.
 * Designed to help out with when you must sort an array and then resort it back to its original order.
 *
 * First you `.map(mapToItemAndOrder)` the array, then you sort or order it however you want, after which you can simply resort it by
 *
 * , specifically where `map(mapToItemAndOrder) is followed up with with a sort operation on the result, using the `idx` (2nd return array item)
 */
export const mapToItemAndOrder = <A>(o: A, idx: number) => [o, idx] as [A, number];

export const mapToOriginalOrder = <A>([_o, idx]: [A, number]) => idx;

export const mapToOriginalItem = <A>([o]: [A, number]) => o;
