import * as expect from 'expect';
import type { ResultsBuffer } from '../../../repl-window/repl-doc';
import * as util from '../../../results-output/util';

describe('addToHistory', () => {
  it('should push text to history array', () => {
    const history = [];
    const newHistory = util.addToHistory(history, 'hello');
    expect(newHistory[0]).toBe('hello');
  });
  it('should push text to history array without whitespace or eol characters', () => {
    const history = [];
    const newHistory = util.addToHistory(history, ' \t\nhello \r\n');
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
  it('should account for \\r\\n line endings', () => {
    const error = 'hello\r\nworld\r\n';
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
    const queue: ResultsBuffer = [
      {
        text: 'item-with-callback',
        onAppended: () => {
          // do nothing
        },
      },
      { text: 'item2' },
      { text: 'item3' },
    ];
    const [textBatch, remainingEditQueue] = util.splitEditQueueForTextBatching(queue);
    expect(textBatch).toHaveLength(0);
    expect(remainingEditQueue.map((x) => x.text)).toEqual(
      expect.arrayContaining(['item-with-callback', 'item2', 'item3'])
    );
  });
  it('batches only leading items with no callback', () => {
    const queue: ResultsBuffer = [
      { text: 'item1' },
      { text: 'item2' },
      {
        text: 'item3-with-callback',
        onAppended: () => {
          // do nothing
        },
      },
      { text: 'item4' },
    ];
    const [textBatch, remainingEditQueue] = util.splitEditQueueForTextBatching(queue);
    expect(textBatch).toEqual(expect.arrayContaining(['item1', 'item2']));
    expect(remainingEditQueue.map((x) => x.text)).toEqual(
      expect.arrayContaining(['item3-with-callback', 'item4'])
    );
  });
  it('correctly handles queue containing just items without callbacks', () => {
    const queue: ResultsBuffer = [{ text: 'item1' }, { text: 'item2' }];
    const [textBatch, remainingEditQueue] = util.splitEditQueueForTextBatching(queue);
    expect(textBatch).toEqual(expect.arrayContaining(['item1', 'item2']));
    expect(remainingEditQueue).toHaveLength(0);
  });
  it('respects maxBatchSize', () => {
    const queue: ResultsBuffer = [{ text: 'item1' }, { text: 'item2' }, { text: 'item3' }];

    const [textBatch, remainingEditQueue] = util.splitEditQueueForTextBatching(queue, 2);
    expect(textBatch).toEqual(expect.arrayContaining(['item1', 'item2']));
    expect(remainingEditQueue.map((x) => x.text)).toEqual(expect.arrayContaining(['item3']));
  });
});
