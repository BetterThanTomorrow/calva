import * as expectLib from 'expect';
import type * as nrepl from '../../../../src/nrepl';
import * as clientRegistry from '../../../../src/nrepl/client-registry';

const createClient = (key: string): nrepl.NReplClient =>
  ({
    clientKey: key,
  } as unknown as nrepl.NReplClient);

describe('client registry', () => {
  afterEach(() => {
    clientRegistry._testUtility_registeredClients.clear();
  });

  it('registers clients and exposes them via listClients', () => {
    const alpha = createClient('alpha-client');
    clientRegistry.registerClient(alpha, { connectSequenceName: 'Alpha' });

    const beta = createClient('beta-client');
    clientRegistry.registerClient(beta, { connectSequenceName: 'Beta' });

    const clients = clientRegistry.listClients();
    expectLib.expect(clients.map((c) => c.key)).toEqual(['alpha-client', 'beta-client']);
  });

  it('unregisters clients correctly', () => {
    const alpha = createClient('alpha-client');
    const beta = createClient('beta-client');
    clientRegistry.registerClient(alpha, { connectSequenceName: 'Alpha' });
    clientRegistry.registerClient(beta, { connectSequenceName: 'Beta' });

    clientRegistry.unregisterClient('beta-client');
    const clients = clientRegistry.listClients();
    expectLib.expect(clients.map((c) => c.key)).toEqual(['alpha-client']);
  });
});

describe('cljc target for connection', () => {
  afterEach(() => {
    clientRegistry._testUtility_registeredClients.clear();
  });

  it('returns primary as default when not explicitly set', () => {
    const client = createClient('test-client');
    clientRegistry.registerClient(client, { connectSequenceName: 'Test' });

    expectLib.expect(clientRegistry.getCljcTargetForConnection('test-client')).toBe('primary');
  });

  it('returns primary for non-existent client', () => {
    expectLib.expect(clientRegistry.getCljcTargetForConnection('non-existent')).toBe('primary');
  });

  it('sets and gets cljc target', () => {
    const client = createClient('test-client');
    clientRegistry.registerClient(client, { connectSequenceName: 'Test' });

    clientRegistry.setCljcTargetForConnection('test-client', 'secondary');
    expectLib.expect(clientRegistry.getCljcTargetForConnection('test-client')).toBe('secondary');

    clientRegistry.setCljcTargetForConnection('test-client', 'primary');
    expectLib.expect(clientRegistry.getCljcTargetForConnection('test-client')).toBe('primary');
  });

  it('preserves cljc target when updating other connection state', () => {
    const client = createClient('test-client');
    clientRegistry.registerClient(client, { connectSequenceName: 'Test' });

    clientRegistry.setCljcTargetForConnection('test-client', 'secondary');
    clientRegistry.setConnectionState('test-client', { cljsBuild: ':app' });

    expectLib.expect(clientRegistry.getCljcTargetForConnection('test-client')).toBe('secondary');
  });

  it('can set cljc target via connection state', () => {
    const client = createClient('test-client');
    clientRegistry.registerClient(client, {
      connectSequenceName: 'Test',
      connectionState: { cljcTarget: 'secondary' },
    });

    expectLib.expect(clientRegistry.getCljcTargetForConnection('test-client')).toBe('secondary');
  });
});
