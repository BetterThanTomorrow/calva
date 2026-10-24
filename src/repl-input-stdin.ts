/** `calva.outputViews.replInput`: whether the REPL Input is on, by Output view id. */
export type ReplInputSetting = Record<string, boolean> | undefined;

/**
 * Returns the stdin function for an evaluation from a file: `readInSidebar` while `setting` has the
 * REPL Input on for a view, or `undefined`, which reads stdin from the input box, as the REPL window's
 * evaluations do.
 */
export function editorStdin(
  setting: ReplInputSetting,
  fromReplWindow: boolean,
  readInSidebar: () => Promise<string>
): (() => Promise<string>) | undefined {
  const replInputOn = Object.values(setting ?? {}).some(Boolean);
  return replInputOn && !fromReplWindow ? readInSidebar : undefined;
}
