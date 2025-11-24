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
