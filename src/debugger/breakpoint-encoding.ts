export function breakpointForm(condition?: string): string {
  return condition ? `#break ^{:break/when ${condition}} ` : '#break ';
}

export type BreakpointInsertion = { offset: number; condition?: string };

/** Whether `#break` at `offset` needs a space before it, so it doesn't join the token before it. */
function needsLeadingSpace(source: string, offset: number): boolean {
  return offset > 0 && !/[\s,([{]/.test(source[offset - 1]);
}

export function insertBreakpointForms(source: string, breakpoints: BreakpointInsertion[]): string {
  return [...breakpoints]
    .sort((a, b) => b.offset - a.offset)
    .reduce((instrumented, breakpoint) => {
      if (breakpoint.offset < 0 || breakpoint.offset > instrumented.length) {
        return instrumented;
      }
      const space = needsLeadingSpace(instrumented, breakpoint.offset) ? ' ' : '';
      return (
        instrumented.slice(0, breakpoint.offset) +
        space +
        breakpointForm(breakpoint.condition) +
        instrumented.slice(breakpoint.offset)
      );
    }, source);
}
