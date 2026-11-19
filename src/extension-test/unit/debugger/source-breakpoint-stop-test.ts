import * as expectLib from 'expect';
import * as model from '../../../../src/cursor-doc/model';
import {
  disabledSourceBreakpointStopTargets,
  consumeDisabledSourceBreakpointStopTarget,
  routeSourceBreakpointStop,
  shouldExposeSourceBreakpointStop,
  shouldExposeContinuedSourceBreakpointStop,
  registerSourceBreakpointChangeListener,
  matchesSourceBreakpointLine,
  matchesSourceBreakpointForm,
  resumeIfDisabledBreakpointPause,
  resumePastDisabledBreakpoint,
  mergeSourceBreakpointStopTargets,
  retireDisabledSourceBreakpointStopTargetsForForm,
  routeMappedSourceBreakpointStop,
  wasSourceBreakpointStopInvalidated,
  guiBreakpointStopRoute,
  shouldContinueToGuiBreakpoint,
  shouldExposeGuiBreakpointStopForSession,
  routeGuiBreakpointStopForSession,
} from '../../../../src/debugger/source-breakpoint-stop';

const sampleFileUri = 'file:///sample.clj';
const otherFileUri = 'file:///other.clj';
const clearResponseAction = 'clear-response';

describe('GUI source breakpoint stop selection', () => {
  const targets = [{ file: sampleFileUri, formStart: 10, endOffset: 24 }];

  it('routes automatic Calva continuation through strict target filtering', () => {
    expectLib.expect(shouldContinueToGuiBreakpoint(true, true)).toBe(true);
    expectLib.expect(shouldContinueToGuiBreakpoint(false, true)).toBe(false);
    expectLib.expect(shouldContinueToGuiBreakpoint(true, false)).toBe(false);
    expectLib.expect(guiBreakpointStopRoute(true, true, true)).toBe('continued');
    expectLib.expect(guiBreakpointStopRoute(true, false, true)).toBe('ignore');
    expectLib.expect(guiBreakpointStopRoute(true, true, false)).toBe('ignore');
  });

  it('keeps deliberate stops on the permissive ordinary route', () => {
    expectLib.expect(guiBreakpointStopRoute(false, false, false)).toBe('ordinary');
  });

  it('uses the production decision and dispatch seam for continuation and ordinary stops', async () => {
    const enabledTargets = [{ ...targets[0], enabled: true, breakpointId: 'gui-breakpoint' }];
    const routeStop = (
      hasActiveDebugSession: boolean,
      isContinuing: boolean,
      isCalvaDebugSession: boolean,
      stop?: { file: string; formStart: number; stopOffset: number }
    ) => {
      const actions: string[] = [];
      return routeGuiBreakpointStopForSession(
        hasActiveDebugSession,
        isContinuing,
        isCalvaDebugSession,
        {
          getTargets: () => enabledTargets,
          getGeneration: () => 0,
          mapStop: () => Promise.resolve(stop),
        },
        () => actions.push('expose'),
        () => actions.push('advance')
      ).then(() => actions);
    };

    expectLib
      .expect(
        await routeStop(true, true, true, {
          file: sampleFileUri,
          formStart: 10,
          stopOffset: 18,
        })
      )
      .toEqual(['advance']);
    expectLib
      .expect(
        await routeStop(true, true, true, {
          file: sampleFileUri,
          formStart: 10,
          stopOffset: 24,
        })
      )
      .toEqual(['expose']);
    expectLib
      .expect(
        await routeStop(false, false, false, {
          file: otherFileUri,
          formStart: 90,
          stopOffset: 120,
        })
      )
      .toEqual(['expose']);
    expectLib.expect(await routeStop(true, true, true)).toEqual(['expose']);
  });

  it('matches a paused source location to the disabled gutter breakpoint line', () => {
    expectLib
      .expect(
        matchesSourceBreakpointLine(
          { file: sampleFileUri, line: 4 },
          { uri: sampleFileUri, line: 3 }
        )
      )
      .toBe(true);
    expectLib
      .expect(
        matchesSourceBreakpointLine(
          { file: sampleFileUri, line: 5 },
          { uri: sampleFileUri, line: 3 }
        )
      )
      .toBe(false);
    expectLib
      .expect(
        matchesSourceBreakpointLine(
          { file: otherFileUri, line: 4 },
          { uri: sampleFileUri, line: 3 }
        )
      )
      .toBe(false);
  });

  it('resumes a stale pause elsewhere in the disabled breakpoint form', async () => {
    const actions: string[] = [];
    model.initScanner(20000);
    const source = [
      '(defn serve-client [client]',
      '  (let [server (start-server client)]',
      ...Array.from({ length: 13 }, () => '    (touch server)'),
      '    (let [result (serve server)]',
      '      (prepare-result result)',
      '      (validate-result result)',
      '      (transform-result result)',
      '      (record-result result)',
      ...Array.from({ length: 4 }, () => '      (touch result)'),
      '      (s/consume',
      '        server result)',
      '      result)))',
      '(defn unrelated [] (pause-here))',
    ].join('\n');
    const document = new model.StringDocument(source);
    const responseOffset = source.split('\n').slice(0, 14).join('\n').length + 1;
    const breakpointOffset = source.split('\n').slice(0, 24).join('\n').length + 1;
    const responseForm = document.getTokenCursor(responseOffset).rangeForDefun(responseOffset);
    const breakpointForm = document
      .getTokenCursor(breakpointOffset)
      .rangeForDefun(breakpointOffset);
    const pausedAtOuterLet = {
      file: sampleFileUri,
      line: 15,
      formStart: responseForm?.[0],
    };
    const disabledNestedTarget = {
      file: sampleFileUri,
      line: 25,
      formStart: breakpointForm?.[0],
    };
    expectLib.expect(source.split('\n')[pausedAtOuterLet.line - 1]).toContain('(touch server)');
    expectLib.expect(source.split('\n')[disabledNestedTarget.line - 1]).toContain('(s/consume');
    expectLib.expect(responseForm?.[0]).toBe(breakpointForm?.[0]);
    const resumeActions = {
      clearStop: () => actions.push(clearResponseAction),
      notifyContinued: () => {
        actions.push('continued');
      },
      advance: () => actions.push('advance'),
    };
    expectLib
      .expect(
        await resumeIfDisabledBreakpointPause(
          pausedAtOuterLet,
          matchesSourceBreakpointForm(
            pausedAtOuterLet.formStart,
            disabledNestedTarget.formStart,
            false
          ),
          resumeActions
        )
      )
      .toBe(true);
    expectLib.expect(actions).toEqual([clearResponseAction, 'continued', 'advance']);
    const unrelatedOffset = source.indexOf('(defn unrelated');
    const unrelatedForm = document.getTokenCursor(unrelatedOffset).rangeForDefun(unrelatedOffset);
    expectLib
      .expect(
        matchesSourceBreakpointForm(unrelatedForm?.[0], disabledNestedTarget.formStart, false)
      )
      .toBe(false);
    expectLib
      .expect(matchesSourceBreakpointForm(responseForm?.[0], breakpointForm?.[0], true))
      .toBe(false);

    // An enabled breakpoint elsewhere in this defn is not at the paused
    // response location. It must remain eligible to surface after advancing.
    expectLib
      .expect(matchesSourceBreakpointForm(responseForm?.[0], breakpointForm?.[0], false))
      .toBe(true);

    const unrelatedActions: string[] = [];
    const didResumeUnrelatedPause = await resumeIfDisabledBreakpointPause(
      { ...pausedAtOuterLet, formStart: unrelatedForm?.[0] },
      matchesSourceBreakpointForm(unrelatedForm?.[0], disabledNestedTarget.formStart, false),
      {
        clearStop: () => unrelatedActions.push(clearResponseAction),
        notifyContinued: () => {
          unrelatedActions.push('continued');
        },
        advance: () => unrelatedActions.push('advance'),
      }
    );
    expectLib.expect(didResumeUnrelatedPause).toBe(false);
    expectLib.expect(unrelatedActions).toEqual([]);

    const enabledTargetActions: string[] = [];
    const didResumeEnabledTarget = await resumeIfDisabledBreakpointPause(
      pausedAtOuterLet,
      matchesSourceBreakpointForm(responseForm?.[0], breakpointForm?.[0], true),
      {
        clearStop: () => enabledTargetActions.push(clearResponseAction),
        notifyContinued: () => {
          enabledTargetActions.push('continued');
        },
        advance: () => enabledTargetActions.push('advance'),
      }
    );
    expectLib.expect(didResumeEnabledTarget).toBe(false);
    expectLib.expect(enabledTargetActions).toEqual([]);
  });

  it('preserves unrelated pauses and a second enabled breakpoint in the same form', () => {
    model.initScanner(20000);
    const source =
      '(defn serve-client []\n  (let [client (open-client)]\n    (s/consume client)))\n(defn other []\n  (pause-here))';
    const document = new model.StringDocument(source);
    const firstForm = document.getTokenCursor(10).rangeForDefun(10)?.[0];
    const secondFormOffset = source.indexOf('(defn other');
    const secondForm = document
      .getTokenCursor(secondFormOffset)
      .rangeForDefun(secondFormOffset)?.[0];
    expectLib.expect(matchesSourceBreakpointForm(secondForm, firstForm, false)).toBe(false);
    expectLib.expect(matchesSourceBreakpointForm(100, 100, true)).toBe(false);
    expectLib.expect(matchesSourceBreakpointForm(undefined, 100, false)).toBe(false);
  });

  it('waits for the continued event before advancing to the next REPL stop', async () => {
    const actions: string[] = [];
    const response = { id: 'response' };
    let finishContinued!: () => void;
    const continued = new Promise<void>((resolve) => {
      finishContinued = resolve;
    });
    const resuming = resumePastDisabledBreakpoint(response, {
      clearStop: () => actions.push('clear'),
      notifyContinued: () => {
        actions.push('continued');
        return continued;
      },
      advance: (current) => actions.push(current === response ? 'advance' : 'wrong-response'),
    });
    expectLib.expect(actions).toEqual(['clear', 'continued']);
    finishContinued();
    await resuming;
    expectLib.expect(actions).toEqual(['clear', 'continued', 'advance']);
  });

  it('keeps the stale response cleared and does not advance when continued notification fails', async () => {
    const actions: string[] = [];
    const response = { id: 'response' };
    await expectLib
      .expect(
        resumePastDisabledBreakpoint(response, {
          clearStop: () => actions.push('clear'),
          notifyContinued: () => {
            actions.push('continued');
            return Promise.reject(new Error('continued event failed'));
          },
          advance: () => actions.push('advance'),
        })
      )
      .rejects.toThrow('continued event failed');

    expectLib.expect(actions).toEqual(['clear', 'continued']);
  });

  it('advances synthetic stops in the target form and exposes the configured stop', () => {
    expectLib.expect(shouldExposeSourceBreakpointStop(targets, sampleFileUri, 10, 18)).toBe(false);
    expectLib.expect(shouldExposeSourceBreakpointStop(targets, sampleFileUri, 10, 24)).toBe(true);
  });

  it('during continuation exposes only enabled targets across all configured forms', () => {
    const enabled = { ...targets[0], enabled: true };
    const disabled = { ...targets[0], formStart: 40, endOffset: 54, enabled: false };

    expectLib
      .expect(shouldExposeContinuedSourceBreakpointStop([enabled, disabled], sampleFileUri, 10, 24))
      .toBe(true);
    expectLib
      .expect(shouldExposeContinuedSourceBreakpointStop([enabled, disabled], sampleFileUri, 10, 18))
      .toBe(false);
    expectLib
      .expect(shouldExposeContinuedSourceBreakpointStop([enabled, disabled], sampleFileUri, 40, 54))
      .toBe(false);
    expectLib
      .expect(shouldExposeContinuedSourceBreakpointStop([], sampleFileUri, 40, 54))
      .toBe(true);
    expectLib.expect(shouldExposeSourceBreakpointStop([enabled], sampleFileUri, 40, 54)).toBe(true);
  });

  it('retains enabled targets from other forms when one form is reconciled', () => {
    const otherForm = {
      file: sampleFileUri,
      formStart: 40,
      endOffset: 54,
      enabled: true,
      breakpointId: 'other-form',
    };
    const currentForm = {
      file: sampleFileUri,
      formStart: 10,
      endOffset: 24,
      enabled: true,
      breakpointId: 'current-form',
    };
    const next = mergeSourceBreakpointStopTargets([otherForm], [currentForm]);

    expectLib.expect(next).toEqual([otherForm, currentForm]);
    expectLib.expect(shouldExposeSourceBreakpointStop(next, sampleFileUri, 40, 54)).toBe(true);
    expectLib.expect(shouldExposeSourceBreakpointStop(next, sampleFileUri, 10, 24)).toBe(true);
  });

  it('keeps shared-location targets distinct through successive disables and reconciliation', () => {
    const first = { id: 'first', enabled: true };
    const second = { id: 'second', enabled: true };
    const firstTarget = { ...targets[0], enabled: true, breakpointId: first.id };
    const secondTarget = { ...targets[0], enabled: true, breakpointId: second.id };
    let remembered = mergeSourceBreakpointStopTargets(undefined, [firstTarget, secondTarget]);
    const notify = (changed: typeof first) => {
      registerSourceBreakpointChangeListener(
        (handler) => handler,
        () => remembered,
        () => undefined
      )({ changed: [changed], removed: [] });
    };

    notify({ ...first, enabled: false });
    remembered = mergeSourceBreakpointStopTargets(remembered, [secondTarget]);
    expectLib.expect(remembered).toEqual([
      { ...firstTarget, enabled: false },
      { ...secondTarget, enabled: true },
    ]);

    notify({ ...second, enabled: false });
    expectLib.expect(remembered.every((target) => target.enabled === false)).toBe(true);
  });

  it('exposes ordinary stops outside the configured target form or file', () => {
    expectLib.expect(shouldExposeSourceBreakpointStop(targets, sampleFileUri, 30, 24)).toBe(true);
    expectLib.expect(shouldExposeSourceBreakpointStop(targets, otherFileUri, 10, 24)).toBe(true);
    expectLib.expect(shouldExposeSourceBreakpointStop(undefined, sampleFileUri, 10, 18)).toBe(true);
  });

  it('keeps unrelated ordinary stops visible when a target in the same file is invalidated', () => {
    const invalidated = [{ ...targets[0], enabled: false, breakpointId: 'gui' }];
    expectLib
      .expect(shouldExposeSourceBreakpointStop(invalidated, sampleFileUri, 30, 24))
      .toBe(true);
    expectLib
      .expect(shouldExposeSourceBreakpointStop(invalidated, otherFileUri, 30, 24))
      .toBe(true);
    expectLib
      .expect(
        shouldExposeSourceBreakpointStop(
          [...invalidated, { ...targets[0], enabled: true, breakpointId: 'current' }],
          sampleFileUri,
          10,
          24
        )
      )
      .toBe(true);
  });

  it('identifies a delayed stop for a target removed by a newer breakpoint change', () => {
    const previous = [{ ...targets[0], enabled: true, breakpointId: 'gui' }];
    const previousSnapshot = previous.map((target) => ({ ...target }));
    const moved = [{ ...targets[0], endOffset: 30, enabled: true, breakpointId: 'gui' }];
    const current = mergeSourceBreakpointStopTargets(previous, moved);

    expectLib
      .expect(wasSourceBreakpointStopInvalidated(previousSnapshot, current, sampleFileUri, 10, 24))
      .toBe(true);
    expectLib
      .expect(wasSourceBreakpointStopInvalidated(previousSnapshot, current, sampleFileUri, 10, 30))
      .toBe(false);
    expectLib
      .expect(wasSourceBreakpointStopInvalidated(previousSnapshot, current, sampleFileUri, 30, 24))
      .toBe(false);
  });

  it('routes the selected stop to the visible debugger or advances middleware', () => {
    const actions: string[] = [];
    const route = (offset: number) =>
      routeSourceBreakpointStop(
        shouldExposeSourceBreakpointStop(targets, sampleFileUri, 10, offset),
        () => actions.push('expose'),
        () => actions.push('advance')
      );

    route(18);
    route(24);

    expectLib.expect(actions).toEqual(['advance', 'expose']);
  });

  it('updates remembered targets immediately on disable and re-enable events', () => {
    const breakpoint = { id: 'gui', enabled: true };
    const target = { ...targets[0], enabled: true, breakpointId: breakpoint.id };
    const remembered = [target];

    breakpoint.enabled = false;
    registerSourceBreakpointChangeListener(
      (handler) => handler,
      () => remembered,
      () => undefined
    )({
      changed: [breakpoint],
      removed: [],
    });
    expectLib
      .expect(shouldExposeSourceBreakpointStop(remembered, sampleFileUri, 10, 24))
      .toBe(false);

    breakpoint.enabled = true;
    registerSourceBreakpointChangeListener(
      (handler) => handler,
      () => remembered,
      () => undefined
    )({
      changed: [breakpoint],
      removed: [],
    });
    expectLib
      .expect(shouldExposeSourceBreakpointStop(remembered, sampleFileUri, 10, 24))
      .toBe(false);
    mergeSourceBreakpointStopTargets(remembered, [{ ...target, enabled: true }]);
    expectLib
      .expect(shouldExposeSourceBreakpointStop(remembered, sampleFileUri, 10, 24))
      .toBe(true);
  });

  it('retains disabled target metadata so a stale synthetic pause is advanced', () => {
    const disabled = { ...targets[0], enabled: false, breakpointId: 'gui' };
    const enabled = { ...targets[0], enabled: true, breakpointId: 'other' };
    const remaining = disabledSourceBreakpointStopTargets([disabled, enabled]);

    expectLib.expect(remaining).toEqual([disabled]);
    expectLib
      .expect(shouldExposeSourceBreakpointStop(remaining, sampleFileUri, 10, 24))
      .toBe(false);
    expectLib.expect(shouldExposeSourceBreakpointStop(remaining, sampleFileUri, 30, 24)).toBe(true);
  });

  it('retires only disabled targets after their form has been reevaluated', () => {
    const disabled = { ...targets[0], enabled: false, breakpointId: 'disabled' };
    const enabled = { ...targets[0], enabled: true, breakpointId: 'enabled' };
    const otherForm = { ...targets[0], formStart: 40, enabled: false, breakpointId: 'other-form' };

    const remaining = retireDisabledSourceBreakpointStopTargetsForForm(
      [disabled, enabled, otherForm],
      sampleFileUri,
      10
    );

    expectLib.expect(remaining).toEqual([enabled, otherForm]);
    expectLib
      .expect(shouldExposeSourceBreakpointStop(remaining, sampleFileUri, 40, 24))
      .toBe(false);
    expectLib.expect(shouldExposeSourceBreakpointStop(remaining, sampleFileUri, 10, 24)).toBe(true);
  });

  it('keeps obsolete mapped locations disabled when a breakpoint moves, then restores the current location', () => {
    const oldTarget = { ...targets[0], enabled: true, breakpointId: 'gui' };
    const movedTarget = { ...targets[0], endOffset: 30, enabled: true, breakpointId: 'gui' };

    const afterMove = mergeSourceBreakpointStopTargets([oldTarget], [movedTarget]);
    expectLib.expect(afterMove).toEqual([{ ...oldTarget, enabled: false }, movedTarget]);
    expectLib
      .expect(shouldExposeSourceBreakpointStop(afterMove, sampleFileUri, 10, 24))
      .toBe(false);
    expectLib.expect(shouldExposeSourceBreakpointStop(afterMove, sampleFileUri, 10, 30)).toBe(true);

    const afterReenable = mergeSourceBreakpointStopTargets(afterMove, [oldTarget]);
    expectLib.expect(afterReenable[0].enabled).toBe(true);
    expectLib.expect(afterReenable[1].enabled).toBe(false);
  });

  it('retains a disabled target after advancing its stale pause', () => {
    const disabled = { ...targets[0], enabled: false, breakpointId: 'gui' };
    const remembered = [disabled];

    expectLib
      .expect(consumeDisabledSourceBreakpointStopTarget(remembered, sampleFileUri, 10, 24))
      .toBe(true);
    expectLib.expect(remembered).toEqual([disabled]);
    expectLib
      .expect(consumeDisabledSourceBreakpointStopTarget(remembered, sampleFileUri, 10, 24))
      .toBe(true);
  });

  it('continues advancing repeated pauses from code instrumented before disable', () => {
    const disabled = { ...targets[0], enabled: false, breakpointId: 'gui' };
    const remembered = [disabled];

    expectLib
      .expect(consumeDisabledSourceBreakpointStopTarget(remembered, sampleFileUri, 10, 24))
      .toBe(true);
    // A second pause can already be queued by the old instrumented evaluation.
    // It must remain classified as stale until reevaluation replaced that code.
    expectLib
      .expect(shouldExposeSourceBreakpointStop(remembered, sampleFileUri, 10, 24))
      .toBe(false);
    expectLib.expect(remembered).toEqual([disabled]);
  });

  it('does not let a disabled target suppress an enabled target at the same offset', () => {
    const remembered = [
      { ...targets[0], enabled: false, breakpointId: 'disabled' },
      { ...targets[0], enabled: true, breakpointId: 'enabled' },
    ];

    expectLib
      .expect(consumeDisabledSourceBreakpointStopTarget(remembered, sampleFileUri, 10, 24))
      .toBe(false);
    expectLib.expect(remembered).toHaveLength(2);
    expectLib
      .expect(shouldExposeSourceBreakpointStop(remembered, sampleFileUri, 10, 24))
      .toBe(true);
  });

  it('advances a stale disabled stop but exposes an enabled colocated GUI target', async () => {
    const configuredTargets = [
      { ...targets[0], enabled: false, breakpointId: 'disabled' },
      { ...targets[0], enabled: true, breakpointId: 'enabled' },
    ];
    const routeStop = async () => {
      const actions: string[] = [];
      await routeGuiBreakpointStopForSession(
        false,
        false,
        false,
        {
          getTargets: () => configuredTargets,
          getGeneration: () => 0,
          mapStop: () =>
            Promise.resolve({
              file: sampleFileUri,
              formStart: 10,
              stopOffset: 24,
            }),
          consumeDisabled: (stop) =>
            consumeDisabledSourceBreakpointStopTarget(
              configuredTargets,
              stop.file,
              stop.formStart,
              stop.stopOffset
            ),
        },
        () => actions.push('expose'),
        () => actions.push('advance')
      );
      return actions;
    };

    expectLib.expect(await routeStop()).toEqual(['expose']);
    configuredTargets.pop();
    expectLib.expect(await routeStop()).toEqual(['advance']);
  });

  it('keeps the changed-event state while form reconciliation is pending', () => {
    const target = { ...targets[0], enabled: true, breakpointId: 'gui' };
    const remembered = [target];
    const disabled = { id: 'gui', enabled: false };

    // VS Code may still expose the old snapshot when its changed event fires.
    // The event must immediately suppress the old instrumented stop.
    registerSourceBreakpointChangeListener(
      (handler) => handler,
      () => remembered,
      () => undefined
    )({
      changed: [disabled],
      removed: [],
    });
    expectLib
      .expect(shouldExposeSourceBreakpointStop(remembered, sampleFileUri, 10, 24))
      .toBe(false);

    // The changed target remains invalid until replacement code is instrumented.
    registerSourceBreakpointChangeListener(
      (handler) => handler,
      () => remembered,
      () => undefined
    )({
      changed: [{ id: 'gui', enabled: true }],
      removed: [],
    });
    expectLib
      .expect(shouldExposeSourceBreakpointStop(remembered, sampleFileUri, 10, 24))
      .toBe(false);
    mergeSourceBreakpointStopTargets(remembered, [target]);
    expectLib
      .expect(shouldExposeSourceBreakpointStop(remembered, sampleFileUri, 10, 24))
      .toBe(true);
  });

  it('updates stop selection through the callback registered for breakpoint changes', () => {
    const target = { ...targets[0], enabled: true, breakpointId: 'gui' };
    type ChangeEvent = { changed: { id: string; enabled: boolean }[]; removed: [] };
    let registered: ((event: ChangeEvent) => void) | undefined;
    let reconciled = false;
    const register = (callback: (event: ChangeEvent) => void) => {
      registered = callback;
    };
    registerSourceBreakpointChangeListener(
      (subscribe) => {
        register(subscribe);
        return undefined;
      },
      () => [target],
      () => {
        reconciled = true;
      }
    );

    registered?.({ changed: [{ id: 'gui', enabled: false }], removed: [] });

    expectLib.expect(reconciled).toBe(true);
    const actions: string[] = [];
    const routeStop = () =>
      routeSourceBreakpointStop(
        shouldExposeSourceBreakpointStop([target], sampleFileUri, 10, 24),
        () => actions.push('expose'),
        () => actions.push('advance')
      );
    routeStop();
    expectLib.expect(actions).toEqual(['advance']);

    registered?.({ changed: [{ id: 'gui', enabled: true }], removed: [] });
    expectLib.expect(target.enabled).toBe(false);
    mergeSourceBreakpointStopTargets([target], [target]);
    routeStop();
    expectLib.expect(actions).toEqual(['advance', 'expose']);
  });

  it('uses the latest enabled state when a mapped stop completes after the change event', async () => {
    const breakpoint = { id: 'gui', enabled: true };
    const target = { ...targets[0], enabled: true, breakpointId: breakpoint.id };
    let registered: ((event: { changed: typeof breakpoint[]; removed: [] }) => void) | undefined;
    const currentTargets = [target];
    registerSourceBreakpointChangeListener(
      (subscribe) => {
        registered = subscribe;
        return undefined;
      },
      () => currentTargets,
      () => undefined
    );

    let finishMapping!: (stop: { file: string; formStart: number; stopOffset: number }) => void;
    const mappedStop = new Promise<{ file: string; formStart: number; stopOffset: number }>(
      (resolve) => {
        finishMapping = resolve;
      }
    );
    let generation = 0;
    const decision = routeMappedSourceBreakpointStop({
      getTargets: () => currentTargets,
      getGeneration: () => generation,
      mapStop: () => mappedStop,
      consumeDisabled: (stop) =>
        consumeDisabledSourceBreakpointStopTarget(
          currentTargets,
          stop.file,
          stop.formStart,
          stop.stopOffset
        ),
    });

    breakpoint.enabled = false;
    registered?.({ changed: [breakpoint], removed: [] });
    generation++;
    finishMapping({ file: sampleFileUri, formStart: 10, stopOffset: 24 });
    expectLib.expect(await decision).toBe(false);

    breakpoint.enabled = true;
    registered?.({ changed: [breakpoint], removed: [] });
    expectLib.expect(target.enabled).toBe(false);
    mergeSourceBreakpointStopTargets(currentTargets, [
      { ...target, enabled: true, breakpointId: breakpoint.id },
    ]);
    expectLib
      .expect(
        await routeMappedSourceBreakpointStop({
          getTargets: () => currentTargets,
          getGeneration: () => generation,
          mapStop: () => Promise.resolve({ file: sampleFileUri, formStart: 10, stopOffset: 24 }),
          consumeDisabled: (stop) =>
            consumeDisabledSourceBreakpointStopTarget(
              currentTargets,
              stop.file,
              stop.formStart,
              stop.stopOffset
            ),
        })
      )
      .toBe(true);
  });

  it('routes a delayed mapped stop against current targets and exposes unrelated or unmappable stops', async () => {
    const currentTargets = [{ ...targets[0], enabled: true, breakpointId: 'current' }];
    let generation = 0;
    let finishMapping!: (stop: { file: string; formStart: number; stopOffset: number }) => void;
    const pending = new Promise<{ file: string; formStart: number; stopOffset: number }>(
      (resolve) => (finishMapping = resolve)
    );
    const decision = routeMappedSourceBreakpointStop({
      getTargets: () => currentTargets,
      getGeneration: () => generation,
      mapStop: () => pending,
    });
    currentTargets[0].enabled = false;
    currentTargets.push({
      ...targets[0],
      formStart: 30,
      endOffset: 40,
      enabled: true,
      breakpointId: 'moved',
    });
    generation++;
    finishMapping({ file: sampleFileUri, formStart: 10, stopOffset: 24 });
    expectLib.expect(await decision).toBe(false);

    expectLib
      .expect(
        await routeMappedSourceBreakpointStop({
          getTargets: () => currentTargets,
          getGeneration: () => generation,
          mapStop: () => Promise.resolve({ file: sampleFileUri, formStart: 99, stopOffset: 500 }),
        })
      )
      .toBe(true);
    expectLib
      .expect(
        await routeMappedSourceBreakpointStop({
          getTargets: () => currentTargets,
          getGeneration: () => generation,
          mapStop: () => Promise.resolve(undefined),
        })
      )
      .toBe(true);
  });

  it('keeps an enabled stop target when another breakpoint in the form is disabled', () => {
    const disabled = { id: 'disabled', enabled: false };
    const enabled = { id: 'enabled', enabled: true };
    const remembered = [
      { ...targets[0], endOffset: 24, enabled: true, breakpointId: disabled.id },
      { ...targets[0], endOffset: 30, enabled: true, breakpointId: enabled.id },
    ];
    registerSourceBreakpointChangeListener(
      (handler) => handler,
      () => remembered,
      () => undefined
    )({
      changed: [disabled],
      removed: [],
    });

    expectLib
      .expect(shouldExposeSourceBreakpointStop(remembered, sampleFileUri, 10, 24))
      .toBe(false);
    expectLib
      .expect(shouldExposeSourceBreakpointStop(remembered, sampleFileUri, 10, 30))
      .toBe(true);
  });

  it('invalidates a removed breakpoint target while preserving ordinary stops', () => {
    const removed = { id: 'gui', enabled: true };
    const remembered = [{ ...targets[0], enabled: true, breakpointId: removed.id }];

    registerSourceBreakpointChangeListener(
      (handler) => handler,
      () => remembered,
      () => undefined
    )({
      changed: [],
      removed: [removed],
    });

    expectLib
      .expect(shouldExposeSourceBreakpointStop(remembered, sampleFileUri, 10, 24))
      .toBe(false);
    expectLib
      .expect(shouldExposeSourceBreakpointStop(remembered, sampleFileUri, 30, 24))
      .toBe(true);
  });
});
