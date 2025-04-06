export function interpolateCode(languageId: string, code: string, context): string {
  const interpolateCode = code
    .replace(/\$line/g, context.currentLine)
    .replace(/\$hover-line/g, context.hoverLine)
    .replace(/\$column/g, context.currentColumn)
    .replace(/\$hover-column/g, context.hoverColumn)
    .replace(/\$file-text/g, context.currentFileText[1])
    .replace(/\$file/g, context.currentFilename?.replace(/\\/g, '\\\\') ?? '')
    .replace(/\$hover-file-text/g, context.hovercurrentFileText?.[1] ?? '')
    .replace(/\$hover-file/g, context.hoverFilename?.replace(/\\/g, '\\\\') ?? '')
    .replace(/\$ns/g, context.ns)
    .replace(/\$editor-ns/g, context.editorNS)
    .replace(/\$repl/g, context.repl)
    .replace(/\$selection-closing-brackets/g, context.selectionWithBracketTrail?.[1])
    .replace(/\$selection/g, context.selection)
    .replace(/\$hover-text/g, context.hoverText);
  if (languageId !== 'clojure') {
    return interpolateCode;
  } else {
    return interpolateCode
      .replace(/\$current-form/g, context.currentForm[1])
      .replace(/\$current-pair/g, context.currentPair[1])
      .replace(/\$enclosing-form/g, context.enclosingForm[1])
      .replace(/\$top-level-form/g, context.topLevelForm[1])
      .replace(/\$current-fn/g, context.currentFn[1])
      .replace(/\$top-level-fn/g, context.topLevelFn[1])
      .replace(/\$top-level-defined-symbol/g, context.topLevelDefinedForm?.[1] ?? '')
      .replace(/\$head/g, context.head[1])
      .replace(/\$tail/g, context.tail[1])
      .replace(/\$hover-current-form/g, context.hovercurrentForm?.[1] ?? '')
      .replace(/\$hover-current-pair/g, context.hovercurrentPair?.[1] ?? '')
      .replace(/\$hover-enclosing-form/g, context.hoverenclosingForm?.[1] ?? '')
      .replace(/\$hover-top-level-form/g, context.hovertopLevelForm?.[1] ?? '')
      .replace(/\$hover-current-fn/g, context.hovercurrentFn?.[1] ?? '')
      .replace(/\$hover-current-fn/g, context.hovertopLevelFn?.[1] ?? '')
      .replace(/\$hover-top-level-defined-symbol/g, context.hovertopLevelDefinedForm?.[1] ?? '')
      .replace(/\$hover-head/g, context.hoverhead?.[1] ?? '')
      .replace(/\$hover-tail/g, context.hovertail?.[1] ?? '');
  }
}
