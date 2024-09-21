function indentAllLines(indent: number, result: string) {
  const prepend = `${' '.repeat(indent)}`;
  return result
    .replace(/\n\r?$/, '')
    .split(/\n\r?/)
    .join(`\n${prepend}`);
}

function commentifyResult(firstPrefix: string, restPrefix: string, result: string) {
  const lines = result.split(/\n\r?/);
  const restPrefixed = lines.join(`\n${restPrefix}`);
  return `${firstPrefix}${restPrefixed}`;
}

export function resultAsComment(indent: number, result: string, commentStyle: string) {
  const commentified =
    commentStyle === 'ignore'
      ? commentifyResult('#_', '  ', result)
      : commentStyle === 'rcf'
      ? commentifyResult('(comment\n  ', '  ', result) + ')'
      : commentifyResult(';;=> ', ';;   ', result);
  const indented = indentAllLines(indent, commentified);
  const prepend = `${' '.repeat(indent)}`;
  return `\n${prepend}${indented}`;
}
