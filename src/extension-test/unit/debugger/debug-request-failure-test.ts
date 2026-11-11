import * as expectLib from 'expect';
import { reportDebugRequestFailure } from '../../../../src/debugger/debug-request-failure';

describe('debug request failures', () => {
  it('keeps diagnostic details in the console and shows an actionable error', () => {
    const error = new Error('nREPL request rejected');
    const logged: Array<[string, unknown]> = [];
    const shown: string[] = [];

    reportDebugRequestFailure(
      'continue execution',
      error,
      (message, detail) => logged.push([message, detail]),
      (message) => shown.push(message)
    );

    expectLib.expect(logged).toEqual([['Calva debugger: failed to continue execution', error]]);
    expectLib
      .expect(shown)
      .toEqual(['Calva debugger: failed to continue execution: nREPL request rejected']);
  });

  it('converts non-Error rejections to readable user feedback', () => {
    const shown: string[] = [];

    reportDebugRequestFailure(
      'step in',
      'request failed',
      () => undefined,
      (message) => shown.push(message)
    );

    expectLib.expect(shown).toEqual(['Calva debugger: failed to step in: request failed']);
  });
});
