import * as expect from 'expect';
import * as completionUtil from '../../../src/providers/completion-util';

describe('Merging completion arrays', () => {
  it('it merges two empty arrays or completions', function () {
    expect(completionUtil.mergeCompletions([], [])).toStrictEqual([]);
  });
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
  it('it merges two populated arrays or completions, the second array wins with equal scores', function () {
    const completions1 = [
      { label: 'a', kind: 1, detail: 'foo', score: 0 },
      { label: 'b', kind: 2 },
    ];
    const completions2 = [
      { label: 'a', kind: 1, detail: 'bar', score: 0 },
      { label: 'c', kind: 3 },
    ];
    const mergedCompletions = [
      { label: 'a', kind: 1, detail: 'bar', score: 0 },
      { label: 'b', kind: 2 },
      { label: 'c', kind: 3 },
    ];
    expect(completionUtil.mergeCompletions(completions1, completions2)).toStrictEqual(
      mergedCompletions
    );
  });
  it('it merges two populated arrays or completions, the higher score wins', function () {
    const completions1 = [
      { label: 'a', kind: 1, detail: 'foo', score: 1 },
      { label: 'b', kind: 2, detail: 'foo', score: 0 },
      { label: 'd', kind: 4 },
    ];
    const completions2 = [
      { label: 'a', kind: 1, detail: 'bar', score: 0 },
      { label: 'b', kind: 2, detail: 'bar', score: 0 },
      { label: 'c', kind: 3 },
    ];
    const mergedCompletions = [
      { label: 'a', kind: 1, detail: 'foo', score: 1 },
      { label: 'b', kind: 2, detail: 'bar', score: 0 },
      { label: 'd', kind: 4 },
      { label: 'c', kind: 3 },
    ];
    expect(completionUtil.mergeCompletions(completions1, completions2)).toStrictEqual(
      mergedCompletions
    );
  });
});
