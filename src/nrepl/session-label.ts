/**
 * Session label formatting utilities.
 *
 * Provides consistent session labeling across statusbar and menus.
 * Pure functions that are easily unit testable.
 */

/**
 * Context prefix types for session labels.
 * - 'repl-window': For output window
 * - 'cljc-routing': For files routed via cljc-within-connection, includes file extension
 * - 'none': No prefix
 */
export type SessionLabelContext =
  | { type: 'repl-window' }
  | { type: 'cljc-routing'; fileExtension: string }
  | { type: 'none' };

/**
 * Options for determining the session label context.
 */
export interface SessionLabelContextOptions {
  isPinned: boolean;
  isReplWindow: boolean;
  isCljcRouting: boolean;
  fileExtension?: string;
}

/**
 * Determines the context prefix for a session label.
 * Pure function - all dependencies passed as parameters.
 *
 * Priority order:
 * 1. Pinned sessions never get context prefixes
 * 2. REPL window context takes precedence
 * 3. cljc-within-connection routing (all files routed via cljc preference)
 * 4. No context prefix
 *
 * @param options - Context determination options
 * @returns The context type for the session label
 */
export function determineSessionLabelContext(
  options: SessionLabelContextOptions
): SessionLabelContext {
  const { isPinned, isReplWindow, isCljcRouting, fileExtension } = options;

  // Pinned sessions don't get context prefixes
  if (isPinned) {
    return { type: 'none' };
  }

  // REPL window takes precedence
  if (isReplWindow) {
    return { type: 'repl-window' };
  }

  // Files routed via cljc-within-connection get file extension prefix
  if (isCljcRouting && fileExtension) {
    return { type: 'cljc-routing', fileExtension };
  }

  return { type: 'none' };
}

/**
 * Formats a session key with the appropriate context prefix.
 * Provides consistent session labeling across statusbar and menus.
 *
 * @param sessionKey - The session key to format (e.g., 'clj', 'cljs', 'frontend')
 * @param context - The context type
 * @returns Formatted label (e.g., 'repl-w/cljs', '.cljc → clj', 'cljs')
 */
export function formatSessionLabel(sessionKey: string, context: SessionLabelContext): string {
  switch (context.type) {
    case 'repl-window':
      return `repl-w/${sessionKey}`;
    case 'cljc-routing':
      return `.${context.fileExtension} → ${sessionKey}`;
    case 'none':
      return sessionKey;
  }
}
