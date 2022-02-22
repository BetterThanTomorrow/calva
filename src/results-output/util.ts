import { takeWhile } from 'lodash';
import { OnAppendedCallback } from './results-doc';

function addToHistory(history: string[], content: string): string[] {
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

function formatAsLineComments(error: string): string {
    return `; ${error.trim().replace(/\n\r?/, '\n; ')}`;
}

function splitEditQueueForTextBatching(
    editQueue: [string, OnAppendedCallback][],
    maxBatchSize: number = 1000
): [string[], [string, OnAppendedCallback][]] {
    const textBatch = takeWhile(editQueue, (value, index) => {
        return index < maxBatchSize && !value[1];
    }).map((value) => value[0]);
    const remainingEditQueue = [...editQueue].slice(textBatch.length);
    return [textBatch, remainingEditQueue];
}

export { addToHistory, formatAsLineComments, splitEditQueueForTextBatching };
