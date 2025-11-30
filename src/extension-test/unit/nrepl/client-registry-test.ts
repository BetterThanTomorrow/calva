import * as expect from 'expect';
import type { NReplClient } from '../../../../src/nrepl';
import * as clientRegistry from '../../../../src/nrepl/client-registry';

const createClient = (key: string): NReplClient =>
  ({
    clientKey: key,
  } as unknown as NReplClient);

describe('client registry', () => {
  afterEach(() => {
    clientRegistry.clearAllClients();
  });

  it('registers clients and exposes them via listClients', () => {
    const alpha = createClient('alpha-client');
    clientRegistry.registerClient(alpha, { connectSequenceName: 'Alpha' });

    const beta = createClient('beta-client');
    clientRegistry.registerClient(beta, { connectSequenceName: 'Beta' });

    const clients = clientRegistry.listClients();
    expect(clients.map((c) => c.key)).toEqual(['alpha-client', 'beta-client']);
  });

  it('tracks active client and falls back when the active one is removed', () => {
    const alpha = createClient('alpha-client');
    const beta = createClient('beta-client');
    clientRegistry.registerClient(alpha, { connectSequenceName: 'Alpha' });
    clientRegistry.registerClient(beta, { connectSequenceName: 'Beta' });

    clientRegistry.setActiveClientKey('beta-client');
    expect(clientRegistry.getActiveClient()?.clientKey).toBe('beta-client');

    clientRegistry.unregisterClient('beta-client');
    expect(clientRegistry.getActiveClient()?.clientKey).toBe('alpha-client');
  });
});

describe('cljc target for connection', () => {
  afterEach(() => {
    clientRegistry.clearAllClients();
  });

  it('returns primary as default when not explicitly set', () => {
    const client = createClient('test-client');
    clientRegistry.registerClient(client, { connectSequenceName: 'Test' });

    expect(clientRegistry.getCljcTargetForConnection('test-client')).toBe('primary');
  });

  it('returns primary for non-existent client', () => {
    expect(clientRegistry.getCljcTargetForConnection('non-existent')).toBe('primary');
  });

  it('sets and gets cljc target', () => {
    const client = createClient('test-client');
    clientRegistry.registerClient(client, { connectSequenceName: 'Test' });

    clientRegistry.setCljcTargetForConnection('test-client', 'secondary');
    expect(clientRegistry.getCljcTargetForConnection('test-client')).toBe('secondary');

    clientRegistry.setCljcTargetForConnection('test-client', 'primary');
    expect(clientRegistry.getCljcTargetForConnection('test-client')).toBe('primary');
  });

  it('preserves cljc target when updating other connection state', () => {
    const client = createClient('test-client');
    clientRegistry.registerClient(client, { connectSequenceName: 'Test' });

    clientRegistry.setCljcTargetForConnection('test-client', 'secondary');
    clientRegistry.setConnectionState('test-client', { cljsBuild: ':app' });

    expect(clientRegistry.getCljcTargetForConnection('test-client')).toBe('secondary');
  });

  it('can set cljc target via connection state', () => {
    const client = createClient('test-client');
    clientRegistry.registerClient(client, {
      connectSequenceName: 'Test',
      connectionState: { cljcTarget: 'secondary' },
    });

    expect(clientRegistry.getCljcTargetForConnection('test-client')).toBe('secondary');
  });
});
