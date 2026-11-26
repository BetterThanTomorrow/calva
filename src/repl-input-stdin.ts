/** `calva.outputViews.replInput`: whether the REPL Input is on, by Output view id. */
export type ReplInputSetting = Record<string, boolean> | undefined;

/**
 * Returns the id of the Output view whose REPL Input reads stdin for an evaluation from a file: the
 * Output Sidebar while `setting` has its REPL Input on, else the Output View while that has it on, or
 * `undefined`, which reads stdin from the input box, as the REPL window's evaluations do.
 */
export function stdinViewId(
  setting: ReplInputSetting,
  fromReplWindow: boolean
): 'output-sidebar' | 'output-view' | undefined {
  if (fromReplWindow) {
    return undefined;
  }
  return (['output-sidebar', 'output-view'] as const).find((id) => setting?.[id]);
}
