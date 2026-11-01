import * as expectLib from 'expect';
import * as evaluatedCode from '../../../results-output/evaluated-code';

describe('endEvaluation', () => {
  it('ends the evaluation once in each Output view that shows its code', () => {
    const ended: [string, number][] = [];
    const end = (view: string, evaluationId: number) => ended.push([view, evaluationId]);
    evaluatedCode.showWhileRunning(41, 'output-view');
    evaluatedCode.showWhileRunning(41, 'output-sidebar');
    evaluatedCode.showWhileRunning(41, 'output-view');
    evaluatedCode.showWhileRunning(42, 'output-view');
    evaluatedCode.endEvaluation(41, end);
    evaluatedCode.endEvaluation(41, end);
    evaluatedCode.endEvaluation(42, end);
    expectLib.expect(ended).toEqual([
      ['output-view', 41],
      ['output-sidebar', 41],
      ['output-view', 42],
    ]);
  });

  it('ends nothing for an evaluation whose code no Output view shows', () => {
    const ended: [string, number][] = [];
    evaluatedCode.showWhileRunning(undefined, 'output-view');
    evaluatedCode.endEvaluation(43, (view, evaluationId) => ended.push([view, evaluationId]));
    evaluatedCode.endEvaluation(undefined, (view, evaluationId) =>
      ended.push([view, evaluationId])
    );
    expectLib.expect(ended).toEqual([]);
  });
});

describe('routeEvaluatedCode', () => {
  it('emits one evaluatedCode message while preserving metadata', () => {
    const messages: evaluatedCode.EvaluatedCodeMessage[] = [];
    const visibleWrites: evaluatedCode.VisibleEvaluatedCodeWrite[] = [];

    evaluatedCode.routeEvaluatedCode({
      code: '(inc 1)',
      didLastTerminateLine: true,
      ns: 'user',
      replSessionKey: 'clj',
      who: 'test-who',
      emit: (message) => messages.push(message),
      writeVisible: (write) => visibleWrites.push(write),
    });

    expectLib.expect(messages).toEqual([
      {
        category: 'evaluatedCode',
        text: '(inc 1)',
        who: 'test-who',
        ns: 'user',
        replSessionKey: 'clj',
      },
    ]);
    expectLib.expect(visibleWrites).toEqual([
      {
        code: '(inc 1)',
        didLastTerminateLine: true,
        outputCategory: 'evaluatedCode',
      },
    ]);
  });
});
