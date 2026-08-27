import * as expectLib from 'expect';
import type * as nrepl from '../../nrepl';
import * as sessionEvents from '../../nrepl/session-events';
import * as clientRegistry from '../../nrepl/client-registry';
import * as sessionRegistry from '../../nrepl/session-registry';
import * as shadowRuntimeCore from '../../shadow-cljs-runtime-core';

const expect = expectLib.default;

const createClient = (key: string): nrepl.NReplClient =>
  ({
    clientKey: key,
  } as unknown as nrepl.NReplClient);

const createSession = (clientKey: string): nrepl.NReplSession =>
  ({
    client: { clientKey },
  } as unknown as nrepl.NReplSession);

describe('session-events and onSessionsChanged', () => {
  let receivedEvents: sessionEvents.SessionsChangedEvent[] = [];
  let subscription: sessionEvents.Disposable | undefined;

  beforeEach(() => {
    receivedEvents = [];
    subscription = sessionEvents.onSessionsChanged((event) => {
      receivedEvents.push(event);
    });
    // Clean up registries
    clientRegistry._testUtility_registeredClients.clear();
    sessionRegistry._testUtility_registeredSessions.clear();
  });

  afterEach(() => {
    subscription?.dispose();
    clientRegistry._testUtility_registeredClients.clear();
    sessionRegistry._testUtility_registeredSessions.clear();
  });

  it('delivers fired events to active listeners', () => {
    sessionEvents.fireSessionsChanged({
      type: 'connection-added',
      clientKey: 'localhost:1234',
    });

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0]).toEqual({
      type: 'connection-added',
      clientKey: 'localhost:1234',
    });
  });

  it('stops delivering events after subscription is disposed', () => {
    subscription?.dispose();

    sessionEvents.fireSessionsChanged({
      type: 'connection-added',
      clientKey: 'localhost:1234',
    });

    expect(receivedEvents.length).toBe(0);
  });

  it('fires connection-added on registerClient and connection-removed on unregisterClient', () => {
    const client = createClient('client-1');
    clientRegistry.registerClient(client, { connectSequenceName: 'Test' });

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0]).toEqual({
      type: 'connection-added',
      clientKey: 'client-1',
    });

    clientRegistry.unregisterClient('client-1');

    expect(receivedEvents.length).toBe(2);
    expect(receivedEvents[1]).toEqual({
      type: 'connection-removed',
      clientKey: 'client-1',
    });
  });

  it('fires session-added on registerSession and session-removed on unregisterSession', () => {
    const session = createSession('client-1');
    sessionRegistry.registerSession('clj', session, { connectionOwnerId: 'client-1' });

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0]).toEqual({
      type: 'session-added',
      sessionKey: 'clj',
      clientKey: 'client-1',
    });

    sessionRegistry.unregisterSession('clj');

    expect(receivedEvents.length).toBe(2);
    expect(receivedEvents[1]).toEqual({
      type: 'session-removed',
      sessionKey: 'clj',
      clientKey: 'client-1',
    });
  });

  it('fires session-renamed on renameSession', () => {
    const session = createSession('client-1');
    sessionRegistry.registerSession('clj', session, { connectionOwnerId: 'client-1' });

    sessionRegistry.renameSession('clj', 'clj-main');

    expect(receivedEvents.length).toBe(2);
    expect(receivedEvents[1]).toEqual({
      type: 'session-renamed',
      sessionKey: 'clj-main',
      previousSessionKey: 'clj',
      clientKey: 'client-1',
    });
  });

  it('handles shadow runtime lifecycle events for client connect and disconnect', () => {
    const connectData: shadowRuntimeCore.NotifyMessageData = {
      op: 'notify',
      'client-id': 2,
      'event-op': 'client-connect',
      'client-info': {
        'client-id': 2,
        'build-id': ':app',
        host: 'localhost',
        'worker-id': 1,
        type: 'runtime',
        lang: 'cljs',
        desc: 'Second Browser',
      },
    };

    const lifecycleConnect = shadowRuntimeCore.decideLifecycleEvent(connectData);
    expect(lifecycleConnect.type).toBe('runtime-connected');
    if (lifecycleConnect.type === 'runtime-connected') {
      sessionEvents.fireSessionsChanged({
        type: 'runtime-connected',
        clientKey: 'client-1',
        sessionKey: 'cljs',
        runtime: {
          ...lifecycleConnect.runtimeInfo,
        },
      });
    }

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].type).toBe('runtime-connected');
    expect(receivedEvents[0].runtime?.runtimeId).toBe(2);
    expect(receivedEvents[0].runtime?.description).toBe('Second Browser');

    const disconnectData: shadowRuntimeCore.NotifyMessageData = {
      op: 'notify',
      'client-id': 2,
      'event-op': 'client-disconnect',
    };

    const lifecycleDisconnect = shadowRuntimeCore.decideLifecycleEvent(disconnectData);
    expect(lifecycleDisconnect.type).toBe('runtime-disconnected');
    if (lifecycleDisconnect.type === 'runtime-disconnected') {
      sessionEvents.fireSessionsChanged({
        type: 'runtime-disconnected',
        clientKey: 'client-1',
        sessionKey: 'cljs',
        runtime: {
          runtimeId: lifecycleDisconnect.runtimeId,
          description: 'No description',
          buildId: '',
          host: '',
          workerId: 0,
          sinceInst: 0,
          sinceDescription: '',
        },
      });
    }

    expect(receivedEvents.length).toBe(2);
    expect(receivedEvents[1].type).toBe('runtime-disconnected');
    expect(receivedEvents[1].runtime?.runtimeId).toBe(2);
  });
});
