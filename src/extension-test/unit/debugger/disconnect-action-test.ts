import * as expectLib from 'expect';
import { advanceAfterDisconnect } from '../../../../src/debugger/disconnect-action';

describe('debugger disconnect action', () => {
  it('responds before advancing one form in nREPL', async () => {
    const calls: string[] = [];
    const session = {
      sendDebugInput: (input: string, id: string, key: string) => {
        calls.push(`input:${input}:${id}:${key}`);
        return Promise.resolve();
      },
    };

    advanceAfterDisconnect(
      session,
      'response-id',
      'response-key',
      () => calls.push('response'),
      (error) => calls.push(`error:${String(error)}`)
    );

    expectLib.expect(calls).toEqual(['response']);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expectLib.expect(calls).toEqual(['response', 'input::next:response-id:response-key']);
  });

  it('reports an nREPL advance failure without changing the response order', async () => {
    const calls: string[] = [];
    const session = {
      sendDebugInput: () => Promise.reject(new Error('nREPL unavailable')),
    };

    advanceAfterDisconnect(
      session,
      'response-id',
      'response-key',
      () => calls.push('response'),
      (error) => calls.push(`error:${(error as Error).message}`)
    );

    expectLib.expect(calls).toEqual(['response']);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expectLib.expect(calls).toEqual(['response', 'error:nREPL unavailable']);
  });
});
