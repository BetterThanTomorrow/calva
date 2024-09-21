export function resultAsComment(indent: number, result: string) {
  const prepend = `${' '.repeat(indent)}`,
    output = result
      .replace(/\n\r?$/, '')
      .split(/\n\r?/)
      .join(`\n${prepend};;    `);
  return `\n${prepend};; => ${output}\n`;
}
