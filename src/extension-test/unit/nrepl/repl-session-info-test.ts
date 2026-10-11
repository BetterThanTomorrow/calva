import * as expectLib from 'expect';
import type { SessionMetadata } from '../../../../src/nrepl/session-registry';
import type { ConnectionState } from '../../../../src/nrepl/client-registry';
import { buildReplSessionInfo } from '../../../../src/nrepl/repl-session-info';

describe('buildReplSessionInfo', () => {
  it('includes clientKey from the session connection owner', () => {
    const session: SessionMetadata = {
      key: 'clj',
      connectionOwnerId: 'nrepl-client-1',
      globs: ['**/*.clj'],
    };

    expectLib.expect(buildReplSessionInfo(session, 'clj', undefined, undefined)).toEqual({
      clientKey: 'nrepl-client-1',
      replSessionKey: 'clj',
      projectRoot: undefined,
      lastActivity: undefined,
      globs: ['**/*.clj'],
      currentRoutedTarget: true,
      replType: 'clj',
      hasBuilds: false,
      supportsRuntimes: false,
      availableBuilds: undefined,
      currentlyConnectedCljsBuild: undefined,
      currentlyConnectedRuntimeId: undefined,
    });
  });

  it('includes clientKey on a cljs session with connection state', () => {
    const session: SessionMetadata = {
      key: 'cljs',
      connectionOwnerId: 'nrepl-client-2',
      isSecondary: true,
    };
    const connState: ConnectionState = {
      cljsBuild: ':app',
      cljsTypeName: 'shadow-cljs',
      hasBuilds: true,
      availableBuilds: [':app', ':node'],
      shadowCljsRuntimeId: 42,
    };

    const info = buildReplSessionInfo(session, 'clj', 'apps/ui', connState);
    expectLib.expect(info.clientKey).toBe('nrepl-client-2');
    expectLib.expect(info.replSessionKey).toBe('cljs');
    expectLib.expect(info.projectRoot).toBe('apps/ui');
    expectLib.expect(info.replType).toBe('cljs');
    expectLib.expect(info.hasBuilds).toBe(true);
    expectLib.expect(info.supportsRuntimes).toBe(true);
    expectLib.expect(info.availableBuilds).toEqual([':app', ':node']);
    expectLib.expect(info.currentlyConnectedCljsBuild).toBe(':app');
    expectLib.expect(info.currentlyConnectedRuntimeId).toBe(42);
    expectLib.expect(info.currentRoutedTarget).toBe(false);
  });

  it('omits clientKey when the session has no connection owner', () => {
    const session: SessionMetadata = { key: 'clj' };
    expectLib
      .expect(buildReplSessionInfo(session, undefined, undefined, undefined).clientKey)
      .toBe(undefined);
  });

  it('returns copies of globs and availableBuilds so callers cannot mutate the registry', () => {
    const globs = ['**/*.clj'];
    const availableBuilds = [':app', ':node'];
    const session: SessionMetadata = {
      key: 'cljs',
      connectionOwnerId: 'nrepl-client-2',
      isSecondary: true,
      globs,
    };
    const connState: ConnectionState = {
      cljsBuild: ':app',
      cljsTypeName: 'shadow-cljs',
      hasBuilds: true,
      availableBuilds,
      shadowCljsRuntimeId: 42,
    };

    const info = buildReplSessionInfo(session, 'clj', 'apps/ui', connState);
    const returnedGlobs = info.globs;
    const returnedBuilds = info.availableBuilds;
    if (returnedGlobs === undefined || returnedBuilds === undefined) {
      throw new Error('expected globs and availableBuilds');
    }
    returnedGlobs.push('**/*.evil');
    returnedBuilds.push(':evil');

    const again = buildReplSessionInfo(session, 'clj', 'apps/ui', connState);
    expectLib.expect(again.globs).toEqual(['**/*.clj']);
    expectLib.expect(again.availableBuilds).toEqual([':app', ':node']);
    expectLib.expect(globs).toEqual(['**/*.clj']);
    expectLib.expect(availableBuilds).toEqual([':app', ':node']);
  });
});
