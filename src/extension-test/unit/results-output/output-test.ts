import { expect } from 'expect';
import {
  routeEvaluatedCode,
  type EvaluatedCodeMessage,
  type VisibleEvaluatedCodeWrite,
} from '../../../results-output/evaluated-code';

describe('routeEvaluatedCode', () => {
  it('emits one evaluatedCode message while preserving metadata', () => {
    const messages: EvaluatedCodeMessage[] = [];
    const visibleWrites: VisibleEvaluatedCodeWrite[] = [];

    routeEvaluatedCode({
      code: '(inc 1)',
      didLastTerminateLine: true,
      ns: 'user',
      replSessionKey: 'clj',
      who: 'test-who',
      emit: (message) => messages.push(message),
      writeVisible: (write) => visibleWrites.push(write),
    });

    expect(messages).toEqual([
      {
        category: 'evaluatedCode',
        text: '(inc 1)',
        who: 'test-who',
        ns: 'user',
        replSessionKey: 'clj',
      },
    ]);
    expect(visibleWrites).toEqual([
      {
        code: '(inc 1)',
        didLastTerminateLine: true,
        outputCategory: 'evalResults',
      },
    ]);
  });
});
