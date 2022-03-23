import * as expect from 'expect';
import { OnAppendedCallback } from '../../../results-output/results-doc';
import * as util from '../../../results-output/util';

describe('addToHistory', () => {
  it('should push text to history array', () => {
    const history = [];
    const newHistory = util.addToHistory(history, 'hello');
    expect(newHistory[0]).toBe('hello');
  });
  it('should push text to history array without whitespace or eol characters', () => {
    const history = [];
    const newHistory = util.addToHistory(history, ' \t\nhello \n\r');
    expect(newHistory[0]).toBe('hello');
  });
  it('should not push text to history array if empty string', () => {
    const history = [];
    const newHistory = util.addToHistory(history, '');
    expect(newHistory.length).toBe(history.length);
  });
  it('should not push text to history array if same as last item in array', () => {
    const history = ['123'];
    const newHistory = util.addToHistory(history, '123');
    expect(newHistory.length).toBe(history.length);
  });
  it('should not push null to history array', () => {
    const history = [];
    const newHistory = util.addToHistory(history, null);
    expect(newHistory.length).toBe(history.length);
  });
});

describe('formatAsLineComments', () => {
  it('should add "; " to beginning of each line that contains content', () => {
    const error = 'hello\nworld\n';
    const formattedError = util.formatAsLineComments(error);
    expect(formattedError).toBe('; hello\n; world');
  });
  it('should account for \\n\\r line endings', () => {
    const error = 'hello\n\rworld\n\r';
    const formattedError = util.formatAsLineComments(error);
    expect(formattedError).toBe('; hello\n; world');
  });
});

describe('splitEditQueueForTextBatching', () => {
  it('handles empty queue correctly', () => {
    const queue = [];
    const [textBatch, remainingEditQueue] = util.splitEditQueueForTextBatching(queue);
    expect(textBatch).toHaveLength(0);
    expect(remainingEditQueue).toHaveLength(0);
  });
  it("doesn't perform batching if first item has callback", () => {
    const queue: [string, OnAppendedCallback][] = [
      [
        'item-with-callback',
        () => {
          // do nothing
        },
      ],
      ['item2', null],
      ['item3', null],
    ];
    const [textBatch, remainingEditQueue] = util.splitEditQueueForTextBatching(queue);
    expect(textBatch).toHaveLength(0);
    expect(remainingEditQueue.map(([s]) => s)).toEqual(
      expect.arrayContaining(['item-with-callback', 'item2', 'item3'])
    );
  });
  it('batches only leading items with no callback', () => {
    const queue: [string, OnAppendedCallback][] = [
      ['item1', null],
      ['item2', null],
      [
        'item3-with-callback',
        () => {
          // do nothing
        },
      ],
      ['item4', null],
    ];
    const [textBatch, remainingEditQueue] = util.splitEditQueueForTextBatching(queue);
    expect(textBatch).toEqual(expect.arrayContaining(['item1', 'item2']));
    expect(remainingEditQueue.map(([s]) => s)).toEqual(
      expect.arrayContaining(['item3-with-callback', 'item4'])
    );
  });
  it('correctly handles queue containing just items without callbacks', () => {
    const queue: [string, OnAppendedCallback][] = [
      ['item1', null],
      ['item2', null],
    ];
    const [textBatch, remainingEditQueue] = util.splitEditQueueForTextBatching(queue);
    expect(textBatch).toEqual(expect.arrayContaining(['item1', 'item2']));
    expect(remainingEditQueue).toHaveLength(0);
  });
  it('respects maxBatchSize', () => {
    const queue: [string, OnAppendedCallback][] = [
      ['item1', null],
      ['item2', null],
      ['item3', null],
    ];
    const [textBatch, remainingEditQueue] = util.splitEditQueueForTextBatching(queue, 2);
    expect(textBatch).toEqual(expect.arrayContaining(['item1', 'item2']));
    expect(remainingEditQueue.map(([s]) => s)).toEqual(expect.arrayContaining(['item3']));
  });
});
