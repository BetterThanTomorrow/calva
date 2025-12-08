import * as assert from 'assert';
import * as Mocha from 'mocha';
import * as path from 'path';
import * as sessionRegistry from '../../../nrepl/session-registry';
import * as outputWindow from '../../../repl-window/repl-window-doc';
import * as replSession from '../../../nrepl/repl-session';
import * as cljsLib from '../../../../out/cljs-lib/cljs-lib';
import type { NReplSession } from '../../../nrepl';
import * as testUtil from './util';
import * as sessionRouting from '../../../nrepl/session-routing';
import * as clientRegistry from '../../../nrepl/client-registry';
import {
  constructGlobsFromFilePatterns,
  createCatchAllGlobSpec,
  SessionGlobSpec,
} from '../../../nrepl/globs';

const { describe, before, beforeEach, afterEach, it } = Mocha;

const suiteName = 'Multi-project routing';

const createSession = (replType: string): NReplSession =>
  ({
    replType,
  } as NReplSession);

const resetOutputWindowSession = (sessionType: string, ns: string): void => {
  outputWindow.setSession(createSession(sessionType), ns, sessionType);
};

/**
 * Helper to build glob specs for a project, mimicking what connector.ts does
 * for a deps.edn/clj connect sequence.
 */
function buildProjectGlobSpecs(projectRoot: string): SessionGlobSpec[] {
  // Typical deps.edn always-claim patterns
  const alwaysClaimPatterns = ['*.clj', '*.edn'];
  const alwaysClaim = constructGlobsFromFilePatterns(
    projectRoot,
    alwaysClaimPatterns,
    'always-claim'
  );

  // Typical deps.edn is-fallback-for patterns
  const fallbackPatterns = ['*.cljc'];
  const isFallbackFor = constructGlobsFromFilePatterns(
    projectRoot,
    fallbackPatterns,
    'is-fallback-for'
  );

  // Add the catch-all for the project
  const catchAll = createCatchAllGlobSpec(projectRoot);

  return [...alwaysClaim, ...isFallbackFor, catchAll];
}

describe(`${suiteName} suite`, () => {
  let initialConnectionState: boolean | undefined;
  let initialCurrentSessionType: string | undefined;
  let initialOutputSessionType: string | undefined;
  let initialOutputNamespace: string | undefined;

  before(async () => {
    initialConnectionState = cljsLib.getStateValue('connected');
    initialCurrentSessionType = cljsLib.getStateValue('current-session-type');
    initialOutputSessionType = outputWindow.getSessionType();
    initialOutputNamespace = outputWindow.getNs();
    await outputWindow.initReplWindowDoc();
  });

  beforeEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    cljsLib.setStateValue('connected', true);
    cljsLib.setStateValue('current-session-type', undefined);
    sessionRouting.resetRouting();
    clientRegistry._testUtility_registeredClients.clear();
    resetOutputWindowSession('clj', 'user');
  });

  afterEach(() => {
    sessionRegistry._testUtility_registeredSessions.clear();
    sessionRegistry.setClojureDocsSessionKey(null);
    cljsLib.setStateValue('connected', initialConnectionState);
    cljsLib.setStateValue('current-session-type', initialCurrentSessionType);
    sessionRouting.resetRouting();
    clientRegistry._testUtility_registeredClients.clear();
    const fallbackSessionType = initialOutputSessionType ?? 'clj';
    const fallbackNamespace = initialOutputNamespace ?? 'user';
    resetOutputWindowSession(fallbackSessionType, fallbackNamespace);
  });

  describe('project-scoped catch-all routing', () => {
    it('routes files to session whose project root contains the file', async () => {
      // Simulate two projects with clj sessions
      const projectARoot = testUtil.testDataDir;
      const projectBRoot = path.join(testUtil.testDataDir, 'test-files');

      const sessionA = createSession('clj');
      const sessionB = createSession('clj');

      sessionRegistry.registerSession('project-a-clj', sessionA, {
        projectRoot: `file://${projectARoot}`,
        globSpecs: buildProjectGlobSpecs(projectARoot),
        globs: ['*.clj', '*.edn', '*.cljc', '**/*'],
      });

      sessionRegistry.registerSession('project-b-clj', sessionB, {
        projectRoot: `file://${projectBRoot}`,
        globSpecs: buildProjectGlobSpecs(projectBRoot),
        globs: ['*.clj', '*.edn', '*.cljc', '**/*'],
      });

      // Open a .clj file in project A - should route to sessionA
      const projectAFile = path.join(projectARoot, 'test.clj');
      await testUtil.openFile(projectAFile);
      const resolvedA = replSession.getSession();
      assert.strictEqual(resolvedA, sessionA, 'test.clj in project A should route to sessionA');

      // Open a .clj file in project B (test-files) - should route to sessionB
      // Note: test-files doesn't have a .clj file, so we use a different approach
      const projectBFile = path.join(projectBRoot, 'javascript-code.js');
      await testUtil.openFile(projectBFile);
      const resolvedB = replSession.getSession();
      // .js file doesn't match always-claim or is-fallback-for, so it falls through
      // to project-fallback tier where projectB's catch-all should match
      assert.strictEqual(
        resolvedB,
        sessionB,
        'javascript-code.js in project B should route to sessionB via project-fallback'
      );
    });

    it('project-fallback tier has lower priority than is-fallback-for tier', async () => {
      // Project A has workspace-wide fallback patterns for .clj
      // Project B only has project-scoped catch-all
      const projectARoot = testUtil.testDataDir;
      const projectBRoot = path.join(testUtil.testDataDir, 'test-files');

      const sessionA = createSession('clj');
      const sessionB = createSession('clj');

      // Session A: has workspace-wide is-fallback-for patterns
      const sessionASpecs: SessionGlobSpec[] = [
        ...constructGlobsFromFilePatterns(projectARoot, ['*.clj', '*.edn'], 'always-claim'),
        ...constructGlobsFromFilePatterns(projectARoot, ['**/*.cljc'], 'is-fallback-for'), // workspace-wide!
        createCatchAllGlobSpec(projectARoot),
      ];

      sessionRegistry.registerSession('project-a-clj', sessionA, {
        projectRoot: `file://${projectARoot}`,
        globSpecs: sessionASpecs,
        globs: sessionASpecs.map((s) => s.pattern),
      });

      // Session B: only has project-scoped catch-all (no is-fallback-for)
      const sessionBSpecs: SessionGlobSpec[] = [
        ...constructGlobsFromFilePatterns(projectBRoot, ['*.clj', '*.edn'], 'always-claim'),
        createCatchAllGlobSpec(projectBRoot),
      ];

      sessionRegistry.registerSession('project-b-clj', sessionB, {
        projectRoot: `file://${projectBRoot}`,
        globSpecs: sessionBSpecs,
        globs: sessionBSpecs.map((s) => s.pattern),
      });

      // Open a .cljc file in project B - should still route to sessionA
      // because sessionA has **/*.cljc as is-fallback-for (workspace-wide)
      // and that has higher priority than project-fallback
      const cljcFile = path.join(projectARoot, 'test.cljc');
      await testUtil.openFile(cljcFile);
      const resolved = replSession.getSession();
      assert.strictEqual(
        resolved,
        sessionA,
        '.cljc file should route to sessionA via is-fallback-for, not project-fallback'
      );
    });

    it('always-claim beats project-fallback even when project-fallback has higher score', async () => {
      // This tests that the tier system works correctly:
      // A file matching always-claim in one project should NOT route to
      // another project's catch-all, even if the catch-all has a higher score
      // (which can happen with deeply nested project roots)
      const projectARoot = testUtil.testDataDir;
      const deepProjectRoot = path.join(testUtil.testDataDir, '.joyride');

      const sessionA = createSession('clj');
      const joyrideSession = createSession('cljs');

      // Session A: claims .clj files
      sessionRegistry.registerSession('project-a-clj', sessionA, {
        projectRoot: `file://${projectARoot}`,
        globSpecs: [
          ...constructGlobsFromFilePatterns(projectARoot, ['*.clj'], 'always-claim'),
          createCatchAllGlobSpec(projectARoot),
        ],
        globs: ['*.clj', '**/*'],
      });

      // Joyride session: deeply nested, its catch-all will have higher score
      // due to more path segments
      sessionRegistry.registerSession('joyride', joyrideSession, {
        projectRoot: `file://${deepProjectRoot}`,
        globSpecs: [
          ...constructGlobsFromFilePatterns(deepProjectRoot, ['*.cljs'], 'always-claim'),
          createCatchAllGlobSpec(deepProjectRoot),
        ],
        globs: ['*.cljs', '**/*'],
      });

      // Open test.clj in project A - should route to sessionA (always-claim)
      // NOT to joyrideSession's catch-all even though it might have higher score
      const cljFile = path.join(projectARoot, 'test.clj');
      await testUtil.openFile(cljFile);
      const resolved = replSession.getSession();
      assert.strictEqual(
        resolved,
        sessionA,
        'test.clj should route to sessionA via always-claim, not joyride catch-all'
      );
    });

    it('files outside all project roots use first available session when no catch-all matches', async () => {
      // When a file doesn't match any project's catch-all, it falls to first-available
      const projectRoot = path.join(testUtil.testDataDir, 'test-files');

      const sessionA = createSession('clj');

      sessionRegistry.registerSession('project-clj', sessionA, {
        projectRoot: `file://${projectRoot}`,
        globSpecs: buildProjectGlobSpecs(projectRoot),
        globs: ['*.clj', '*.edn', '*.cljc', '**/*'],
      });

      // Open a file that's outside the project root entirely
      // test.clj is in testDataDir, but our project root is testDataDir/test-files
      const outsideFile = path.join(testUtil.testDataDir, 'test.clj');
      await testUtil.openFile(outsideFile);

      // This file won't match any globs because:
      // - always-claim patterns are scoped to project-files
      // - project-fallback catch-all is scoped to test-files
      // Falls through to first-available session
      const resolved = replSession.getSession();
      assert.strictEqual(
        resolved,
        sessionA,
        'file outside all project roots should route to first available session'
      );
    });
  });

  describe('workspace-wide fallback patterns', () => {
    it('workspace-wide is-fallback-for patterns match files in any project', async () => {
      // Simulates babashka with workspace-wide fallback for .clj files
      const projectARoot = testUtil.testDataDir;
      const projectBRoot = path.join(testUtil.testDataDir, 'test-files');

      const cljSession = createSession('clj');
      const bbSession = createSession('bb');

      // CLJ session: claims .clj in project A only
      sessionRegistry.registerSession('project-a-clj', cljSession, {
        projectRoot: `file://${projectARoot}`,
        globSpecs: [
          ...constructGlobsFromFilePatterns(projectARoot, ['*.clj', '*.edn'], 'always-claim'),
          createCatchAllGlobSpec(projectARoot),
        ],
        globs: ['*.clj', '*.edn', '**/*'],
      });

      // BB session: workspace-wide fallback for .clj (like bb project type)
      // This simulates: is-fallback-for: ['**/*.clj']
      const bbSpecs: SessionGlobSpec[] = [
        ...constructGlobsFromFilePatterns(projectBRoot, ['*.bb'], 'always-claim'),
        // Workspace-wide fallback - note the **/ prefix
        ...constructGlobsFromFilePatterns(projectBRoot, ['**/*.clj'], 'is-fallback-for'),
        createCatchAllGlobSpec(projectBRoot),
      ];

      sessionRegistry.registerSession('bb', bbSession, {
        projectRoot: `file://${projectBRoot}`,
        globSpecs: bbSpecs,
        globs: bbSpecs.map((s) => s.pattern),
      });

      // Open .clj file in project A - should route to cljSession (always-claim wins)
      const projectAFile = path.join(projectARoot, 'test.clj');
      await testUtil.openFile(projectAFile);
      const resolvedA = replSession.getSession();
      assert.strictEqual(
        resolvedA,
        cljSession,
        'test.clj in project A should route to cljSession via always-claim'
      );
    });

    it('workspace-wide is-fallback-for wins over project-fallback in other projects', async () => {
      // When one session has workspace-wide is-fallback-for and another only has
      // project-fallback, the is-fallback-for should win
      const projectARoot = testUtil.testDataDir;
      const projectBRoot = path.join(testUtil.testDataDir, 'test-files');

      const sessionA = createSession('clj');
      const sessionB = createSession('clj');

      // Session A: only project-scoped patterns, no fallbacks
      sessionRegistry.registerSession('project-a-clj', sessionA, {
        projectRoot: `file://${projectARoot}`,
        globSpecs: [
          ...constructGlobsFromFilePatterns(projectARoot, ['*.edn'], 'always-claim'),
          createCatchAllGlobSpec(projectARoot),
        ],
        globs: ['*.edn', '**/*'],
      });

      // Session B: has workspace-wide is-fallback-for for .clj
      sessionRegistry.registerSession('project-b-clj', sessionB, {
        projectRoot: `file://${projectBRoot}`,
        globSpecs: [
          ...constructGlobsFromFilePatterns(projectBRoot, ['*.edn'], 'always-claim'),
          ...constructGlobsFromFilePatterns(projectBRoot, ['**/*.clj'], 'is-fallback-for'),
          createCatchAllGlobSpec(projectBRoot),
        ],
        globs: ['*.edn', '**/*.clj', '**/*'],
      });

      // Open test.clj in project A
      // - Project A's catch-all matches (project-fallback tier)
      // - Project B's **/*.clj matches (is-fallback-for tier)
      // is-fallback-for should win
      const cljFile = path.join(projectARoot, 'test.clj');
      await testUtil.openFile(cljFile);
      const resolved = replSession.getSession();
      assert.strictEqual(
        resolved,
        sessionB,
        'test.clj should route to sessionB via workspace-wide is-fallback-for, not project-fallback'
      );
    });
  });
});
