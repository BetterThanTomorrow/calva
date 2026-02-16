import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as util from './utilities';
import * as getText from './util/get-text';
import * as namespace from './namespace';
import { getConfig } from './config';
import * as replSession from './nrepl/repl-session';
import evaluate from './evaluate';
import * as state from './state';
import { getStateValue, interpolateVariables } from '../out/cljs-lib/cljs-lib';
import * as output from './results-output/output';

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
    void vscode.window.showErrorMessage('Failed to run snippet. ' + err.message);
    console.log('Failed to run snippet', err);
  });
}

async function evaluateCodeOrKeyOrSnippet(codeOrKeyOrSnippet?: string | SnippetDefinition) {
  if (!getStateValue('connected')) {
    void vscode.window.showErrorMessage('Not connected to a REPL');
    return;
  }
  const editor = util.getActiveTextEditor();
  const [editorNS, nsForm] =
    editor && editor.document && editor.document.languageId === 'clojure'
      ? namespace.getNamespace(editor.document, editor.selections[0].active)
      : undefined;
  const editorRepl =
    editor && editor.document && editor.document.languageId === 'clojure'
      ? replSession.getReplSessionTypeFromState()
      : 'clj';
  const snippetDefinition: SnippetDefinition =
    typeof codeOrKeyOrSnippet !== 'string' && codeOrKeyOrSnippet !== undefined
      ? codeOrKeyOrSnippet
      : await getSnippetDefinition(codeOrKeyOrSnippet as string, editorNS, editorRepl);

  snippetDefinition.repl = snippetDefinition.repl ?? editorRepl;
  snippetDefinition.ns =
    snippetDefinition.ns ?? (editorRepl === snippetDefinition.repl ? editorNS : undefined);
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

  const context = makeContext(
    editor,
    snippetDefinition.ns,
    editorNS,
    nsForm,
    snippetDefinition.repl
  );
  await evaluateCodeInContext(editor, snippetDefinition.snippet, context, options);
}

async function evaluateCodeInContext(
  editor: vscode.TextEditor,
  code: string,
  context: any,
  options: any
) {
  const result = await evaluateSnippet(editor, code, context, options);
  void output.replWindowAppendPrompt();
  return result;
}

async function getSnippetDefinition(codeOrKey: string, editorNS: string, editorRepl: string) {
  const configErrors: { name: string; keys: string[] }[] = [];
  const globalSnippets = getConfig().customREPLCommandSnippetsGlobal;
  const workspaceSnippets = getConfig().customREPLCommandSnippetsWorkspace;
  const workspaceFolderSnippets = getConfig().customREPLCommandSnippetsWorkspaceFolder;
  let snippets = [
    ...(workspaceFolderSnippets ? workspaceFolderSnippets : []),
    ...(workspaceSnippets ? workspaceSnippets : []),
    ...(globalSnippets ? globalSnippets : []),
  ];
  if (snippets.length < 1) {
    snippets = getConfig().customREPLCommandSnippets;
  }
  const snippetsDict = {};
  const snippetsMenuItems: vscode.QuickPickItem[] = [];
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
    const item = {
      label: `${entry.key ? entry.key + ': ' : ''}${entry.name}`,
      detail: `${entry.snippet}`,
      description: `${entry.repl}`,
      repl: `${entry.repl}`,
      snippet: entry.snippet,
    };
    snippetsMenuItems.push(item);
    if (!snippetsDict[entry.key]) {
      snippetsDict[entry.key] = entry;
    }
  });

  if (configErrors.length > 0) {
    void vscode.window.showErrorMessage(
      'Errors found in the `calva.customREPLCommandSnippets` setting. Values missing for: ' +
        JSON.stringify(configErrors),
      'OK'
    );
    return;
  }

  let pick: any;
  if (codeOrKey === undefined) {
    // Called without args, show snippets menu
    if (snippetsMenuItems.length > 0) {
      try {
        const pickResult = await util.quickPickSingle({
          values: snippetsMenuItems,
          placeHolder: 'Choose a command to run at the REPL',
          saveAs: 'runCustomREPLCommand',
        });
        if (pickResult === undefined || pickResult.label.length < 1) {
          return;
        }
        pick = pickResult;
      } catch (e) {
        console.error(e);
      }
    }
    if (pick === undefined) {
      output.appendLineOtherOut(
        'No snippets configured. Configure snippets in `calva.customREPLCommandSnippets`.'
      );
      return;
    }
  }

  if (pick === undefined) {
    // still no pick, but codeOrKey might be one
    pick = snippetsDict[codeOrKey];
  }

  return pick ?? { snippet: codeOrKey };
}

export function makeContext(
  editor: vscode.TextEditor,
  ns: string,
  editorNS: string,
  nsForm,
  repl: string
) {
  return {
    currentLine: editor.selections[0].active.line,
    currentColumn: editor.selections[0].active.character,
    currentFilename: editor.document.fileName,
    ns,
    editorNS,
    nsForm,
    repl,
    selection: editor.document.getText(editor.selections[0]),
    selectionWithBracketTrail: getText.selectionAddingBrackets(
      editor.document,
      editor.selections[0].active
    ),
    currentFileText: getText.currentFileText(editor.document),
    ...(editor.document.languageId === 'clojure'
      ? getText.currentClojureContext(editor.document, editor.selections[0].active)
      : {}),
  };
}

export async function evaluateSnippet(editor: vscode.TextEditor, code, context, options) {
  const ns = context.ns;
  const repl = context.repl;
  const interpolatedCode = interpolateVariables(editor.document.languageId, code, context);
  if (typeof interpolatedCode === 'string') {
    return await evaluate.evaluateInCurrentEditor(editor, interpolatedCode, repl, ns, options);
  } else {
    console.log(interpolatedCode.error);
  }
}
