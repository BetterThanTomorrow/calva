import { expect } from 'expect';
import * as clientRegistry from '../../nrepl/client-registry';
import * as sessionRegistry from '../../nrepl/session-registry';
import * as nameSuffix from '../../nrepl/session-name-suffix';
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
    nameSuffix.resetPool();
  });

  afterEach(() => {
    clientRegistry._testUtility_registeredClients.clear();
    sessionRegistry._testUtility_registeredSessions.clear();
    nameSuffix.resetPool();
  });

  describe('suffix release on client teardown', () => {
    it('releases suffix when tearing down a client with a suffix', () => {
      // Setup: Register a client with a suffix
      const client = createMockClient('client-a');
      const suffix = nameSuffix.acquireNextAvailableSuffix();
      expect(suffix).toBeDefined();

      clientRegistry.registerClient(client, {
        connectSequenceName: 'Test Connection',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${suffix}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          suffix: suffix,
        },
      });

      // Verify suffix is in use
      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);

      // Call the teardown helper that releases the suffix
      clientTeardown.releaseClientSuffix('client-a');
      clientRegistry.unregisterClient('client-a');

      // Verify suffix is released
      expect(nameSuffix.getUsedSuffixes()).not.toContain(suffix);
      expect(nameSuffix.getAvailableSuffixes()).toContain(suffix);
    });

    it('handles teardown of client without suffix (no-op for suffix release)', () => {
      // Setup: Register a client without a suffix
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
          // No suffix
        },
      });

      // Should not throw when tearing down
      clientTeardown.releaseClientSuffix('client-b');
      clientRegistry.unregisterClient('client-b');

      // Verify no suffixes are used
      expect(nameSuffix.getUsedSuffixes()).toEqual([]);
    });

    it('does not release suffix when teardown is called with undefined clientKey', () => {
      // Setup: Register a client with a suffix
      const client = createMockClient('client-a');
      const suffix = nameSuffix.acquireNextAvailableSuffix();
      expect(suffix).toBeDefined();

      clientRegistry.registerClient(client, {
        connectSequenceName: 'Test Connection',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${suffix}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          suffix: suffix,
        },
      });

      // Simulate cleanup with undefined client key (as happens when connection fails early)
      clientTeardown.releaseClientSuffix(undefined as unknown as string);

      // Suffix should still be in use because we didn't tear down client-a
      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);
    });

    it('releases suffix even when client has already been unregistered', () => {
      // This tests the scenario where we need to track suffix separately
      // because the client might be gone but we still have the suffix stored
      const suffix = nameSuffix.acquireNextAvailableSuffix();
      expect(suffix).toBeDefined();

      // Store suffix separately (simulating what happens if we track it before client registration)
      // Then release it
      nameSuffix.releaseSuffix(suffix);

      expect(nameSuffix.getUsedSuffixes()).not.toContain(suffix);
      expect(nameSuffix.getAvailableSuffixes()).toContain(suffix);
    });
  });

  describe('releaseClientSuffix', () => {
    it('releases suffix when client has nameSuffix in connectionState', () => {
      const client = createMockClient('client-x');
      const suffix = nameSuffix.acquireNextAvailableSuffix();
      expect(suffix).toBeDefined();

      clientRegistry.registerClient(client, {
        connectSequenceName: 'Test',
        projectRoot: 'file:///test',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${suffix}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          suffix: suffix,
        },
      });

      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);

      const released = clientTeardown.releaseClientSuffix('client-x');

      expect(released).toBe(suffix);
      expect(nameSuffix.getUsedSuffixes()).not.toContain(suffix);
    });

    it('returns undefined when connectionState is undefined', () => {
      const initialUsed = [...nameSuffix.getUsedSuffixes()];

      const released = clientTeardown.releaseClientSuffix('nonexistent-client');

      expect(released).toBeUndefined();
      expect(nameSuffix.getUsedSuffixes()).toEqual(initialUsed);
    });

    it('returns undefined when connectionState has no nameSuffix', () => {
      const client = createMockClient('client-no-suffix');

      clientRegistry.registerClient(client, {
        connectSequenceName: 'No Suffix',
        projectRoot: 'file:///test',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: 'bb' },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'bb' },
          // No nameSuffix
        },
      });

      const released = clientTeardown.releaseClientSuffix('client-no-suffix');

      expect(released).toBeUndefined();
    });

    it('returns undefined when clientKey is undefined', () => {
      const released = clientTeardown.releaseClientSuffix(undefined);

      expect(released).toBeUndefined();
    });
  });

  describe('releaseSuffixDirectly', () => {
    it('releases suffix when provided', () => {
      const suffix = nameSuffix.acquireNextAvailableSuffix();
      expect(suffix).toBeDefined();
      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);

      clientTeardown.releaseSuffixDirectly(suffix);

      expect(nameSuffix.getUsedSuffixes()).not.toContain(suffix);
    });

    it('does nothing when suffix is undefined', () => {
      const suffix = nameSuffix.acquireNextAvailableSuffix();
      expect(suffix).toBeDefined();
      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);

      clientTeardown.releaseSuffixDirectly(undefined);

      // Original suffix should still be in use
      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);
    });
  });

  describe('multiple clients with suffixes', () => {
    it('releases only the suffix for the torn down client', () => {
      // Setup: Two clients with different suffixes
      const clientA = createMockClient('client-a');
      const clientB = createMockClient('client-b');
      const suffixA = nameSuffix.acquireNextAvailableSuffix();
      const suffixB = nameSuffix.acquireNextAvailableSuffix();
      expect(suffixA).toBeDefined();
      expect(suffixB).toBeDefined();

      clientRegistry.registerClient(clientA, {
        connectSequenceName: 'Connection A',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${suffixA}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          suffix: suffixA,
        },
      });

      clientRegistry.registerClient(clientB, {
        connectSequenceName: 'Connection B',
        projectRoot: 'file:///project-b',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${suffixB}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          suffix: suffixB,
        },
      });

      // Verify both suffixes are in use
      expect(nameSuffix.getUsedSuffixes()).toContain(suffixA);
      expect(nameSuffix.getUsedSuffixes()).toContain(suffixB);

      // Tear down only client A using the helper
      clientTeardown.releaseClientSuffix('client-a');
      clientRegistry.unregisterClient('client-a');

      // Only the suffix for client A should be released
      expect(nameSuffix.getUsedSuffixes()).not.toContain(suffixA);
      expect(nameSuffix.getUsedSuffixes()).toContain(suffixB);
    });
  });

  describe('reconnection suffix preservation', () => {
    it('suffix stays reserved when teardown skips release (reconnection scenario)', () => {
      // This simulates the reconnection flow:
      // 1. Client A exists with suffix 'apple'
      // 2. Session name resolver reserves 'apple' for reconnection
      // 3. Old client is torn down WITHOUT releasing suffix (preserveSuffix: true)
      // 4. New client registers with same suffix
      // Throughout this, 'apple' should remain in use

      const clientA = createMockClient('client-a');
      const suffix = 'apple';
      nameSuffix.reserveSuffix(suffix);

      clientRegistry.registerClient(clientA, {
        connectSequenceName: 'Connection A',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${suffix}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          suffix: suffix,
        },
      });

      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);

      // Simulate reconnection: resolver has already reserved the suffix again
      // (this happens before teardown in real code)
      // In this test, the suffix is already reserved, so reserveSuffix returns false
      // but the suffix stays in use

      // Simulate teardown that preserves suffix (as disconnectClientByKey does with preserveSuffix: true)
      // We just unregister without releasing the suffix
      clientRegistry.unregisterClient('client-a');

      // Suffix should STILL be reserved (not released)
      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);

      // Now a new client can be registered with the same suffix
      const clientB = createMockClient('client-b');
      clientRegistry.registerClient(clientB, {
        connectSequenceName: 'Connection A (reconnected)',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${suffix}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          suffix: suffix,
        },
      });

      // Suffix remains in use with new client
      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);
    });

    it('suffix would be stolen without preservation (demonstrates the bug fix)', () => {
      // This shows what WOULD happen without preserveSuffix:
      // If we release a suffix during teardown, another connection could steal it

      const clientA = createMockClient('client-a');
      const suffix = '3';
      nameSuffix.reserveSuffix(suffix);

      clientRegistry.registerClient(clientA, {
        connectSequenceName: 'Connection A',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${suffix}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          suffix: suffix,
        },
      });

      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);

      // If we DO release the suffix during teardown (the old buggy behavior)
      clientTeardown.releaseClientSuffix('client-a');
      clientRegistry.unregisterClient('client-a');

      // Suffix is now available - another connection could grab it!
      expect(nameSuffix.getUsedSuffixes()).not.toContain(suffix);
      expect(nameSuffix.getAvailableSuffixes()).toContain(suffix);

      // Reserve the suffix again (simulating what another project might do)
      const wasReserved = nameSuffix.reserveSuffix(suffix);
      expect(wasReserved).toBe(true); // Demonstrates the vulnerability - suffix was available to steal
    });

    it('markSuffixPreserved prevents release by releaseClientSuffix', () => {
      // Guards agaist regression for the on-close handler bug:
      // When disconnectClientByKey specifies preserveSuffix: true, it should mark
      // the suffix as preserved so that the on-close handler (which calls
      // releaseClientSuffix) won't release it.

      const clientA = createMockClient('client-a');
      const suffix = 'cherry';
      nameSuffix.reserveSuffix(suffix);

      clientRegistry.registerClient(clientA, {
        connectSequenceName: 'Connection A',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${suffix}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          suffix: suffix,
        },
      });

      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);

      // Mark suffix as preserved (simulating what disconnectClientByKey does with preserveSuffix: true)
      clientTeardown.markSuffixPreserved('client-a');

      // Now when the on-close handler fires, it calls releaseClientSuffix,
      // but the suffix should NOT be released because it's marked as preserved
      const released = clientTeardown.releaseClientSuffix('client-a');

      // Suffix should NOT have been released
      expect(released).toBeUndefined();
      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);
    });

    it('clearSuffixPreserved allows subsequent release', () => {
      // Test that we can clear the preserved flag if needed

      const clientA = createMockClient('client-a');
      const suffix = 'date';
      nameSuffix.reserveSuffix(suffix);

      clientRegistry.registerClient(clientA, {
        connectSequenceName: 'Connection A',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${suffix}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          suffix: suffix,
        },
      });

      // Mark then clear
      clientTeardown.markSuffixPreserved('client-a');
      clientTeardown.clearSuffixPreserved('client-a');

      // Now release should work
      const released = clientTeardown.releaseClientSuffix('client-a');
      expect(released).toBe(suffix);
      expect(nameSuffix.getUsedSuffixes()).not.toContain(suffix);
    });

    it('simulates full reconnection flow with on-close handler', () => {
      // This test simulates the exact reconnection flow in connector.ts:
      // 1. Existing client with suffix 'elderberry'
      // 2. resolveSessionNames reserves the suffix for reconnection
      // 3. disconnectClientByKey with preserveSuffix: true
      //    - marks suffix as preserved
      //    - unregisters client (connection state gone!)
      //    - calls client.close() which triggers on-close handler
      // 4. on-close handler calls releaseClientSuffix
      // 5. Suffix should NOT be released because it's marked as preserved

      const suffix = 'elderberry';
      nameSuffix.reserveSuffix(suffix);

      const clientA = createMockClient('client-a');
      clientRegistry.registerClient(clientA, {
        connectSequenceName: 'Connection A',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${suffix}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          suffix: suffix,
        },
      });

      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);

      // Step 2: resolveSessionNames would reserve the suffix again (already reserved, but stays in set)
      // In real code, this happens before disconnectClientByKey

      // Step 3: disconnectClientByKey with preserveSuffix: true
      // First, mark suffix as preserved
      clientTeardown.markSuffixPreserved('client-a');

      // Then unregister the client (this removes connection state!)
      clientRegistry.unregisterClient('client-a');

      // At this point, getConnectionState('client-a') would return undefined
      expect(clientRegistry.getConnectionState('client-a')).toBeUndefined();

      // Step 4: on-close handler fires and calls releaseClientSuffix
      // This should NOT release the suffix because it's marked as preserved
      const released = clientTeardown.releaseClientSuffix('client-a');

      // Suffix should NOT have been released
      expect(released).toBeUndefined();
      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);

      // Step 5: New client can now be registered with the same suffix
      const clientB = createMockClient('client-b');
      clientRegistry.registerClient(clientB, {
        connectSequenceName: 'Connection A (reconnected)',
        projectRoot: 'file:///project-a',
        connectionState: {
          cljsBuild: null,
          cljsTypeName: null,
          hasBuilds: false,
          sessionRoleKeys: { primary: `clj:${suffix}` },
          sessionGlobMap: {},
          connectSequence: {} as any,
          baseSessionNames: { primary: 'clj' },
          suffix: suffix,
        },
      });

      // Suffix remains in use with new client
      expect(nameSuffix.getUsedSuffixes()).toContain(suffix);
    });
  });
});
