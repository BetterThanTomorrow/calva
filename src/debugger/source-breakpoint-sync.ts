export type BreakpointsChangeEvent<TBreakpoint> = {
  readonly added: readonly TBreakpoint[];
  readonly removed: readonly TBreakpoint[];
  readonly changed: readonly TBreakpoint[];
};

export type BreakpointLocation = { uri: string; line: number; character: number };

export function affectedBreakpointLocations<TBreakpoint>(
  event: BreakpointsChangeEvent<TBreakpoint>,
  previousLocations: WeakMap<object, BreakpointLocation>,
  locationFor: (breakpoint: TBreakpoint) => BreakpointLocation,
  isSyncable: (breakpoint: TBreakpoint) => boolean
): BreakpointLocation[] {
  const locations: BreakpointLocation[] = [];
  for (const breakpoint of [...event.added, ...event.changed, ...event.removed]) {
    if (!isSyncable(breakpoint)) {
      continue;
    }
    const key = breakpoint as object;
    const previous = previousLocations.get(key);
    if (previous) {
      locations.push(previous);
    }
    if (event.removed.includes(breakpoint)) {
      previousLocations.delete(key);
    } else {
      const current = locationFor(breakpoint);
      locations.push(current);
      previousLocations.set(key, current);
    }
  }
  return locations;
}

export function breakpointsToSync<TBreakpoint, TSyncableBreakpoint extends TBreakpoint>(
  event: BreakpointsChangeEvent<TBreakpoint>,
  isSyncableBreakpoint: (breakpoint: TBreakpoint) => breakpoint is TSyncableBreakpoint
): TSyncableBreakpoint[];
export function breakpointsToSync<TBreakpoint>(
  event: BreakpointsChangeEvent<TBreakpoint>,
  isSyncableBreakpoint: (breakpoint: TBreakpoint) => boolean
): TBreakpoint[];
export function breakpointsToSync<TBreakpoint>(
  event: BreakpointsChangeEvent<TBreakpoint>,
  isSyncableBreakpoint: (breakpoint: TBreakpoint) => boolean
): TBreakpoint[] {
  return [...event.added, ...event.changed, ...event.removed].filter(isSyncableBreakpoint);
}

export function uniqueByKey<T>(items: T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFor(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function reconcileBreakpointLocations<TLocation, TTarget, TBreakpoint>(
  locations: readonly TLocation[],
  resolveTarget: (location: TLocation) => Promise<TTarget | undefined>,
  keyFor: (target: TTarget) => string,
  currentBreakpoints: () => readonly TBreakpoint[],
  evaluateTarget: (target: TTarget, breakpoints: readonly TBreakpoint[]) => Promise<void>,
  onError: (error: unknown, phase: 'resolve' | 'evaluate') => void
): Promise<void> {
  const targets = await resolveBreakpointTargets(locations, resolveTarget, onError);
  // Every form in one reconciliation must use the same VS Code breakpoint set.
  const breakpoints = [...currentBreakpoints()];
  await evaluateBreakpointTargets(
    uniqueByKey(targets, keyFor),
    breakpoints,
    evaluateTarget,
    onError
  );
}

async function resolveBreakpointTargets<TLocation, TTarget>(
  locations: readonly TLocation[],
  resolveTarget: (location: TLocation) => Promise<TTarget | undefined>,
  onError: (error: unknown, phase: 'resolve' | 'evaluate') => void
): Promise<TTarget[]> {
  const targets: TTarget[] = [];
  for (const location of locations) {
    try {
      const target = await resolveTarget(location);
      if (target) {
        targets.push(target);
      }
    } catch (error) {
      onError(error, 'resolve');
    }
  }
  return targets;
}

async function evaluateBreakpointTargets<TTarget, TBreakpoint>(
  targets: readonly TTarget[],
  breakpoints: readonly TBreakpoint[],
  evaluateTarget: (target: TTarget, breakpoints: readonly TBreakpoint[]) => Promise<void>,
  onError: (error: unknown, phase: 'resolve' | 'evaluate') => void
): Promise<void> {
  for (const target of targets) {
    try {
      await evaluateTarget(target, breakpoints);
    } catch (error) {
      onError(error, 'evaluate');
    }
  }
}
