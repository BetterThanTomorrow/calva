type BreakpointsChangeEvent<TBreakpoint> = {
  readonly added: readonly TBreakpoint[];
  readonly removed: readonly TBreakpoint[];
  readonly changed: readonly TBreakpoint[];
};

export function addedBreakpointsToSync<TBreakpoint, TSyncableBreakpoint extends TBreakpoint>(
  event: BreakpointsChangeEvent<TBreakpoint>,
  isSyncableBreakpoint: (breakpoint: TBreakpoint) => breakpoint is TSyncableBreakpoint
): TSyncableBreakpoint[];
export function addedBreakpointsToSync<TBreakpoint>(
  event: BreakpointsChangeEvent<TBreakpoint>,
  isSyncableBreakpoint: (breakpoint: TBreakpoint) => boolean
): TBreakpoint[];
export function addedBreakpointsToSync<TBreakpoint>(
  event: BreakpointsChangeEvent<TBreakpoint>,
  isSyncableBreakpoint: (breakpoint: TBreakpoint) => boolean
): TBreakpoint[] {
  return event.added.filter(isSyncableBreakpoint);
}
