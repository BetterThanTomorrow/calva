export type EvaluateAsCommentOptions = {
  commentStyle: string;
};

/**
 * Normalize the Calva Evaluate Selection as Comment arguments.
 *
 * The context menu handler passes the document/context object as the first
 * parameter, while palette/shortcut invocations pass the options bag first.
 * To handle both, we inspect the first argument for a `commentStyle` key.
 */
export function normalizeEvaluateAsCommentArgs(
  documentOrOptions,
  options: EvaluateAsCommentOptions = { commentStyle: 'line' }
): {
  options: EvaluateAsCommentOptions;
  document: unknown;
} {
  const opt1CommentStyle = documentOrOptions?.commentStyle;
  return opt1CommentStyle
    ? {
        document: options,
        options: documentOrOptions as EvaluateAsCommentOptions,
      }
    : {
        document: documentOrOptions,
        options: options.commentStyle ? options : { ...options, commentStyle: 'line' },
      };
}
