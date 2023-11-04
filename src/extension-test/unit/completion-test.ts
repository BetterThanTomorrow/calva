import * as expect from 'expect';
import * as completionUtil from '../../../src/providers/completion-util';

describe('Padding arrays', () => {
  it('it pads an empty array to a length', function () {
    const length = 2;
    const aMap2 = Array.from({ length: length }).map(() => new Map());
    expect(completionUtil._padArray([], length)).toStrictEqual(aMap2);
  });
  it('it pads an arrays of one completion objects to a length', function () {
    const length = 2;
    const populatedMap = new Map([[['a', 1], { label: 'a', kind: 1 }]]);
    const expectedArray = [populatedMap, new Map()];
    expect(completionUtil._padArray([{ label: 'a', kind: 1 }], length)).toStrictEqual(
      expectedArray
    );
  });
  it('it leaves a arrays of length completion objects alone', function () {
    const length = 2;
    const expectedArray = [
      new Map([[['a', 1], { label: 'a', kind: 1 }]]),
      new Map([[['b', 2], { label: 'b', kind: 2 }]]),
    ];
    expect(
      completionUtil._padArray(
        [
          { label: 'a', kind: 1 },
          { label: 'b', kind: 2 },
        ],
        length
      )
    ).toStrictEqual(expectedArray);
  });
});

describe('Merging arrays', () => {
  it('it merges an empty and a populated array or completions', function () {
    const completions = [
      { label: 'a', kind: 1 },
      { label: 'b', kind: 2 },
    ];
    expect(completionUtil.mergeCompletions([], completions)).toStrictEqual(completions);
  });
  it('it merges a populated and empty array or completions', function () {
    const completions = [
      { label: 'a', kind: 1 },
      { label: 'b', kind: 2 },
    ];
    expect(completionUtil.mergeCompletions(completions, [])).toStrictEqual(completions);
  });
  it('it merges two populated arrays or completions', function () {
    const completions1 = [
      { label: 'a', kind: 1, detail: 'foo' },
      { label: 'b', kind: 2 },
    ];
    const completions2 = [
      { label: 'a', kind: 1, detail: 'bar' },
      { label: 'c', kind: 3 },
    ];
    const mergedCompletions = [
      { label: 'a', kind: 1, detail: 'bar' },
      { label: 'b', kind: 2 },
      { label: 'c', kind: 3 },
    ];
    expect(completionUtil.mergeCompletions(completions1, completions2)).toStrictEqual(
      mergedCompletions
    );
  });
});
