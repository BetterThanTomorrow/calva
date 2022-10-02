import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as util from './utilities';
import * as getText from './util/get-text';
import * as namespace from './namespace';
import * as outputWindow from './results-output/results-doc';
import { customREPLCommandSnippet } from './evaluate';
import { getConfig } from './config';
import * as replSession from './nrepl/repl-session';
import * as evaluate from './evaluate';
import * as state from './state';

type SnippetDefinition = {
  snippet: string;
  ns: string;
  repl: string;
  evaluationSendCodeToOutputWindow?: boolean;
};

export async function evaluateCustomCodeSnippetCommand(
  codeOrKeyOrSnippet?: string | SnippetDefinition
) {
  await evaluateCodeOrKeyOrSnippet(codeOrKeyOrSnippet);
}

async function evaluateCodeOrKeyOrSnippet(codeOrKeyOrSnippet?: string | SnippetDefinition) {
  const editor = util.getActiveTextEditor();
  const editorNS =
    editor && editor.document && editor.document.languageId === 'clojure'
      ? namespace.getNamespace(editor.document)
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
  await evaluateCodeInContext(snippetDefinition.snippet, context, options);
}

async function evaluateCodeInContext(code: string, context: any, options: any) {
  const result = await evaluateSnippet(code, context, options);
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
  snippets.forEach((c: customREPLCommandSnippet) => {
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
          values: snippetsMenuItems,
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
      outputWindow.append(
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

function makeContext(editor: vscode.TextEditor, ns: string, editorNS: string, repl: string) {
  return {
    currentLine: editor.selection.active.line,
    currentColumn: editor.selection.active.character,
    currentFilename: editor.document.fileName,
    ns,
    editorNS,
    repl,
    selection: editor.document.getText(editor.selection),
    currentForm: getText.currentFormText(editor?.document, editor?.selection.active)[1],
    enclosingForm: getText.currentEnclosingFormText(editor.document, editor?.selection.active)[1],
    topLevelForm: getText.currentTopLevelFormText(editor?.document, editor?.selection.active)[1],
    currentFn: getText.currentFunction(editor?.document)[1],
    topLevelFn: getText.currentTopLevelFunction(editor?.document)[1],
    topLevelDefinedForm: getText.currentTopLevelDefined(
      editor?.document,
      editor?.selection.active
    )[1],
    head: getText.toStartOfList(editor?.document)[1],
    tail: getText.toEndOfList(editor?.document)[1],
    ...getText.currentContext(editor.document, editor.selection.active),
  };
}

export async function evaluateSnippet(code, context, options) {
  const ns = context.ns;
  const repl = context.repl;
  const interpolatedCode = interpolateCode(code, context);
  return await evaluate.evaluateInOutputWindow(interpolatedCode, repl, ns, options);
}

function interpolateCode(code: string, context): string {
  return code
    .replace(/\$line/g, context.currentLine)
    .replace(/\$hover-line/g, context.hoverLine)
    .replace(/\$column/g, context.currentColumn)
    .replace(/\$hover-column/g, context.hoverColumn)
    .replace(/\$file/g, context.currentFilename)
    .replace(/\$hover-file/g, context.hoverFilename)
    .replace(/\$ns/g, context.ns)
    .replace(/\$editor-ns/g, context.editorNS)
    .replace(/\$repl/g, context.repl)
    .replace(/\$selection/g, context.selection)
    .replace(/\$hover-text/g, context.hoverText)
    .replace(/\$current-form/g, context.currentForm)
    .replace(/\$enclosing-form/g, context.enclosingForm)
    .replace(/\$top-level-form/g, context.topLevelForm)
    .replace(/\$current-fn/g, context.currentFn)
    .replace(/\$top-level-fn/g, context.topLevelFn)
    .replace(/\$top-level-defined-symbol/g, context.topLevelDefinedForm)
    .replace(/\$head/g, context.head)
    .replace(/\$tail/g, context.tail)
    .replace(/\$hover-current-form/g, context.hovercurrentForm)
    .replace(/\$hover-enclosing-form/g, context.hoverenclosingForm)
    .replace(/\$hover-top-level-form/g, context.hovertopLevelForm)
    .replace(/\$hover-current-fn/g, context.hovercurrentFn)
    .replace(/\$hover-top-level-defined-symbol/g, context.hovertopLevelDefinedForm)
    .replace(/\$hover-head/g, context.hoverhead)
    .replace(/\$hover-tail/g, context.hovertail);
}
