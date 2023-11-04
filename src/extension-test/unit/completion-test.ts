import * as expect from 'expect';
import * as completionUtil from '../../../src/providers/completion-util';

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
