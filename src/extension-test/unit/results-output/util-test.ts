import { expect } from 'chai';
import * as util from '../../../results-output/util';

describe('repl-history', () => {
    describe('addToHistory', () => {
        it('should push text to history array', () => {
            const history = [];
            const newHistory = util.addToHistory(history, 'hello');
            expect(newHistory[0]).equal('hello');
        });
        it('should push text to history array without whitespace or eol characters', () => {
            const history = [];
            const newHistory = util.addToHistory(history, ' \t\nhello \n\r');
            expect(newHistory[0]).equal('hello');
        });
        it('should not push text to history array if empty string', () => {
            const history = [];
            const newHistory = util.addToHistory(history, '');
            expect(newHistory.length).equal(history.length);
        });
        it('should not push text to history array if same as last item in array', () => {
            const history = ['123'];
            const newHistory = util.addToHistory(history, '123');
            expect(newHistory.length).equal(history.length);
        });
        it('should not push null to history array', () => {
            const history = [];
            const newHistory = util.addToHistory(history, null);
            expect(newHistory.length).equal(history.length);
        });
    });
});