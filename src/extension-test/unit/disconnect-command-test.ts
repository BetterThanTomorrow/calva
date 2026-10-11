import * as expectLib from 'expect';
import {
  parseDisconnectCommandOptions,
  planDisconnectCommand,
} from '../../nrepl/disconnect-command';

describe('parseDisconnectCommandOptions', () => {
  it('returns null when there is no argument', () => {
    expectLib.expect(parseDisconnectCommandOptions(undefined)).toBe(null);
    expectLib.expect(parseDisconnectCommandOptions(null)).toBe(null);
  });

  it('returns null for a Uri-like editor context argument', () => {
    const uriArg = {
      scheme: 'file',
      path: '/tmp/foo.clj',
      fsPath: '/tmp/foo.clj',
      toString: () => 'file:///tmp/foo.clj',
    };
    expectLib.expect(parseDisconnectCommandOptions(uriArg)).toBe(null);
  });

  it('returns null when known fields have the wrong types', () => {
    expectLib
      .expect(
        parseDisconnectCommandOptions({
          clientKey: 1,
          wsServerPort: '12345',
          disconnectAll: 'yes',
        })
      )
      .toBe(null);
  });

  it('keeps only correctly typed known fields', () => {
    expectLib
      .expect(
        parseDisconnectCommandOptions({
          clientKey: 'nrepl-client-1',
          wsServerPort: 'nope',
          disconnectAll: true,
          preserveSuffix: true,
        })
      )
      .toEqual({ clientKey: 'nrepl-client-1', disconnectAll: true });
  });
});

describe('planDisconnectCommand', () => {
  const known = {
    hasClient: (clientKey: string) => clientKey === 'nrepl-client-1',
    hasWsServerPort: (port: number) => port === 12345,
  };

  it('forwards null options for the picker path', () => {
    expectLib.expect(planDisconnectCommand(null, known)).toEqual({
      action: 'forward',
      options: null,
    });
  });

  it('forwards a known clientKey', () => {
    expectLib
      .expect(planDisconnectCommand({ clientKey: 'nrepl-client-1' }, known))
      .toEqual({ action: 'forward', options: { clientKey: 'nrepl-client-1' } });
  });

  it('forwards a known wsServerPort', () => {
    expectLib
      .expect(planDisconnectCommand({ wsServerPort: 12345 }, known))
      .toEqual({ action: 'forward', options: { wsServerPort: 12345 } });
  });

  it('forwards disconnectAll', () => {
    expectLib
      .expect(planDisconnectCommand({ disconnectAll: true }, known))
      .toEqual({ action: 'forward', options: { disconnectAll: true } });
  });

  it('reports an unknown clientKey without forwarding', () => {
    expectLib
      .expect(planDisconnectCommand({ clientKey: 'nrepl-client-missing' }, known))
      .toEqual({
        action: 'unknown',
        message: 'No Calva connection with clientKey nrepl-client-missing',
      });
  });

  it('reports an unknown wsServerPort without forwarding', () => {
    expectLib.expect(planDisconnectCommand({ wsServerPort: 9999 }, known)).toEqual({
      action: 'unknown',
      message: 'No WebSocket server on port 9999',
    });
  });
});
