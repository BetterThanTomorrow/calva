import * as cljsLib from '../out/cljs-lib/cljs-lib';
import type * as model from './cursor-doc/model';
import type { PareditConfig } from './cursor-doc/paredit-config';
import * as cursorGetText from './util/cursor-get-text';

export type CustomREPLCommandSnippet = {
  name: string;
  key?: string;
  snippet: string;
  repl?: string;
  ns?: string;
};

/** QuickPick fields plus the shared catalog entry (not the slim facade alone). */
export type SnippetQuickPickItem = {
  label: string;
  detail: string;
  description: string;
  snippetDefinition: CustomREPLCommandSnippet;
  disabled?: boolean;
};

/** Fill editor defaults for missing ns/repl without dropping configured fields. */
export function withEditorDefaults(
  snippet: CustomREPLCommandSnippet,
  editorNS?: string,
  editorRepl?: string
): CustomREPLCommandSnippet {
  return {
    ...snippet,
    ns: snippet.ns ?? editorNS,
    repl: snippet.repl ?? editorRepl,
  };
}

/**
 * Menu and key paths share one catalog entry. QuickPick carries that entry; do not treat the
 * slim pick facade (label/detail/description) as the snippet definition (#3283).
 */
export function buildSnippetCatalog(
  snippets: CustomREPLCommandSnippet[],
  editorNS?: string,
  editorRepl?: string
): {
  snippetsDict: Record<string, CustomREPLCommandSnippet>;
  snippetsMenuItems: SnippetQuickPickItem[];
  configErrors: { name: string; keys: string[] }[];
} {
  const configErrors: { name: string; keys: string[] }[] = [];
  const snippetsDict: Record<string, CustomREPLCommandSnippet> = {};
  const snippetsMenuItems: SnippetQuickPickItem[] = [];

  const requiredKeys: (keyof CustomREPLCommandSnippet)[] = ['name', 'snippet'];
  snippets.forEach((c: CustomREPLCommandSnippet) => {
    const undefs = requiredKeys.filter((k) => !c[k]);
    if (undefs.length > 0) {
      configErrors.push({ name: c.name, keys: undefs });
    }
    const entry = withEditorDefaults(c, editorNS, editorRepl);
    snippetsMenuItems.push({
      label: `${entry.key ? entry.key + ': ' : ''}${entry.name}`,
      detail: `${entry.snippet}`,
      description: `${entry.repl}`,
      snippetDefinition: entry,
    });
    if (entry.key && !snippetsDict[entry.key]) {
      snippetsDict[entry.key] = entry;
    }
  });

  return { snippetsDict, snippetsMenuItems, configErrors };
}

/** Resolve to the catalog entry (menu or key). Raw code falls through as `{ snippet }`. */
export function resolveCustomSnippetDefinition(options: {
  codeOrKey?: string;
  snippetsDict: Record<string, CustomREPLCommandSnippet>;
  menuSnippetDefinition?: CustomREPLCommandSnippet;
}): CustomREPLCommandSnippet | { snippet: string } | undefined {
  const { codeOrKey, snippetsDict, menuSnippetDefinition } = options;
  if (menuSnippetDefinition) {
    return menuSnippetDefinition;
  }
  if (codeOrKey !== undefined) {
    return snippetsDict[codeOrKey] ?? { snippet: codeOrKey };
  }
  return undefined;
}

export type SnippetDefinition = {
  snippet: string;
  ns?: string;
  repl?: string;
  evaluationSendCodeToOutputWindow?: boolean;
};

/** The namespace, `ns` form and session key a REPL Input evaluates in. */
export type ReplInputContext = { ns: string; nsForm: string; sessionKey: string };

/**
 * The evaluation of `definition` from the REPL Input `doc`, evaluating in `context`: its forms,
 * selection and cursor substituted from `doc`, the REPL Input's text as the file text, and no file.
 */
export function replInputSnippetEvaluation(
  { snippet, ns, repl, evaluationSendCodeToOutputWindow }: SnippetDefinition,
  doc: model.StringDocument,
  context: ReplInputContext,
  pareditConfig?: PareditConfig
) {
  const sessionKey = repl ?? context.sessionKey;
  const snippetNs = ns ?? (sessionKey === context.sessionKey ? context.ns : undefined);
  const nsForm = snippetNs === context.ns ? context.nsForm : snippetNs && `(in-ns '${snippetNs})`;
  const [currentLine, currentColumn] = doc.model.getRowCol(doc.selections[0].active);
  const code = cljsLib.interpolateVariables('clojure', snippet, {
    currentLine,
    currentColumn,
    ns: snippetNs,
    editorNS: context.ns,
    nsForm,
    repl: sessionKey,
    selection: cursorGetText.selectionText(doc)[1],
    selectionWithBracketTrail: cursorGetText.selectionAddingBrackets(doc),
    currentFileText: [undefined, doc.model.getText(0, doc.model.maxOffset)],
    ...cursorGetText.currentClojureContext(doc, pareditConfig),
  });
  return {
    code,
    ns: snippetNs,
    nsForm,
    sessionKey,
    sendCode: evaluationSendCodeToOutputWindow ?? true,
  };
}
