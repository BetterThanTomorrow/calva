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

  it('keeps host and port only when both are correctly typed', () => {
    expectLib
      .expect(parseDisconnectCommandOptions({ host: 'localhost', port: 7888 }))
      .toEqual({ host: 'localhost', port: 7888 });
  });

  it('returns null for host without port or port without host', () => {
    expectLib.expect(parseDisconnectCommandOptions({ host: 'localhost' })).toBe(null);
    expectLib.expect(parseDisconnectCommandOptions({ port: 7888 })).toBe(null);
    expectLib.expect(parseDisconnectCommandOptions({ host: 'localhost', port: '7888' })).toBe(null);
    expectLib.expect(parseDisconnectCommandOptions({ host: 1, port: 7888 })).toBe(null);
  });
});

describe('planDisconnectCommand', () => {
  const known = {
    hasClient: (clientKey: string) => clientKey === 'nrepl-client-1',
    hasWsServerPort: (port: number) => port === 12345,
    hasHostPort: (host: string, port: number) => host === 'localhost' && port === 7888,
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

  it('forwards a known host and port', () => {
    expectLib
      .expect(planDisconnectCommand({ host: 'localhost', port: 7888 }, known))
      .toEqual({ action: 'forward', options: { host: 'localhost', port: 7888 } });
  });

  it('reports an unknown clientKey without forwarding', () => {
    expectLib.expect(planDisconnectCommand({ clientKey: 'nrepl-client-missing' }, known)).toEqual({
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

  it('reports an unknown host and port without forwarding', () => {
    expectLib.expect(planDisconnectCommand({ host: 'localhost', port: 9999 }, known)).toEqual({
      action: 'unknown',
      message: 'No Calva connection at localhost:9999',
    });
  });

  it('rejects more than one target without forwarding', () => {
    const message =
      'calva.disconnect accepts only one of clientKey, host and port, wsServerPort, or disconnectAll';
    expectLib
      .expect(planDisconnectCommand({ clientKey: 'nrepl-client-1', disconnectAll: true }, known))
      .toEqual({ action: 'unknown', message });
    expectLib
      .expect(planDisconnectCommand({ wsServerPort: 12345, disconnectAll: true }, known))
      .toEqual({ action: 'unknown', message });
    expectLib
      .expect(
        planDisconnectCommand({ clientKey: 'nrepl-client-1', host: 'localhost', port: 7888 }, known)
      )
      .toEqual({ action: 'unknown', message });
  });
});
