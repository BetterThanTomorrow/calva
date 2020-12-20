import * as expect from 'expect';
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