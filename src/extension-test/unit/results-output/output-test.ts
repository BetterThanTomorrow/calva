import * as expectLib from 'expect';
import * as evaluatedCode from '../../../results-output/evaluated-code';

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
        outputCategory: 'evalResults',
      },
    ]);
  });
});
