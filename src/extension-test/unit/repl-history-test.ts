import { expect } from 'chai';
import * as replHistory from '../../repl-history';

describe('repl-history', () => {
    describe('addToHistory', () => {
        it('push text to history array', () => {
            const history = [];
            const newHistory = replHistory.addToHistory(history, 'hello');
            expect(newHistory[0]).equal('hello');
        });
    });
});