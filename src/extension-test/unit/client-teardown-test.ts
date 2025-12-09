import * as expect from 'expect';
import * as clientRegistry from '../../nrepl/client-registry';
import * as sessionRegistry from '../../nrepl/session-registry';
import * as fruitSuffix from '../../nrepl/fruit-suffix';
import * as clientTeardown from '../../nrepl/client-teardown';
import type { NReplClient, NReplSession } from '../../nrepl';

const createMockClient = (clientKey: string): NReplClient =>
  ({
    clientKey,
    close: () => Promise.resolve(undefined),
    disconnect: () => undefined,
    addOnCloseHandler: () => undefined,
    removeOnCloseHandler: () => undefined,
  } as unknown as NReplClient);

describe('client-teardown', () => {
  beforeEach(() => {
    clientRegistry._testUtility_registeredClients.clear();
    sessionRegistry._testUtility_registeredSessions.clear();
    fruitSuffix.resetPool();
  });

  afterEach(() => {
    clientRegistry._testUtility_registeredClients.clear();
    sessionRegistry._testUtility_registeredSessions.clear();
    fruitSuffix.resetPool();
  });

  describe('fruit suffix release on client teardown', () => {
    it('releases fruit suffix when tearing down a client with a fruit suffix', () => {
      // Setup: Register a client with a fruit suffix
      const client = createMockClient('client-a');
      const fruit = fruitSuffix.acquireNextAvailableFruit();
      expect(fruit).toBeDefined();

      clientRegistry.registerClient(client, {
        connectSequenceName: 'Test Connection',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${fruit}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          fruitSuffix: fruit,
        },
      });

      // Verify fruit is in use
      expect(fruitSuffix.getUsedFruits()).toContain(fruit);

      // Call the teardown helper that releases the fruit
      clientTeardown.releaseClientFruit('client-a');
      clientRegistry.unregisterClient('client-a');

      // Verify fruit is released
      expect(fruitSuffix.getUsedFruits()).not.toContain(fruit);
      expect(fruitSuffix.getAvailableFruits()).toContain(fruit);
    });

    it('handles teardown of client without fruit suffix (no-op for fruit release)', () => {
      // Setup: Register a client without a fruit suffix
      const client = createMockClient('client-b');

      clientRegistry.registerClient(client, {
        connectSequenceName: 'Simple Connection',
        projectRoot: 'file:///project-b',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: 'bb' },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'bb' },
          // No fruitSuffix
        },
      });

      // Should not throw when tearing down
      clientTeardown.releaseClientFruit('client-b');
      clientRegistry.unregisterClient('client-b');

      // Verify no fruits are used
      expect(fruitSuffix.getUsedFruits()).toEqual([]);
    });

    it('does not release fruit when teardown is called with undefined clientKey', () => {
      // Setup: Register a client with a fruit suffix
      const client = createMockClient('client-a');
      const fruit = fruitSuffix.acquireNextAvailableFruit();
      expect(fruit).toBeDefined();

      clientRegistry.registerClient(client, {
        connectSequenceName: 'Test Connection',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${fruit}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          fruitSuffix: fruit,
        },
      });

      // Simulate cleanup with undefined client key (as happens when connection fails early)
      clientTeardown.releaseClientFruit(undefined as unknown as string);

      // Fruit should still be in use because we didn't tear down client-a
      expect(fruitSuffix.getUsedFruits()).toContain(fruit);
    });

    it('releases fruit even when client has already been unregistered', () => {
      // This tests the scenario where we need to track fruit separately
      // because the client might be gone but we still have the fruit suffix stored
      const fruit = fruitSuffix.acquireNextAvailableFruit();
      expect(fruit).toBeDefined();

      // Store fruit separately (simulating what happens if we track it before client registration)
      // Then release it
      fruitSuffix.releaseFruit(fruit);

      expect(fruitSuffix.getUsedFruits()).not.toContain(fruit);
      expect(fruitSuffix.getAvailableFruits()).toContain(fruit);
    });
  });

  describe('releaseClientFruit', () => {
    it('releases fruit when client has fruitSuffix in connectionState', () => {
      const client = createMockClient('client-x');
      const fruit = fruitSuffix.acquireNextAvailableFruit();
      expect(fruit).toBeDefined();

      clientRegistry.registerClient(client, {
        connectSequenceName: 'Test',
        projectRoot: 'file:///test',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${fruit}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          fruitSuffix: fruit,
        },
      });

      expect(fruitSuffix.getUsedFruits()).toContain(fruit);

      const released = clientTeardown.releaseClientFruit('client-x');

      expect(released).toBe(fruit);
      expect(fruitSuffix.getUsedFruits()).not.toContain(fruit);
    });

    it('returns undefined when connectionState is undefined', () => {
      const initialUsed = [...fruitSuffix.getUsedFruits()];

      const released = clientTeardown.releaseClientFruit('nonexistent-client');

      expect(released).toBeUndefined();
      expect(fruitSuffix.getUsedFruits()).toEqual(initialUsed);
    });

    it('returns undefined when connectionState has no fruitSuffix', () => {
      const client = createMockClient('client-no-fruit');

      clientRegistry.registerClient(client, {
        connectSequenceName: 'No Fruit',
        projectRoot: 'file:///test',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: 'bb' },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'bb' },
          // No fruitSuffix
        },
      });

      const released = clientTeardown.releaseClientFruit('client-no-fruit');

      expect(released).toBeUndefined();
    });

    it('returns undefined when clientKey is undefined', () => {
      const released = clientTeardown.releaseClientFruit(undefined);

      expect(released).toBeUndefined();
    });
  });

  describe('releaseFruitDirectly', () => {
    it('releases fruit when provided', () => {
      const fruit = fruitSuffix.acquireNextAvailableFruit();
      expect(fruit).toBeDefined();
      expect(fruitSuffix.getUsedFruits()).toContain(fruit);

      clientTeardown.releaseFruitDirectly(fruit);

      expect(fruitSuffix.getUsedFruits()).not.toContain(fruit);
    });

    it('does nothing when fruit is undefined', () => {
      const fruit = fruitSuffix.acquireNextAvailableFruit();
      expect(fruit).toBeDefined();
      expect(fruitSuffix.getUsedFruits()).toContain(fruit);

      clientTeardown.releaseFruitDirectly(undefined);

      // Original fruit should still be in use
      expect(fruitSuffix.getUsedFruits()).toContain(fruit);
    });
  });

  describe('multiple clients with fruit suffixes', () => {
    it('releases only the fruit for the torn down client', () => {
      // Setup: Two clients with different fruit suffixes
      const clientA = createMockClient('client-a');
      const clientB = createMockClient('client-b');
      const fruitA = fruitSuffix.acquireNextAvailableFruit();
      const fruitB = fruitSuffix.acquireNextAvailableFruit();
      expect(fruitA).toBeDefined();
      expect(fruitB).toBeDefined();

      clientRegistry.registerClient(clientA, {
        connectSequenceName: 'Connection A',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${fruitA}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          fruitSuffix: fruitA,
        },
      });

      clientRegistry.registerClient(clientB, {
        connectSequenceName: 'Connection B',
        projectRoot: 'file:///project-b',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${fruitB}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          fruitSuffix: fruitB,
        },
      });

      // Verify both fruits are in use
      expect(fruitSuffix.getUsedFruits()).toContain(fruitA);
      expect(fruitSuffix.getUsedFruits()).toContain(fruitB);

      // Tear down only client A using the helper
      clientTeardown.releaseClientFruit('client-a');
      clientRegistry.unregisterClient('client-a');

      // Only fruitA should be released
      expect(fruitSuffix.getUsedFruits()).not.toContain(fruitA);
      expect(fruitSuffix.getUsedFruits()).toContain(fruitB);
    });
  });

  describe('reconnection fruit preservation', () => {
    it('fruit stays reserved when teardown skips release (reconnection scenario)', () => {
      // This simulates the reconnection flow:
      // 1. Client A exists with fruit 'apple'
      // 2. Session name resolver reserves 'apple' for reconnection
      // 3. Old client is torn down WITHOUT releasing fruit (preserveFruit: true)
      // 4. New client registers with same fruit
      // Throughout this, 'apple' should remain in usedFruits

      const clientA = createMockClient('client-a');
      const fruit = 'apple';
      fruitSuffix.reserveFruit(fruit);

      clientRegistry.registerClient(clientA, {
        connectSequenceName: 'Connection A',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${fruit}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          fruitSuffix: fruit,
        },
      });

      expect(fruitSuffix.getUsedFruits()).toContain(fruit);

      // Simulate reconnection: resolver has already reserved the fruit again
      // (this happens before teardown in real code)
      // In this test, the fruit is already reserved, so reserveFruit returns false
      // but the fruit stays in usedFruits

      // Simulate teardown that preserves fruit (as disconnectClientByKey does with preserveFruit: true)
      // We just unregister without releasing fruit
      clientRegistry.unregisterClient('client-a');

      // Fruit should STILL be reserved (not released)
      expect(fruitSuffix.getUsedFruits()).toContain(fruit);

      // Now a new client can be registered with the same fruit
      const clientB = createMockClient('client-b');
      clientRegistry.registerClient(clientB, {
        connectSequenceName: 'Connection A (reconnected)',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${fruit}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          fruitSuffix: fruit,
        },
      });

      // Fruit remains in use with new client
      expect(fruitSuffix.getUsedFruits()).toContain(fruit);
    });

    it('fruit would be stolen without preservation (demonstrates the bug fix)', () => {
      // This shows what WOULD happen without preserveFruit:
      // If we release fruit during teardown, another connection could steal it

      const clientA = createMockClient('client-a');
      const fruit = 'banana';
      fruitSuffix.reserveFruit(fruit);

      clientRegistry.registerClient(clientA, {
        connectSequenceName: 'Connection A',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${fruit}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          fruitSuffix: fruit,
        },
      });

      expect(fruitSuffix.getUsedFruits()).toContain(fruit);

      // If we DO release fruit during teardown (the old buggy behavior)
      clientTeardown.releaseClientFruit('client-a');
      clientRegistry.unregisterClient('client-a');

      // Fruit is now available - another connection could grab it!
      expect(fruitSuffix.getUsedFruits()).not.toContain(fruit);
      expect(fruitSuffix.getAvailableFruits()).toContain(fruit);

      // Reserve the fruit again (simulating what another project might do)
      const wasReserved = fruitSuffix.reserveFruit(fruit);
      expect(wasReserved).toBe(true); // Demonstrates the vulnerability - fruit was available to steal
    });

    it('markFruitPreserved prevents release by releaseClientFruit', () => {
      // Guards agaist regression for the on-close handler bug:
      // When disconnectClientByKey specifies preserveFruit: true, it should mark
      // the fruit as preserved so that the on-close handler (which calls
      // releaseClientFruit) won't release it.

      const clientA = createMockClient('client-a');
      const fruit = 'cherry';
      fruitSuffix.reserveFruit(fruit);

      clientRegistry.registerClient(clientA, {
        connectSequenceName: 'Connection A',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${fruit}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          fruitSuffix: fruit,
        },
      });

      expect(fruitSuffix.getUsedFruits()).toContain(fruit);

      // Mark fruit as preserved (simulating what disconnectClientByKey does with preserveFruit: true)
      clientTeardown.markFruitPreserved('client-a');

      // Now when the on-close handler fires, it calls releaseClientFruit,
      // but the fruit should NOT be released because it's marked as preserved
      const released = clientTeardown.releaseClientFruit('client-a');

      // Fruit should NOT have been released
      expect(released).toBeUndefined();
      expect(fruitSuffix.getUsedFruits()).toContain(fruit);
    });

    it('clearFruitPreserved allows subsequent release', () => {
      // Test that we can clear the preserved flag if needed

      const clientA = createMockClient('client-a');
      const fruit = 'date';
      fruitSuffix.reserveFruit(fruit);

      clientRegistry.registerClient(clientA, {
        connectSequenceName: 'Connection A',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${fruit}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          fruitSuffix: fruit,
        },
      });

      // Mark then clear
      clientTeardown.markFruitPreserved('client-a');
      clientTeardown.clearFruitPreserved('client-a');

      // Now release should work
      const released = clientTeardown.releaseClientFruit('client-a');
      expect(released).toBe(fruit);
      expect(fruitSuffix.getUsedFruits()).not.toContain(fruit);
    });

    it('simulates full reconnection flow with on-close handler', () => {
      // This test simulates the exact reconnection flow in connector.ts:
      // 1. Existing client with fruit 'elderberry'
      // 2. resolveSessionNames reserves the fruit for reconnection
      // 3. disconnectClientByKey with preserveFruit: true
      //    - marks fruit as preserved
      //    - unregisters client (connection state gone!)
      //    - calls client.close() which triggers on-close handler
      // 4. on-close handler calls releaseClientFruit
      // 5. Fruit should NOT be released because it's marked as preserved

      const fruit = 'elderberry';
      fruitSuffix.reserveFruit(fruit);

      const clientA = createMockClient('client-a');
      clientRegistry.registerClient(clientA, {
        connectSequenceName: 'Connection A',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${fruit}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          fruitSuffix: fruit,
        },
      });

      expect(fruitSuffix.getUsedFruits()).toContain(fruit);

      // Step 2: resolveSessionNames would reserve the fruit again (already reserved, but stays in set)
      // In real code, this happens before disconnectClientByKey

      // Step 3: disconnectClientByKey with preserveFruit: true
      // First, mark fruit as preserved
      clientTeardown.markFruitPreserved('client-a');

      // Then unregister the client (this removes connection state!)
      clientRegistry.unregisterClient('client-a');

      // At this point, getConnectionState('client-a') would return undefined
      expect(clientRegistry.getConnectionState('client-a')).toBeUndefined();

      // Step 4: on-close handler fires and calls releaseClientFruit
      // This should NOT release the fruit because it's marked as preserved
      const released = clientTeardown.releaseClientFruit('client-a');

      // Fruit should NOT have been released
      expect(released).toBeUndefined();
      expect(fruitSuffix.getUsedFruits()).toContain(fruit);

      // Step 5: New client can now be registered with the same fruit
      const clientB = createMockClient('client-b');
      clientRegistry.registerClient(clientB, {
        connectSequenceName: 'Connection A (reconnected)',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${fruit}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          fruitSuffix: fruit,
        },
      });

      // Fruit remains in use with new client
      expect(fruitSuffix.getUsedFruits()).toContain(fruit);
    });
  });
});
