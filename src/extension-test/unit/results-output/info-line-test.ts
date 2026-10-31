import * as expectLib from 'expect';
import * as infoLine from '../../../results-output/info-line';

describe('isInfoLineDue', () => {
  const context = { ns: 'user', replSessionType: 'clj', who: 'ui' };

  it('starts each evaluation in an unchanged context with an info line', () => {
    const first = infoLine.nextEvaluationId();
    infoLine.saveLastContext('info-line-test-1', { ...context, evaluationId: first });
    expectLib
      .expect(infoLine.isInfoLineDue('info-line-test-1', { ...context, evaluationId: first }))
      .toBe(false);
    expectLib
      .expect(
        infoLine.isInfoLineDue('info-line-test-1', {
          ...context,
          evaluationId: infoLine.nextEvaluationId(),
        })
      )
      .toBe(true);
  });

  it('shows output from no evaluation with an info line only when the context changed', () => {
    infoLine.saveLastContext('info-line-test-2', {
      ...context,
      evaluationId: infoLine.nextEvaluationId(),
    });
    infoLine.saveLastContext('info-line-test-2', context);
    expectLib.expect(infoLine.isInfoLineDue('info-line-test-2', context)).toBe(false);
    expectLib
      .expect(infoLine.isInfoLineDue('info-line-test-2', { ...context, ns: 'other' }))
      .toBe(true);
  });

  it('keeps the evaluation when output from no evaluation comes in between', () => {
    const evaluationId = infoLine.nextEvaluationId();
    infoLine.saveLastContext('info-line-test-3', { ...context, evaluationId });
    infoLine.saveLastContext('info-line-test-3', context);
    expectLib
      .expect(infoLine.isInfoLineDue('info-line-test-3', { ...context, evaluationId }))
      .toBe(false);
  });
});
