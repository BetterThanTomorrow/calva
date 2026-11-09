export type SourceBreakpointStopTarget = {
  file: string;
  formStart: number;
  endOffset: number;
};

export function routeSourceBreakpointStop<T>(
  exposeStop: boolean,
  expose: () => T,
  advance: () => T
): T {
  return exposeStop ? expose() : advance();
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

  const formTargets = targets.filter(
    (target) => target.file === file && target.formStart === formStart
  );
  if (!formTargets.length) {
    return true;
  }

  return formTargets.some((target) => target.endOffset === stopOffset);
}
