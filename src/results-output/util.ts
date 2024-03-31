import { takeWhile } from 'lodash';
import type { ResultsBuffer } from '../repl-window/repl-doc';

function addToHistory(history: string[], content?: string): string[] {
  if (content) {
    const entry = content.trim();
    if (entry !== '') {
      if (history.length === 0 || entry !== history[history.length - 1]) {
        return [...history, entry];
      }
    }
  }
  return history;
}

function formatAsLineComments(str: string): string {
  return `; ${str}`.replace(/\r?\n$/, '').replace(/\r?\n/g, '\n; ');
}

function splitEditQueueForTextBatching(
  editQueue: ResultsBuffer,
  maxBatchSize: number = 1000
): [string[], ResultsBuffer] {
  const nextBatch = takeWhile(editQueue, (value, index) => {
    return index < maxBatchSize && !value.onAppended;
  }).map((x) => x.text);
  const remainingEditQueue = [...editQueue].slice(nextBatch.length);
  return [nextBatch, remainingEditQueue];
}

export { addToHistory, formatAsLineComments, splitEditQueueForTextBatching };
