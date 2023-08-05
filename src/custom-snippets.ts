import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as util from './utilities';
import * as getText from './util/get-text';
import * as namespace from './namespace';
import * as outputWindow from './results-output/results-doc';
import { getConfig } from './config';
import * as replSession from './nrepl/repl-session';
import evaluate from './evaluate';
import * as state from './state';
import { get_state_value } from '../out/cljs-lib/calva.state';

export type CustomREPLCommandSnippet = {
  name: string;
  key?: string;
  snippet: string;
  repl?: string;
  ns?: string;
};

type SnippetDefinition = {
  snippet: string;
  ns: string;
  repl: string;
  evaluationSendCodeToOutputWindow?: boolean;
};

export function evaluateCustomCodeSnippetCommand(codeOrKeyOrSnippet?: string | SnippetDefinition) {
  evaluateCodeOrKeyOrSnippet(codeOrKeyOrSnippet).catch((err) => {
    console.log('Failed to run snippet', err);
  });
}

async function evaluateCodeOrKeyOrSnippet(codeOrKeyOrSnippet?: string | SnippetDefinition) {
  if (!get_state_value('connected')) {
    void vscode.window.showErrorMessage('Not connected to a REPL');
    return;
  }
  const editor = util.getActiveTextEditor();
  const editorNS =
    editor && editor.document && editor.document.languageId === 'clojure'
      ? namespace.getNamespace(editor.document, editor.selection.active)
      : undefined;
  const editorRepl =
    editor && editor.document && editor.document.languageId === 'clojure'
      ? replSession.getReplSessionTypeFromState()
      : 'clj';
  const snippetDefinition: SnippetDefinition =
    typeof codeOrKeyOrSnippet !== 'string' && codeOrKeyOrSnippet !== undefined
      ? codeOrKeyOrSnippet
      : await getSnippetDefinition(codeOrKeyOrSnippet as string, editorNS, editorRepl);

  snippetDefinition.ns = snippetDefinition.ns ?? editorNS;
  snippetDefinition.repl = snippetDefinition.repl ?? editorRepl;
  snippetDefinition.evaluationSendCodeToOutputWindow =
    snippetDefinition.evaluationSendCodeToOutputWindow ?? true;

  const options = {};

  options['evaluationSendCodeToOutputWindow'] = snippetDefinition.evaluationSendCodeToOutputWindow;
  // don't allow addToHistory if we don't show the code but are inside the repl
  options['addToHistory'] =
    state.extensionContext.workspaceState.get('outputWindowActive') &&
    !snippetDefinition.evaluationSendCodeToOutputWindow
      ? false
      : undefined;

  const context = makeContext(editor, snippetDefinition.ns, editorNS, snippetDefinition.repl);
  await evaluateCodeInContext(editor, snippetDefinition.snippet, context, options);
}

async function evaluateCodeInContext(
  editor: vscode.TextEditor,
  code: string,
  context: any,
  options: any
) {
  const result = await evaluateSnippet(editor, code, context, options);
  outputWindow.appendPrompt();
  return result;
}

async function getSnippetDefinition(codeOrKey: string, editorNS: string, editorRepl: string) {
  const configErrors: { name: string; keys: string[] }[] = [];
  const globalSnippets = getConfig().customREPLCommandSnippetsGlobal;
  const workspaceSnippets = getConfig().customREPLCommandSnippetsWorkspace;
  const workspaceFolderSnippets = getConfig().customREPLCommandSnippetsWorkspaceFolder;
  let snippets = [
    ...(globalSnippets ? globalSnippets : []),
    ...(workspaceSnippets ? workspaceSnippets : []),
    ...(workspaceFolderSnippets ? workspaceFolderSnippets : []),
  ];
  if (snippets.length < 1) {
    snippets = getConfig().customREPLCommandSnippets;
  }
  const snippetsDict = {};
  const snippetsKeyDict = {};
  const snippetsMenuItems: string[] = [];
  snippets.forEach((c: CustomREPLCommandSnippet) => {
    const undefs = ['name', 'snippet'].filter((k) => {
      return !c[k];
    });
    if (undefs.length > 0) {
      configErrors.push({ name: c.name, keys: undefs });
    }
    const entry = { ...c };
    entry.ns = entry.ns ? entry.ns : editorNS;
    entry.repl = entry.repl ? entry.repl : editorRepl;
    const prefix = entry.key !== undefined ? `${entry.key}: ` : '';
    const item = `${prefix}${entry.name} (${entry.repl})`;
    snippetsMenuItems.push(item);
    snippetsDict[item] = entry;
    snippetsKeyDict[entry.key] = item;
  });

  if (configErrors.length > 0) {
    void vscode.window.showErrorMessage(
      'Errors found in the `calva.customREPLCommandSnippets` setting. Values missing for: ' +
        JSON.stringify(configErrors),
      'OK'
    );
    return;
  }

  let pick: string;
  if (codeOrKey === undefined) {
    // Called without args, show snippets menu
    if (snippetsMenuItems.length > 0) {
      try {
        pick = await util.quickPickSingle({
          values: snippetsMenuItems.map((a) => ({ label: a })),
          placeHolder: 'Choose a command to run at the REPL',
          saveAs: 'runCustomREPLCommand',
        });
        if (pick === undefined || pick.length < 1) {
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    if (pick === undefined) {
      outputWindow.appendLine(
        '; No snippets configured. Configure snippets in `calva.customREPLCommandSnippets`.'
      );
      return;
    }
  }

  if (pick === undefined) {
    // still no pick, but codeOrKey might be one
    pick = snippetsKeyDict[codeOrKey];
  }

  return pick !== undefined ? snippetsDict[pick] : { snippet: codeOrKey };
}

export function makeContext(editor: vscode.TextEditor, ns: string, editorNS: string, repl: string) {
  return {
    currentLine: editor.selection.active.line,
    currentColumn: editor.selection.active.character,
    currentFilename: editor.document.fileName,
    ns,
    editorNS,
    repl,
    selection: editor.document.getText(editor.selection),
    selectionWithBracketTrail: getText.selectionAddingBrackets(
      editor.document,
      editor.selection.active
    ),
    currentFileText: getText.currentFileText(editor.document),
    ...(editor.document.languageId === 'clojure'
      ? getText.currentClojureContext(editor.document, editor.selection.active)
      : {}),
  };
}

export async function evaluateSnippet(editor: vscode.TextEditor, code, context, options) {
  const ns = context.ns;
  const repl = context.repl;
  const interpolatedCode = interpolateCode(editor, code, context);
  return await evaluate.evaluateInOutputWindow(interpolatedCode, repl, ns, options);
}

function interpolateCode(editor: vscode.TextEditor, code: string, context): string {
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
  if (editor.document.languageId !== 'clojure') {
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
