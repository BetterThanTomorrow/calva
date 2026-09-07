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
  editorNS: string,
  editorRepl: string
): CustomREPLCommandSnippet {
  return {
    ...snippet,
    ns: snippet.ns ? snippet.ns : editorNS,
    repl: snippet.repl ? snippet.repl : editorRepl,
  };
}

/**
 * Menu and key paths share one catalog entry. QuickPick carries that entry; do not treat the
 * slim pick facade (label/detail/description) as the snippet definition (#3283).
 */
export function buildSnippetCatalog(
  snippets: CustomREPLCommandSnippet[],
  editorNS: string,
  editorRepl: string
): {
  snippetsDict: Record<string, CustomREPLCommandSnippet>;
  snippetsMenuItems: SnippetQuickPickItem[];
  configErrors: { name: string; keys: string[] }[];
} {
  const configErrors: { name: string; keys: string[] }[] = [];
  const snippetsDict: Record<string, CustomREPLCommandSnippet> = {};
  const snippetsMenuItems: SnippetQuickPickItem[] = [];

  snippets.forEach((c: CustomREPLCommandSnippet) => {
    const undefs = ['name', 'snippet'].filter((k) => !c[k]);
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
