import * as expectLib from 'expect';
import * as logUtil from '../../api/log-util';

describe('repl-v1 log() validation', () => {
  it('maps evaluatedCode to evaluatedCode (same name)', () => {
    const result = logUtil.validateLogMessage({
      category: 'evaluatedCode',
      text: '(+ 1 2)',
      who: 'test-agent',
    });
    expectLib.expect(result).toBe('evaluatedCode');
  });

  it('maps evaluationResults to evalResults', () => {
    const result = logUtil.validateLogMessage({
      category: 'evaluationResults',
      text: '3',
      who: 'test-agent',
    });
    expectLib.expect(result).toBe('evalResults');
  });

  it('maps evaluationOutput to evalOut', () => {
    const result = logUtil.validateLogMessage({
      category: 'evaluationOutput',
      text: 'hello',
      who: 'test-agent',
    });
    expectLib.expect(result).toBe('evalOut');
  });

  it('maps evaluationErrorOutput to evalErr', () => {
    const result = logUtil.validateLogMessage({
      category: 'evaluationErrorOutput',
      text: 'boom',
      who: 'test-agent',
    });
    expectLib.expect(result).toBe('evalErr');
  });

  it('maps otherOutput to otherOut', () => {
    const result = logUtil.validateLogMessage({
      category: 'otherOutput',
      text: 'info',
      who: 'test-agent',
    });
    expectLib.expect(result).toBe('otherOut');
  });

  it('maps otherErrorOutput to otherErr', () => {
    const result = logUtil.validateLogMessage({
      category: 'otherErrorOutput',
      text: 'warn',
      who: 'test-agent',
    });
    expectLib.expect(result).toBe('otherErr');
  });

  it('throws on reserved who value "ui"', () => {
    expectLib
      .expect(() => {
        logUtil.validateLogMessage({ category: 'otherOutput', text: 'test', who: 'ui' });
      })
      .toThrow(/reserved/);
  });

  it('throws on reserved who value "api"', () => {
    expectLib
      .expect(() => {
        logUtil.validateLogMessage({ category: 'otherOutput', text: 'test', who: 'api' });
      })
      .toThrow(/reserved/);
  });

  it('throws on empty text', () => {
    expectLib
      .expect(() => {
        logUtil.validateLogMessage({ category: 'otherOutput', text: '', who: 'test-agent' });
      })
      .toThrow(/non-empty text/);
  });

  it('throws on unknown category', () => {
    expectLib
      .expect(() => {
        logUtil.validateLogMessage({ category: 'bogus', text: 'test', who: 'test-agent' });
      })
      .toThrow(/Unknown category/);
  });

  it('allows who to be omitted', () => {
    const result = logUtil.validateLogMessage({ category: 'otherOutput', text: 'no who' });
    expectLib.expect(result).toBe('otherOut');
  });

  it('apiCategoryToOutputCategory covers all 6 categories', () => {
    expectLib.expect(Object.keys(logUtil.apiCategoryToOutputCategory)).toHaveLength(6);
  });
});

describe('repl-v1 log() display', () => {
  it('requires a who', () => {
    expectLib.expect(() => logUtil.validateDisplayMessage({})).toThrow(/requires a who/);
    expectLib.expect(() => logUtil.validateDisplayMessage({ who: 'joyride' })).not.toThrow();
  });

  it('skips the REPL window and prints to the other destinations', () => {
    expectLib
      .expect(logUtil.splitDestinations(['repl-window', 'terminal', 'output-view', 'out.txt']))
      .toEqual({ printedTo: ['terminal', 'output-view', 'out.txt'], skipped: ['repl-window'] });
    expectLib.expect(logUtil.splitDestinations([])).toEqual({ printedTo: [], skipped: [] });
  });

  it('reads each category from its destination setting', () => {
    expectLib.expect(logUtil.outputCategoryToDestinationSetting).toEqual({
      evalResults: 'evalResults',
      evaluatedCode: 'evalResults',
      evalOut: 'evalOutput',
      evalErr: 'evalOutput',
      otherOut: 'otherOutput',
      otherErr: 'otherOutput',
    });
  });
});

describe('repl-v1 log() evaluations', () => {
  const tracker = () => {
    let lastId = 0;
    const ended: number[] = [];
    return {
      ended,
      evaluations: logUtil.createEvaluationTracker(
        () => ++lastId,
        (id) => ended.push(id)
      ),
    };
  };

  it('ends an evaluation when its promise resolves', async () => {
    const { ended, evaluations } = tracker();
    const evaluation = Promise.resolve(3);
    const id = evaluations.begin(evaluation);
    expectLib.expect(id).toBe(1);
    expectLib.expect(ended).toEqual([]);
    await evaluation;
    await Promise.resolve();
    expectLib.expect(ended).toEqual([1]);
  });

  it('ends an evaluation when its promise rejects', async () => {
    const { ended, evaluations } = tracker();
    const evaluation = Promise.reject(new Error('boom'));
    const id = evaluations.begin(evaluation);
    await evaluation.catch(() => undefined);
    await Promise.resolve();
    expectLib.expect(ended).toEqual([id]);
  });

  it('keeps an ended evaluation’s id for its output and result', async () => {
    const { evaluations } = tracker();
    const evaluation = Promise.resolve();
    const id = evaluations.begin(evaluation);
    expectLib.expect(evaluations.validId(id, 'evaluatedCode')).toBe(id);
    await evaluation;
    await Promise.resolve();
    expectLib.expect(evaluations.validId(id, 'evalResults')).toBe(id);
    expectLib.expect(evaluations.validId(id, 'evalErr')).toBe(id);
    expectLib.expect(evaluations.validId(id, 'evaluatedCode')).toBeUndefined();
  });

  it('drops an id it never issued', () => {
    const { evaluations } = tracker();
    expectLib.expect(evaluations.validId(42, 'evalResults')).toBeUndefined();
    expectLib.expect(evaluations.validId(undefined, 'evalOut')).toBeUndefined();
  });
});
