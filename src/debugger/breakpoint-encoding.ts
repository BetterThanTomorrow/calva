export function breakpointForm(condition?: string): string {
  return condition ? `#break ^{:break/when ${condition}} ` : '#break ';
}

export type BreakpointInsertion = { offset: number; condition?: string };

export function insertBreakpointForms(source: string, breakpoints: BreakpointInsertion[]): string {
  return [...breakpoints]
    .sort((a, b) => b.offset - a.offset)
    .reduce((instrumented, breakpoint) => {
      if (breakpoint.offset < 0 || breakpoint.offset > instrumented.length) {
        return instrumented;
      }
      return (
        instrumented.slice(0, breakpoint.offset) +
        breakpointForm(breakpoint.condition) +
        instrumented.slice(breakpoint.offset)
      );
    }, source);
}

export function isBreakpointSupported(isClojureSource: boolean, hasDebuggerOps: boolean): boolean {
  return isClojureSource && hasDebuggerOps;
}
