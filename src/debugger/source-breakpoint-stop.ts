export type SourceBreakpointStopTarget = {
  file: string;
  formStart: number;
  endOffset: number;
  enabled?: boolean;
};

export function shouldContinueToGuiBreakpoint(
  isContinuing: boolean,
  isCalvaDebugSession: boolean
): boolean {
  return isContinuing && isCalvaDebugSession;
}

export function guiBreakpointStopRoute(
  hasActiveDebugSession: boolean,
  isContinuing: boolean,
  isCalvaDebugSession: boolean
): 'ordinary' | 'continued' | 'ignore' {
  if (!hasActiveDebugSession) {
    return 'ordinary';
  }
  return shouldContinueToGuiBreakpoint(isContinuing, isCalvaDebugSession) ? 'continued' : 'ignore';
}

export function mergeSourceBreakpointStopTargets<
  T extends SourceBreakpointStopTarget & { breakpointId: string }
>(current: readonly T[] | undefined, replacements: readonly T[]): T[] {
  const next = [...(current ?? [])];
  for (const replacement of replacements) {
    disableObsoleteBreakpointTargets(next, replacement);
    const existing = next.find(
      (target) =>
        target.breakpointId === replacement.breakpointId && sameStopTarget(target, replacement)
    );
    if (existing) {
      existing.enabled = true;
    } else {
      next.push(replacement);
    }
  }
  return next;
}

function disableObsoleteBreakpointTargets<T extends { breakpointId: string }>(
  targets: (SourceBreakpointStopTarget & T)[],
  replacement: SourceBreakpointStopTarget & T
): void {
  for (const target of targets) {
    if (target.breakpointId === replacement.breakpointId) {
      target.enabled = sameStopTarget(target, replacement);
    }
  }
}

function sameStopTarget(a: SourceBreakpointStopTarget, b: SourceBreakpointStopTarget): boolean {
  return a.file === b.file && a.formStart === b.formStart && a.endOffset === b.endOffset;
}

export function wasSourceBreakpointStopInvalidated(
  previous: readonly SourceBreakpointStopTarget[] | undefined,
  current: readonly SourceBreakpointStopTarget[] | undefined,
  file: string,
  formStart: number | undefined,
  stopOffset: number
): boolean {
  return (
    hasEnabledSourceBreakpointStopTarget(previous, file, formStart, stopOffset) &&
    !hasEnabledSourceBreakpointStopTarget(current, file, formStart, stopOffset)
  );
}

function hasEnabledSourceBreakpointStopTarget(
  targets: readonly SourceBreakpointStopTarget[] | undefined,
  file: string,
  formStart: number | undefined,
  stopOffset: number
): boolean {
  return Boolean(
    targets?.some(
      (target) =>
        target.enabled !== false &&
        matchesSourceBreakpointStopLocation(target, file, formStart, stopOffset)
    )
  );
}

function matchesSourceBreakpointStopLocation(
  target: SourceBreakpointStopTarget,
  file: string,
  formStart: number | undefined,
  stopOffset: number
): boolean {
  return target.file === file && target.formStart === formStart && target.endOffset === stopOffset;
}

export function matchesSourceBreakpointLine(
  response: { file: string; line: number },
  breakpoint: { uri: string; line: number }
): boolean {
  return response.file === breakpoint.uri && response.line - 1 === breakpoint.line;
}

export function matchesSourceBreakpointForm(
  responseFormStart: number | undefined,
  breakpointFormStart: number | undefined,
  responseHasEnabledBreakpoint: boolean
): boolean {
  return (
    !responseHasEnabledBreakpoint &&
    responseFormStart !== undefined &&
    responseFormStart === breakpointFormStart
  );
}

export async function resumePastDisabledBreakpoint<T>(
  response: T,
  actions: {
    clearStop: () => void;
    notifyContinued: () => void | PromiseLike<unknown>;
    advance: (response: T) => void;
  }
): Promise<void> {
  actions.clearStop();
  await actions.notifyContinued();
  actions.advance(response);
}

export async function resumeIfDisabledBreakpointPause<T>(
  response: T,
  shouldResume: boolean,
  actions: {
    clearStop: () => void;
    notifyContinued: () => void | PromiseLike<unknown>;
    advance: (response: T) => void;
  }
): Promise<boolean> {
  if (!shouldResume) {
    return false;
  }
  await resumePastDisabledBreakpoint(response, actions);
  return true;
}

export function disabledSourceBreakpointStopTargets<
  T extends SourceBreakpointStopTarget & { breakpointId: string }
>(targets: readonly T[] | undefined): T[] {
  return (targets ?? []).filter((target) => target.enabled === false);
}

export function retireDisabledSourceBreakpointStopTargetsForForm<
  T extends SourceBreakpointStopTarget & { breakpointId: string }
>(targets: readonly T[] | undefined, file: string, formStart: number): T[] {
  return (targets ?? []).filter(
    (target) => target.enabled !== false || target.file !== file || target.formStart !== formStart
  );
}

export function consumeDisabledSourceBreakpointStopTarget<
  T extends SourceBreakpointStopTarget & { breakpointId: string }
>(
  targets: T[] | undefined,
  file: string,
  formStart: number | undefined,
  stopOffset: number
): boolean {
  // Keep disabled target metadata until replacement instrumentation is known to
  // be active. Multiple pauses from the old evaluation can already be queued;
  // consuming this marker after the first one would expose the next as ordinary.
  return disabledStopTargetIndex(targets, file, formStart, stopOffset) !== -1;
}

function disabledStopTargetIndex(
  targets: readonly (SourceBreakpointStopTarget & { breakpointId: string })[] | undefined,
  file: string,
  formStart: number | undefined,
  stopOffset: number
): number {
  if (hasEnabledStopTargetAt(targets, file, formStart, stopOffset)) {
    return -1;
  }
  return (
    targets?.findIndex((target) =>
      matchesDisabledStopTarget(target, file, formStart, stopOffset)
    ) ?? -1
  );
}

function hasEnabledStopTargetAt(
  targets: readonly SourceBreakpointStopTarget[] | undefined,
  file: string,
  formStart: number | undefined,
  stopOffset: number
): boolean {
  return Boolean(
    targets?.some(
      (target) =>
        target.enabled !== false &&
        target.file === file &&
        target.formStart === formStart &&
        target.endOffset === stopOffset
    )
  );
}

function matchesDisabledStopTarget(
  target: SourceBreakpointStopTarget & { breakpointId: string },
  file: string,
  formStart: number | undefined,
  stopOffset: number
): boolean {
  if (formStart === undefined || target.enabled !== false) {
    return false;
  }
  if (target.file !== file || target.formStart !== formStart) {
    return false;
  }
  return target.endOffset === stopOffset;
}

export function updateBreakpointStopTargets<T extends { id: string; enabled: boolean }>(
  targets: readonly (SourceBreakpointStopTarget & { breakpointId: string })[] | undefined,
  changed: readonly T[],
  removed: readonly T[]
): void {
  const changedById = new Map(changed.map((breakpoint) => [breakpoint.id, breakpoint]));
  const removedIds = new Set(removed.map((breakpoint) => breakpoint.id));
  for (const target of targets ?? []) {
    if (removedIds.has(target.breakpointId)) {
      target.enabled = false;
    } else {
      const breakpoint = changedById.get(target.breakpointId);
      if (breakpoint) {
        // A changed breakpoint may have moved or been disabled. Its old
        // instrumented target is stale until the replacement evaluation has
        // completed; mergeSourceBreakpointStopTargets re-enables only the
        // target represented by that new instrumentation.
        target.enabled = false;
      }
    }
  }
}

export function handleSourceBreakpointChange<T extends { id: string; enabled: boolean }>(
  targets: readonly (SourceBreakpointStopTarget & { breakpointId: string })[] | undefined,
  event: { changed: readonly T[]; removed: readonly T[] }
): void {
  updateBreakpointStopTargets(targets, event.changed, event.removed);
}

export function sourceBreakpointChangeHandler<
  TBreakpoint extends { id: string; enabled: boolean },
  TEvent extends { changed: readonly TBreakpoint[]; removed: readonly TBreakpoint[] }
>(
  getTargets: () => readonly (SourceBreakpointStopTarget & { breakpointId: string })[] | undefined,
  onChange: (event: TEvent) => void
): (event: TEvent) => void {
  return (event) => {
    handleSourceBreakpointChange(getTargets(), event);
    onChange(event);
  };
}

export function registerSourceBreakpointChangeListener<
  TEvent extends {
    changed: readonly { id: string; enabled: boolean }[];
    removed: readonly { id: string; enabled: boolean }[];
  },
  TDisposable
>(
  register: (handler: (event: TEvent) => void) => TDisposable,
  getTargets: () => readonly (SourceBreakpointStopTarget & { breakpointId: string })[] | undefined,
  onChange: (event: TEvent) => void
): TDisposable {
  return register(sourceBreakpointChangeHandler(getTargets, onChange));
}

export function routeSourceBreakpointStop<T>(
  exposeStop: boolean,
  expose: () => T,
  advance: () => T
): T {
  return exposeStop ? expose() : advance();
}

function isEnabledStopTarget(target: SourceBreakpointStopTarget, stopOffset: number): boolean {
  return target.enabled !== false && target.endOffset === stopOffset;
}

export function shouldExposeSourceBreakpointStop(
  targets: readonly SourceBreakpointStopTarget[] | undefined,
  file: string,
  formStart: number | undefined,
  stopOffset: number
): boolean {
  if (!targets?.length) {
    return true;
  }

  return isCurrentSourceBreakpointStop(targets, file, formStart, stopOffset);
}

export function shouldExposeContinuedSourceBreakpointStop(
  targets: readonly SourceBreakpointStopTarget[] | undefined,
  file: string,
  formStart: number | undefined,
  stopOffset: number
): boolean {
  if (!targets?.length) {
    return true;
  }
  return targets.some(
    (target) =>
      target.enabled !== false &&
      matchesSourceBreakpointStopLocation(target, file, formStart, stopOffset)
  );
}

function isCurrentSourceBreakpointStop(
  targets: readonly SourceBreakpointStopTarget[],
  file: string,
  formStart: number | undefined,
  stopOffset: number
): boolean {
  const formTargets = targets.filter((target) => matchesStopForm(target, file, formStart));
  return (
    formTargets.some((target) => isEnabledStopTarget(target, stopOffset)) || !formTargets.length
  );
}

function matchesStopForm(
  target: SourceBreakpointStopTarget,
  file: string,
  formStart: number | undefined
): boolean {
  return target.file === file && target.formStart === formStart;
}

export async function shouldExposeSourceBreakpointStopAfterMapping<TStop>(
  getTargets: () => readonly SourceBreakpointStopTarget[] | undefined,
  mapStop: () => Promise<{ file: string; formStart: number | undefined; stopOffset: number }>
): Promise<boolean> {
  const stop = await mapStop();
  return shouldExposeSourceBreakpointStop(getTargets(), stop.file, stop.formStart, stop.stopOffset);
}

type MappedSourceBreakpointStopActions<
  TStop extends { file: string; formStart: number | undefined; stopOffset: number },
  TTarget extends SourceBreakpointStopTarget & { breakpointId: string }
> = {
  getTargets: () => readonly TTarget[] | undefined;
  getGeneration: () => number;
  mapStop: () => Promise<TStop | undefined>;
  consumeDisabled?: (stop: TStop) => boolean;
  onlyEnabledTargets?: boolean;
};

export async function routeMappedSourceBreakpointStop<
  TStop extends { file: string; formStart: number | undefined; stopOffset: number },
  TTarget extends SourceBreakpointStopTarget & { breakpointId: string }
>(actions: MappedSourceBreakpointStopActions<TStop, TTarget>): Promise<boolean> {
  const generation = actions.getGeneration();
  const previousTargets = actions.getTargets()?.map((target) => ({ ...target }));
  const stop = await actions.mapStop();
  if (!stop) {
    return true;
  }
  return shouldExposeMappedSourceBreakpointStop(stop, previousTargets, generation, actions);
}

export async function routeGuiBreakpointStop<
  TStop extends { file: string; formStart: number | undefined; stopOffset: number },
  TTarget extends SourceBreakpointStopTarget & { breakpointId: string }
>(
  route: 'ordinary' | 'continued' | 'ignore',
  actions: MappedSourceBreakpointStopActions<TStop, TTarget>
): Promise<boolean> {
  if (route === 'ignore') {
    return false;
  }
  return routeMappedSourceBreakpointStop({
    ...actions,
    onlyEnabledTargets: route === 'continued',
  });
}

export function shouldExposeGuiBreakpointStopForSession<
  TStop extends { file: string; formStart: number | undefined; stopOffset: number },
  TTarget extends SourceBreakpointStopTarget & { breakpointId: string }
>(
  hasActiveDebugSession: boolean,
  isContinuing: boolean,
  isCalvaDebugSession: boolean,
  actions: MappedSourceBreakpointStopActions<TStop, TTarget>
): Promise<boolean> {
  return routeGuiBreakpointStop(
    guiBreakpointStopRoute(hasActiveDebugSession, isContinuing, isCalvaDebugSession),
    actions
  );
}

export async function routeGuiBreakpointStopForSession<
  TStop extends { file: string; formStart: number | undefined; stopOffset: number },
  TTarget extends SourceBreakpointStopTarget & { breakpointId: string },
  TResult
>(
  hasActiveDebugSession: boolean,
  isContinuing: boolean,
  isCalvaDebugSession: boolean,
  actions: MappedSourceBreakpointStopActions<TStop, TTarget>,
  expose: () => TResult,
  advance: () => TResult
): Promise<TResult> {
  const shouldExpose = await shouldExposeGuiBreakpointStopForSession(
    hasActiveDebugSession,
    isContinuing,
    isCalvaDebugSession,
    actions
  );
  return routeSourceBreakpointStop(shouldExpose, expose, advance);
}

function shouldExposeMappedSourceBreakpointStop<
  TStop extends { file: string; formStart: number | undefined; stopOffset: number },
  TTarget extends SourceBreakpointStopTarget & { breakpointId: string }
>(
  stop: TStop,
  previousTargets: readonly TTarget[] | undefined,
  generation: number,
  actions: {
    getTargets: () => readonly TTarget[] | undefined;
    getGeneration: () => number;
    consumeDisabled?: (stop: TStop) => boolean;
    onlyEnabledTargets?: boolean;
  }
): boolean {
  const currentTargets = actions.getTargets();
  if (
    generation !== actions.getGeneration() &&
    wasSourceBreakpointStopInvalidated(
      previousTargets,
      currentTargets,
      stop.file,
      stop.formStart,
      stop.stopOffset
    )
  ) {
    return false;
  }
  return shouldExposeCurrentMappedStop(
    stop,
    currentTargets,
    actions.consumeDisabled,
    actions.onlyEnabledTargets
  );
}

function shouldExposeCurrentMappedStop<
  TStop extends { file: string; formStart: number | undefined; stopOffset: number },
  TTarget extends SourceBreakpointStopTarget & { breakpointId: string }
>(
  stop: TStop,
  targets: readonly TTarget[] | undefined,
  consumeDisabled: ((stop: TStop) => boolean) | undefined,
  onlyEnabledTargets: boolean | undefined
): boolean {
  if (consumeDisabled?.(stop)) {
    return false;
  }
  return onlyEnabledTargets
    ? shouldExposeContinuedSourceBreakpointStop(targets, stop.file, stop.formStart, stop.stopOffset)
    : shouldExposeSourceBreakpointStop(targets, stop.file, stop.formStart, stop.stopOffset);
}
