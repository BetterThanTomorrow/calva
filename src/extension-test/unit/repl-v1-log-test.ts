import * as expectLib from 'expect';
import { validateLogMessage, apiCategoryToOutputCategory } from '../../api/log-util';

describe('repl-v1 log() validation', () => {
  it('maps evaluatedCode to evaluatedCode (same name)', () => {
    const result = validateLogMessage({
      category: 'evaluatedCode',
      text: '(+ 1 2)',
      who: 'test-agent',
    });
    expectLib.expect(result).toBe('evaluatedCode');
  });

  it('maps evaluationResults to evalResults', () => {
    const result = validateLogMessage({
      category: 'evaluationResults',
      text: '3',
      who: 'test-agent',
    });
    expectLib.expect(result).toBe('evalResults');
  });

  it('maps evaluationOutput to evalOut', () => {
    const result = validateLogMessage({
      category: 'evaluationOutput',
      text: 'hello',
      who: 'test-agent',
    });
    expectLib.expect(result).toBe('evalOut');
  });

  it('maps evaluationErrorOutput to evalErr', () => {
    const result = validateLogMessage({
      category: 'evaluationErrorOutput',
      text: 'boom',
      who: 'test-agent',
    });
    expectLib.expect(result).toBe('evalErr');
  });

  it('maps otherOutput to otherOut', () => {
    const result = validateLogMessage({
      category: 'otherOutput',
      text: 'info',
      who: 'test-agent',
    });
    expectLib.expect(result).toBe('otherOut');
  });

  it('maps otherErrorOutput to otherErr', () => {
    const result = validateLogMessage({
      category: 'otherErrorOutput',
      text: 'warn',
      who: 'test-agent',
    });
    expectLib.expect(result).toBe('otherErr');
  });

  it('throws on reserved who value "ui"', () => {
    expectLib
      .expect(() => {
        validateLogMessage({ category: 'otherOutput', text: 'test', who: 'ui' });
      })
      .toThrow(/reserved/);
  });

  it('throws on reserved who value "api"', () => {
    expectLib
      .expect(() => {
        validateLogMessage({ category: 'otherOutput', text: 'test', who: 'api' });
      })
      .toThrow(/reserved/);
  });

  it('throws on empty text', () => {
    expectLib
      .expect(() => {
        validateLogMessage({ category: 'otherOutput', text: '', who: 'test-agent' });
      })
      .toThrow(/non-empty text/);
  });

  it('throws on unknown category', () => {
    expectLib
      .expect(() => {
        validateLogMessage({ category: 'bogus', text: 'test', who: 'test-agent' });
      })
      .toThrow(/Unknown category/);
  });

  it('allows who to be omitted', () => {
    const result = validateLogMessage({ category: 'otherOutput', text: 'no who' });
    expectLib.expect(result).toBe('otherOut');
  });

  it('apiCategoryToOutputCategory covers all 6 categories', () => {
    expectLib.expect(Object.keys(apiCategoryToOutputCategory)).toHaveLength(6);
  });
});
