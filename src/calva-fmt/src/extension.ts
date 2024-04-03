import * as vscode from 'vscode';
import { FormatOnTypeEditProvider } from './providers/ontype_formatter';
import { RangeEditProvider } from './providers/range_formatter';
import * as formatter from './format';
import * as inferer from './infer';
import * as docmirror from '../../doc-mirror/index';
import * as config from '../../formatter-config';
import * as calvaConfig from '../../config';

function isOldIndentEngineInPlay(): boolean {
  return (
    !!config.formatOnTypeEnabled() &&
    !vscode.workspace.getConfiguration('calva.fmt').get('newIndentEngine')
  );
}

function getLanguageConfiguration(): vscode.LanguageConfiguration {
  const languageConfiguration = {
    onEnterRules: isOldIndentEngineInPlay()
      ? [
          // When cljfmt is used for indenting, disable all vscode default indentation
          // (By outdenting a lot, which is the only way I have found that works)
          {
            beforeText: /.*/,
            action: {
              indentAction: vscode.IndentAction.Outdent,
              removeText: Number.MAX_VALUE,
            },
          },
        ]
      : [],
  };
  console.log('Issue #2071: languageConfiguration', languageConfiguration);
  console.log('Issue #2071: formatOnType?', config.formatOnTypeEnabled());
  console.log(
    'Issue #2071: newIndentEngine?',
    vscode.workspace.getConfiguration('calva.fmt').get('newIndentEngine')
  );
  return languageConfiguration;
}

export function activate(context: vscode.ExtensionContext) {
  docmirror.activate();
  vscode.languages.setLanguageConfiguration('clojure', getLanguageConfiguration());
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'calva-fmt.formatCurrentForm',
      formatter.formatPositionCommand
    )
  );
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'calva-fmt.alignCurrentForm',
      formatter.alignPositionCommand
    )
  );
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'calva-fmt.trimCurrentFormWhiteSpace',
      formatter.trimWhiteSpacePositionCommand
    )
  );
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand('calva-fmt.inferParens', inferer.inferParensCommand)
  );
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand('calva-fmt.tabIndent', (e) => {
      inferer.indentCommand(e, ' ', true);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand('calva-fmt.tabDedent', (e) => {
      inferer.indentCommand(e, ' ', false);
    })
  );
  context.subscriptions.push(
    vscode.languages.registerOnTypeFormattingEditProvider(
      calvaConfig.documentSelector,
      new FormatOnTypeEditProvider(),
      '\r',
      '\n',
      ')',
      ']',
      '}'
    )
  );
  context.subscriptions.push(
    vscode.languages.registerDocumentRangeFormattingEditProvider(
      calvaConfig.documentSelector,
      new RangeEditProvider()
    )
  );
  vscode.window.onDidChangeActiveTextEditor(inferer.updateState);
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('editor.formatOnType')) {
      console.log('Issue #2071: editor.formatOnType changed, updating language configuration');
      vscode.languages.setLanguageConfiguration('clojure', getLanguageConfiguration());
    }
  });
}
