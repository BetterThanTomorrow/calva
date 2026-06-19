import * as expectLib from 'expect';
import * as shadowRuntimeCore from '../../../src/shadow-cljs-runtime-core';
import type * as clientRegistry from '../../../src/nrepl/client-registry';

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

      expectLib.expect(result.runtimeId).toBe(42);
      expectLib.expect(result.buildId).toBe(':app');
      expectLib.expect(result.host).toBe('localhost');
      expectLib.expect(result.workerId).toBe(1);
      expectLib.expect(result.description).toBe('Test Browser');
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
      expectLib.expect(result.description).toBe('Mozilla/5.0');
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
      expectLib.expect(result.description).toBe('No description');
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
      expectLib.expect(result.sinceInst).toBe(testDate.getTime());
    });
  });

  describe('decideMessageAction', () => {
    it('returns no-action for non-notify messages', () => {
      const data: shadowRuntimeCore.NotifyMessageData = { op: 'other' };
      const result = shadowRuntimeCore.decideMessageAction(data, undefined);

      expectLib.expect(result.type).toBe('no-action');
    });

    it('returns no-action for notify without client-id', () => {
      const data: shadowRuntimeCore.NotifyMessageData = { op: 'notify' };
      const result = shadowRuntimeCore.decideMessageAction(data, undefined);

      expectLib.expect(result.type).toBe('no-action');
    });

    it('returns runtime-disconnected when current runtime disconnects', () => {
      const data: shadowRuntimeCore.NotifyMessageData = {
        op: 'notify',
        'client-id': 42,
        'event-op': 'client-disconnect',
      };
      const result = shadowRuntimeCore.decideMessageAction(data, 42);

      expectLib.expect(result).toEqual({ type: 'runtime-disconnected', runtimeId: 42 });
    });

    it('returns no-action when a different runtime disconnects', () => {
      const data: shadowRuntimeCore.NotifyMessageData = {
        op: 'notify',
        'client-id': 99,
        'event-op': 'client-disconnect',
      };
      const result = shadowRuntimeCore.decideMessageAction(data, 42);

      expectLib.expect(result.type).toBe('no-action');
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

      expectLib.expect(result.type).toBe('runtime-connected');
      if (result.type === 'runtime-connected') {
        expectLib.expect(result.runtimeId).toBe(42);
        expectLib.expect(result.runtimeInfo.description).toBe('New Browser');
        expectLib.expect(result.runtimeInfo.runtimeId).toBe(42); // Should be set from outer client-id
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

      expectLib.expect(result.type).toBe('no-action');
    });

    it('returns no-action when client-connect lacks client-info', () => {
      const data: shadowRuntimeCore.NotifyMessageData = {
        op: 'notify',
        'client-id': 42,
        'event-op': 'client-connect',
      };
      const result = shadowRuntimeCore.decideMessageAction(data, undefined);

      expectLib.expect(result.type).toBe('no-action');
    });
  });

  describe('formatSinceDescription', () => {
    it('returns "Unknown time" for undefined', () => {
      expectLib.expect(shadowRuntimeCore.formatSinceDescription(undefined)).toBe('Unknown time');
    });

    it('formats date to locale string', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = shadowRuntimeCore.formatSinceDescription(date);

      // Just verify it produces some non-empty string (locale-dependent)
      expectLib.expect(result.length).toBeGreaterThan(0);
      expectLib.expect(result).not.toBe('Unknown time');
    });
  });
});
