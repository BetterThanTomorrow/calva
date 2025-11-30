/**
 * Session label formatting utilities.
 *
 * Provides consistent session labeling across statusbar and menus.
 * Pure functions that are easily unit testable.
 */

/**
 * Context prefix types for session labels.
 */
export type SessionLabelContext = 'repl-window' | 'cljc' | 'fiddle' | 'none';

/**
 * Options for determining the session label context.
 */
export interface SessionLabelContextOptions {
  isPinned: boolean;
  isReplWindow: boolean;
  fileType: string;
  fiddleFileExt: string;
}

/**
 * Determines the context prefix for a session label.
 * Pure function - all dependencies passed as parameters.
 *
 * Priority order:
 * 1. Pinned sessions never get context prefixes
 * 2. REPL window context takes precedence
 * 3. cljc file type
 * 4. fiddle file type
 * 5. No context prefix
 *
 * @param options - Context determination options
 * @returns The context type for the session label
 */
export function determineSessionLabelContext(
  options: SessionLabelContextOptions
): SessionLabelContext {
  const { isPinned, isReplWindow, fileType, fiddleFileExt } = options;

  // Pinned sessions don't get context prefixes
  if (isPinned) {
    return 'none';
  }

  // REPL window takes precedence
  if (isReplWindow) {
    return 'repl-window';
  }

  // Check for cljc files
  if (fileType === 'cljc') {
    return 'cljc';
  }

  // Check for fiddle files
  if (fileType === fiddleFileExt) {
    return 'fiddle';
  }

  return 'none';
}

/**
 * Formats a session key with the appropriate context prefix.
 * Provides consistent session labeling across statusbar and menus.
 *
 * @param sessionKey - The session key to format (e.g., 'clj', 'cljs', 'frontend')
 * @param context - The context type
 * @returns Formatted label (e.g., 'repl-w/cljs', 'cljc/clj', 'cljs')
 */
export function formatSessionLabel(sessionKey: string, context: SessionLabelContext): string {
  switch (context) {
    case 'repl-window':
      return `repl-w/${sessionKey}`;
    case 'cljc':
      return `cljc/${sessionKey}`;
    case 'fiddle':
      return `fiddle/${sessionKey}`;
    case 'none':
      return sessionKey;
  }
}
