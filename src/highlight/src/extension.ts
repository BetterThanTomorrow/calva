import * as vscode from 'vscode';
import * as isEqual from 'lodash.isequal';
import * as nodeUtil from 'util';
import * as docMirror from '../../doc-mirror/index';
import * as utilities from '../../utilities';
import * as config from '../../config';
import * as rainbowBrackets from './rainbow-brackets';

function is_clojure(editor) {
  return !!editor && editor.document.languageId === 'clojure';
}

// Exported for integration testing purposes
export let activeEditor: vscode.TextEditor;

let lastHighlightedEditor,
  rainbowColors,
  rainbowTypes: vscode.TextEditorDecorationType[],
  rainbowGuidesTypes: vscode.TextEditorDecorationType[],
  activeGuidesTypes: vscode.TextEditorDecorationType[],
  cycleBracketColors,
  misplacedBracketStyle,
  misplacedType: vscode.TextEditorDecorationType,
  matchedBracketStyle,
  matchedType: vscode.TextEditorDecorationType,
  commentFormStyle,
  commentFormType: vscode.TextEditorDecorationType,
  ignoredFormStyle,
  ignoredFormType: vscode.TextEditorDecorationType,
  ignoredTopLevelFormStyle,
  ignoredTopLevelFormType: vscode.TextEditorDecorationType,
  enableBracketColors,
  useRainbowIndentGuides,
  highlightActiveIndent,
  rainbow: rainbowBrackets.RainbowBrackets,
  rainbowTimer = undefined,
  matchTimer = undefined,
  dirty = false;

reloadConfig();

function decorationType(opts) {
  opts.rangeBehavior = vscode.DecorationRangeBehavior.ClosedClosed;
  return vscode.window.createTextEditorDecorationType(opts);
}

function colorDecorationType(color) {
  if (nodeUtil.isArray(color)) {
    return decorationType({
      light: { color: color[0] },
      dark: { color: color[1] },
    });
  } else {
    return decorationType({ color: color });
  }
}

function guidesDecorationType_(color, isActive: boolean): vscode.TextEditorDecorationType {
  if (nodeUtil.isArray(color)) {
    return decorationType({
      light: {
        borderWidth: `0; border-right-width: ${
          isActive ? '1.5px' : '0.5px'
        }; top: -1px; bottom: -1px;`,
        borderStyle: `solid; opacity: ${isActive ? '0.5' : '0.25'};`,
        backgroundColor: color[0],
      },
      dark: {
        borderWidth: `0; border-right-width: ${
          isActive ? '1.5px' : '0.5px'
        }; top: -1px; bottom: -1px;`,
        borderStyle: `solid; opacity: ${isActive ? '0.5' : '0.25'};`,
        borderColor: color[1],
      },
    });
  } else {
    return decorationType({
      borderWidth: `0; border-right-width: ${
        isActive ? '1.5px' : '0.5px'
      }; top: -1px; bottom: -1px;`,
      borderStyle: `solid; opacity: ${isActive ? '0.5' : '0.25'};`,
      borderColor: color,
    });
  }
}

function guidesDecorationType(color): vscode.TextEditorDecorationType {
  return guidesDecorationType_(color, false);
}

function activeGuidesDecorationType(color): vscode.TextEditorDecorationType {
  return guidesDecorationType_(color, true);
}

function reset_styles() {
  if (rainbowTypes) {
    rainbowTypes.forEach((type) => activeEditor.setDecorations(type, []));
  }
  rainbowTypes = rainbowColors.map(colorDecorationType);

  if (rainbowGuidesTypes) {
    rainbowGuidesTypes.forEach((type) => activeEditor.setDecorations(type, []));
  }
  rainbowGuidesTypes = rainbowColors.map(guidesDecorationType);

  if (activeGuidesTypes) {
    activeGuidesTypes.forEach((type) => activeEditor.setDecorations(type, []));
  }
  activeGuidesTypes = rainbowColors.map(activeGuidesDecorationType);

  if (misplacedType) {
    activeEditor.setDecorations(misplacedType, []);
  }
  misplacedType = decorationType(
    misplacedBracketStyle || {
      light: { color: '#fff', backgroundColor: '#c33' },
      dark: { color: '#ccc', backgroundColor: '#933' },
      overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.errorForeground'),
      overviewRulerLane: 4,
    }
  );

  if (matchedType) {
    activeEditor.setDecorations(matchedType, []);
  }
  matchedType = decorationType(
    matchedBracketStyle || {
      light: { backgroundColor: '#d0d0d0' },
      dark: { backgroundColor: '#444' },
    }
  );

  if (commentFormType) {
    activeEditor.setDecorations(commentFormType, []);
  }
  commentFormType = decorationType(commentFormStyle || { fontStyle: 'italic' });

  if (ignoredFormType) {
    activeEditor.setDecorations(ignoredFormType, []);
  }
  ignoredFormType = decorationType(ignoredFormStyle || { textDecoration: 'none; opacity: 0.5' });

  if (ignoredTopLevelFormType) {
    activeEditor.setDecorations(ignoredTopLevelFormType, []);
  }
  ignoredTopLevelFormType = decorationType(
    ignoredTopLevelFormStyle || ignoredFormStyle || { textDecoration: 'none; opacity: 0.5' }
  );

  dirty = false;
}

function reloadConfig() {
  const configuration = vscode.workspace.getConfiguration(
    'calva.highlight',
    activeEditor ? activeEditor.document.uri : null
  );

  if (!isEqual(rainbowColors, configuration.get<string[]>('bracketColors'))) {
    rainbowColors = configuration.get<string[]>('bracketColors');
    dirty = true;
  }

  if (cycleBracketColors !== configuration.get<boolean>('cycleBracketColors')) {
    cycleBracketColors = configuration.get<boolean>('cycleBracketColors');
    dirty = true;
  }

  if (!isEqual(misplacedBracketStyle, configuration.get('misplacedBracketStyle'))) {
    misplacedBracketStyle = configuration.get('misplacedBracketStyle');
    dirty = true;
  }

  if (!isEqual(matchedBracketStyle, configuration.get('matchedBracketStyle'))) {
    matchedBracketStyle = configuration.get('matchedBracketStyle');
    dirty = true;
  }

  if (enableBracketColors !== configuration.get<boolean>('enableBracketColors')) {
    enableBracketColors = configuration.get<boolean>('enableBracketColors');
    dirty = true;
  }

  if (highlightActiveIndent !== configuration.get<boolean>('highlightActiveIndent')) {
    highlightActiveIndent = configuration.get<boolean>('highlightActiveIndent');
    dirty = true;
  }

  if (useRainbowIndentGuides !== configuration.get<boolean>('rainbowIndentGuides')) {
    useRainbowIndentGuides = configuration.get<boolean>('rainbowIndentGuides');
    dirty = true;
  }

  if (!isEqual(commentFormStyle, configuration.get('commentFormStyle'))) {
    commentFormStyle = configuration.get('commentFormStyle');
    dirty = true;
  }

  if (!isEqual(ignoredFormStyle, configuration.get('ignoredFormStyle'))) {
    ignoredFormStyle = configuration.get('ignoredFormStyle');
    dirty = true;
  }

  if (!isEqual(ignoredTopLevelFormStyle, configuration.get('ignoredTopLevelFormStyle'))) {
    ignoredTopLevelFormStyle = configuration.get('ignoredTopLevelFormStyle');
    dirty = true;
  }

  if (dirty) {
    scheduleRainbowBrackets();
  }
}

function scheduleRainbowBrackets() {
  if (rainbowTimer) {
    clearTimeout(rainbowTimer);
  }
  if (is_clojure(activeEditor)) {
    rainbowTimer = setTimeout(updateRainbowBrackets, 16);
  }
}

function updateRainbowBrackets() {
  if (!is_clojure(activeEditor)) {
    return;
  }

  lastHighlightedEditor = activeEditor;

  if (dirty) {
    reset_styles();
  }

  const doc = activeEditor.document;
  const mirrorDoc = docMirror.tryToGetDocument(doc);
  if (!mirrorDoc) {
    return;
  }
  const len = rainbowTypes.length;
  const colorsEnabled = enableBracketColors && len > 0;
  const guideColorsEnabled = useRainbowIndentGuides && len > 0;
  const activeGuideEnabled = highlightActiveIndent && len > 0;
  const { customCommentForms, aliasMap } = config.getConfig();
  rainbow = rainbowBrackets.rainbowBrackets(
    mirrorDoc.model.lineInputModel,
    activeEditor.visibleRanges.map((range): [number, number] => [
      doc.offsetAt(range.start),
      doc.offsetAt(range.end),
    ]),
    {
      colorCount: len,
      cycleBracketColors,
      guides: guideColorsEnabled || activeGuideEnabled,
      commentFormConfig: { customCommentForms, aliasMap },
    }
  );
  const brackets = colorsEnabled ? decorationsByColor(doc, rainbow.brackets) : [];
  const guides = guideColorsEnabled ? decorationsByColor(doc, rainbow.guides) : [];
  for (let i = 0; i < rainbowTypes.length; ++i) {
    activeEditor.setDecorations(rainbowTypes[i], brackets[i] ?? []);
    if (guideColorsEnabled) {
      activeEditor.setDecorations(rainbowGuidesTypes[i], guides[i]);
    }
  }
  activeEditor.setDecorations(
    misplacedType,
    rainbow.misplaced.map((range) => ({ range: toRange(doc, range) }))
  );
  activeEditor.setDecorations(
    commentFormType,
    rainbow.commentForms.map((range) => toRange(doc, range))
  );
  activeEditor.setDecorations(
    ignoredFormType,
    rainbow.ignoredForms.map((range) => toRange(doc, range))
  );
  activeEditor.setDecorations(
    ignoredTopLevelFormType,
    rainbow.topLevelIgnoredForms.map((range) => toRange(doc, range))
  );
  matchPairs();
  if (activeGuideEnabled) {
    decorateActiveGuides();
  }
}

function toRange(doc: vscode.TextDocument, [start, end]: [number, number]) {
  return new vscode.Range(doc.positionAt(start), doc.positionAt(end));
}

function decorationsByColor(
  doc: vscode.TextDocument,
  coloredRanges: rainbowBrackets.ColoredRange[]
): { range: vscode.Range }[][] {
  const decorations = rainbowTypes.map(() => []);
  coloredRanges.forEach(({ range, colorIndex }) =>
    decorations[colorIndex].push({ range: toRange(doc, range) })
  );
  return decorations;
}

function matchPairs() {
  if (!is_clojure(activeEditor) || !rainbow) {
    return;
  }
  const doc = activeEditor.document;
  const matches = rainbowBrackets.matchedBrackets(
    rainbow,
    activeEditor.selections.map((selection): [number, number] => [
      doc.offsetAt(selection.anchor),
      doc.offsetAt(selection.active),
    ])
  );
  activeEditor.setDecorations(
    matchedType,
    matches.map((range) => ({ range: toRange(doc, range) }))
  );
}

function decorateActiveGuides() {
  activeEditor = utilities.tryToGetActiveTextEditor();
  if (!activeEditor) {
    return;
  }
  const doc = activeEditor.document;
  const mirrorDoc = docMirror.tryToGetDocument(doc);
  const guides =
    mirrorDoc && rainbow
      ? decorationsByColor(
          doc,
          rainbowBrackets.activeGuides(
            mirrorDoc.model.lineInputModel,
            rainbow,
            activeEditor.selections.map((selection): [number, number] => [
              doc.offsetAt(selection.start),
              doc.offsetAt(selection.end),
            ])
          )
        )
      : [];
  activeGuidesTypes?.forEach((type, i) => activeEditor.setDecorations(type, guides[i] ?? []));
}

export function activate(context: vscode.ExtensionContext) {
  activeEditor = utilities.tryToGetActiveTextEditor();

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor;
      if (editor && is_clojure(editor)) {
        scheduleRainbowBrackets();
      }
    },
    null,
    context.subscriptions
  );

  vscode.window.onDidChangeTextEditorSelection(
    (event) => {
      const activeEditor = utilities.tryToGetActiveTextEditor();
      if (activeEditor && event.textEditor === activeEditor && is_clojure(event.textEditor)) {
        if (lastHighlightedEditor !== event.textEditor) {
          scheduleRainbowBrackets();
        } else {
          if (matchTimer) {
            clearTimeout(matchTimer);
          }
          matchTimer = setTimeout(() => {
            matchPairs();
            if (highlightActiveIndent && rainbowTypes.length) {
              const activeEditor = utilities.tryToGetActiveTextEditor();
              if (activeEditor) {
                decorateActiveGuides();
              }
            }
          }, 16);
        }
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (is_clojure(activeEditor) && event.document === activeEditor.document) {
        scheduleRainbowBrackets();
      }
    },
    null,
    context.subscriptions
  );

  vscode.window.onDidChangeTextEditorVisibleRanges(
    (event) => {
      if (is_clojure(activeEditor) && event.textEditor === activeEditor) {
        scheduleRainbowBrackets();
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeConfiguration(
    (event) => {
      reloadConfig();
      scheduleRainbowBrackets();
    },
    null,
    context.subscriptions
  );
}

export function highlight(editor) {
  activeEditor = editor;
  scheduleRainbowBrackets();
}
