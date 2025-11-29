import * as expect from 'expect';
import * as shadowRuntimeCore from '../../../src/shadow-cljs-runtime-core';
import type { ConnectionState } from '../../../src/nrepl/client-registry';

describe('shadow-cljs-runtime-core', () => {
  describe('normalizeRuntimeInfo', () => {
    it('transforms shadow API runtime info to internal format', () => {
      const apiInfo: shadowRuntimeCore.ShadowApiRuntimeInfo = {
        'client-id': 42,
        'build-id': ':app',
        host: 'localhost',
        'worker-id': 1,
        type: 'runtime',
        lang: 'cljs',
        desc: 'Test Browser',
      };

      const result = shadowRuntimeCore.normalizeRuntimeInfo(apiInfo);

      expect(result.clientId).toBe(42);
      expect(result.buildId).toBe(':app');
      expect(result.host).toBe('localhost');
      expect(result.workerId).toBe(1);
      expect(result.description).toBe('Test Browser');
    });

    it('falls back to user-agent when desc is missing', () => {
      const apiInfo: shadowRuntimeCore.ShadowApiRuntimeInfo = {
        'client-id': 1,
        'build-id': ':app',
        host: 'localhost',
        'worker-id': 0,
        type: 'runtime',
        lang: 'cljs',
        'user-agent': 'Mozilla/5.0',
      };

      const result = shadowRuntimeCore.normalizeRuntimeInfo(apiInfo);
      expect(result.description).toBe('Mozilla/5.0');
    });

    it('uses "No description" when neither desc nor user-agent exists', () => {
      const apiInfo: shadowRuntimeCore.ShadowApiRuntimeInfo = {
        'client-id': 1,
        'build-id': ':app',
        host: 'localhost',
        'worker-id': 0,
        type: 'runtime',
        lang: 'cljs',
      };

      const result = shadowRuntimeCore.normalizeRuntimeInfo(apiInfo);
      expect(result.description).toBe('No description');
    });

    it('computes sinceInst from since Date', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      const apiInfo: shadowRuntimeCore.ShadowApiRuntimeInfo = {
        'client-id': 1,
        'build-id': ':app',
        host: 'localhost',
        'worker-id': 0,
        type: 'runtime',
        lang: 'cljs',
        since: testDate,
      };

      const result = shadowRuntimeCore.normalizeRuntimeInfo(apiInfo);
      expect(result.sinceInst).toBe(testDate.getTime());
    });
  });

  describe('getRuntimeIdFromState / getRuntimeInfoFromState', () => {
    it('extracts runtime ID from connection state', () => {
      const state: ConnectionState = {
        cljsBuild: ':app',
        cljsTypeName: 'shadow-cljs',
        hasBuilds: true,
        shadowCljsRuntimeId: 42,
      };

      expect(shadowRuntimeCore.getRuntimeIdFromState(state)).toBe(42);
    });

    it('returns undefined when state is undefined', () => {
      expect(shadowRuntimeCore.getRuntimeIdFromState(undefined)).toBeUndefined();
    });

    it('extracts runtime info from connection state', () => {
      const runtimeInfo: shadowRuntimeCore.RuntimeInfo = {
        clientId: 42,
        description: 'Browser',
        buildId: ':app',
        host: 'localhost',
        workerId: 1,
        sinceInst: 0,
        sinceDescription: 'Unknown time',
      };
      const state: ConnectionState = {
        cljsBuild: ':app',
        cljsTypeName: 'shadow-cljs',
        hasBuilds: true,
        shadowCljsRuntimeInfo: runtimeInfo,
      };

      expect(shadowRuntimeCore.getRuntimeInfoFromState(state)).toEqual(runtimeInfo);
    });
  });

  describe('createRuntimeStateUpdate / createClearRuntimeStateUpdate', () => {
    it('creates update with runtime ID and info', () => {
      const runtimeInfo: shadowRuntimeCore.RuntimeInfo = {
        clientId: 42,
        description: 'Browser',
        buildId: ':app',
        host: 'localhost',
        workerId: 1,
        sinceInst: 0,
        sinceDescription: 'Unknown time',
      };

      const update = shadowRuntimeCore.createRuntimeStateUpdate(42, runtimeInfo);

      expect(update.shadowCljsRuntimeId).toBe(42);
      expect(update.shadowCljsRuntimeInfo).toEqual(runtimeInfo);
    });

    it('creates clear update with undefined values', () => {
      const update = shadowRuntimeCore.createClearRuntimeStateUpdate();

      expect(update.shadowCljsRuntimeId).toBeUndefined();
      expect(update.shadowCljsRuntimeInfo).toBeUndefined();
    });
  });

  describe('decideMessageAction', () => {
    it('returns no-action for non-notify messages', () => {
      const data: shadowRuntimeCore.NotifyMessageData = { op: 'other' };
      const result = shadowRuntimeCore.decideMessageAction(data, undefined);

      expect(result.type).toBe('no-action');
    });

    it('returns no-action for notify without client-id', () => {
      const data: shadowRuntimeCore.NotifyMessageData = { op: 'notify' };
      const result = shadowRuntimeCore.decideMessageAction(data, undefined);

      expect(result.type).toBe('no-action');
    });

    it('returns runtime-disconnected when current runtime disconnects', () => {
      const data: shadowRuntimeCore.NotifyMessageData = {
        op: 'notify',
        'client-id': 42,
        'event-op': 'client-disconnect',
      };
      const result = shadowRuntimeCore.decideMessageAction(data, 42);

      expect(result).toEqual({ type: 'runtime-disconnected', clientId: 42 });
    });

    it('returns no-action when a different runtime disconnects', () => {
      const data: shadowRuntimeCore.NotifyMessageData = {
        op: 'notify',
        'client-id': 99,
        'event-op': 'client-disconnect',
      };
      const result = shadowRuntimeCore.decideMessageAction(data, 42);

      expect(result.type).toBe('no-action');
    });

    it('returns runtime-connected when new runtime appears while disconnected', () => {
      const data: shadowRuntimeCore.NotifyMessageData = {
        op: 'notify',
        'client-id': 42,
        'event-op': 'client-connect',
        'client-info': {
          'client-id': 0, // Will be overwritten
          'build-id': ':app',
          host: 'localhost',
          'worker-id': 1,
          type: 'runtime',
          lang: 'cljs',
          desc: 'New Browser',
        },
      };
      const result = shadowRuntimeCore.decideMessageAction(data, undefined);

      expect(result.type).toBe('runtime-connected');
      if (result.type === 'runtime-connected') {
        expect(result.clientId).toBe(42);
        expect(result.runtimeInfo.description).toBe('New Browser');
        expect(result.runtimeInfo.clientId).toBe(42); // Should be set from outer client-id
      }
    });

    it('returns no-action when runtime connects but already have one', () => {
      const data: shadowRuntimeCore.NotifyMessageData = {
        op: 'notify',
        'client-id': 99,
        'event-op': 'client-connect',
        'client-info': {
          'client-id': 99,
          'build-id': ':app',
          host: 'localhost',
          'worker-id': 1,
          type: 'runtime',
          lang: 'cljs',
        },
      };
      const result = shadowRuntimeCore.decideMessageAction(data, 42);

      expect(result.type).toBe('no-action');
    });

    it('returns no-action when client-connect lacks client-info', () => {
      const data: shadowRuntimeCore.NotifyMessageData = {
        op: 'notify',
        'client-id': 42,
        'event-op': 'client-connect',
      };
      const result = shadowRuntimeCore.decideMessageAction(data, undefined);

      expect(result.type).toBe('no-action');
    });
  });

  describe('formatSinceDescription', () => {
    it('returns "Unknown time" for undefined', () => {
      expect(shadowRuntimeCore.formatSinceDescription(undefined)).toBe('Unknown time');
    });

    it('formats date to locale string', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = shadowRuntimeCore.formatSinceDescription(date);

      // Just verify it produces some non-empty string (locale-dependent)
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toBe('Unknown time');
    });
  });
});
