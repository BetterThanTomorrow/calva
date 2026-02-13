export interface IndentFix {
  line: number;
  delta: number;
}

/**
 * Calculates indent fixes for a set of lines in a document.
 * Returns an array of {line, delta} where delta > 0 means remove spaces,
 * delta < 0 means add spaces.
 */
export function calculateIndentFixes(
  lines: { lineNum: number; currentIndent: number; isEmpty: boolean }[],
  getTargetIndent: (lineNum: number) => number
): IndentFix[] {
  const fixes: IndentFix[] = [];
  for (const { lineNum, currentIndent, isEmpty } of lines) {
    if (isEmpty) {
      continue;
    }
    const targetIndent = getTargetIndent(lineNum);
    const delta = currentIndent - targetIndent;
    if (delta !== 0) {
      fixes.push({ line: lineNum, delta });
    }
  }
  return fixes;
}
