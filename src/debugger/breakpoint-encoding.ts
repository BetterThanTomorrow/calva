export function breakpointForm(condition?: string): string {
  return condition ? `#break ^{:break/when ${condition}} ` : '#break ';
}

export type BreakpointInsertion = { offset: number; condition?: string };
export type DebugScopeInsertion = { start: number; end: number };

export function insertDebugScopes(source: string, scopes: DebugScopeInsertion[]): string {
  return [...scopes]
    .sort((a, b) => b.start - a.start)
    .reduce((instrumented, scope) => {
      if (scope.start < 0 || scope.end > instrumented.length || scope.start >= scope.end) {
        return instrumented;
      }
      return instrumented.slice(0, scope.start) + '#dbg ' + instrumented.slice(scope.start);
    }, source);
}

export function offsetAfterDebugScopes(offset: number, scopes: DebugScopeInsertion[]): number {
  return (
    offset +
    scopes.reduce((shift, scope) => {
      if (scope.start <= offset) {
        return shift + '#dbg '.length;
      }
      return shift;
    }, 0)
  );
}

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
