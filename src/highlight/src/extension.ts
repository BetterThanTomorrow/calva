import * as vscode from 'vscode';
import { Position, Range } from 'vscode';
import * as isEqual from 'lodash.isequal';
import { isArray } from 'util';
import * as docMirror from '../../doc-mirror/index';
import { Token, validPair } from '../../cursor-doc/clojure-lexer';
import { LispTokenCursor } from '../../cursor-doc/token-cursor';
import { tryToGetActiveTextEditor, getActiveTextEditor } from '../../utilities';

type StackItem = {
  char: string;
  start: Position;
  end: Position;
  pair_idx: number;
  opens_comment_form?: boolean;
};

function position_str(pos: Position) {
  return '' + pos.line + ':' + pos.character;
}
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
  pairsBack: Map<string, [Range, Range]> = new Map(),
  pairsForward: Map<string, [Range, Range]> = new Map(),
  placedGuidesColor: Map<string, number> = new Map(),
  rainbowTimer = undefined,
  matchTimer = undefined,
  dirty = false;

reloadConfig();

function decorationType(opts) {
  opts.rangeBehavior = vscode.DecorationRangeBehavior.ClosedClosed;
  return vscode.window.createTextEditorDecorationType(opts);
}

function colorDecorationType(color) {
  if (isArray(color)) {
    return decorationType({
      light: { color: color[0] },
      dark: { color: color[1] },
    });
  } else {
    return decorationType({ color: color });
  }
}

function guidesDecorationType_(color, isActive: boolean): vscode.TextEditorDecorationType {
  if (isArray(color)) {
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
  const mirrorDoc = docMirror.getDocument(doc);
  const rainbow = rainbowTypes.map(() => []);
  const rainbowGuides = rainbowTypes.map(() => []);
  const misplaced = [];
  const comment_forms = [];
  const ignores = [];
  const topLevelIgnores = [];
  const len = rainbowTypes.length;
  const colorsEnabled = enableBracketColors && len > 0;
  const guideColorsEnabled = useRainbowIndentGuides && len > 0;
  const activeGuideEnabled = highlightActiveIndent && len > 0;
  const colorIndex = cycleBracketColors ? (i) => i % len : (i) => Math.min(i, len - 1);

  let in_comment_form = false;
  let stack_depth = 0;
  const stack: StackItem[] = [];
  pairsBack = new Map();
  pairsForward = new Map();
  placedGuidesColor = new Map();
  activeEditor.visibleRanges.forEach((range) => {
    // Find the visible forms
    const startOffset = doc.offsetAt(range.start);
    const endOffset = doc.offsetAt(range.end);
    const startCursor: LispTokenCursor = mirrorDoc.getTokenCursor(0);
    const startRange = startCursor.rangeForDefun(startOffset, false);
    const endCursor: LispTokenCursor = mirrorDoc.getTokenCursor(endOffset);
    const endRange = endCursor.rangeForDefun(endOffset, false);
    const rangeStart = startRange ? startRange[0] : startOffset;
    const rangeEnd = endRange ? endRange[1] : endOffset;
    // Look for top level ignores, and adjust starting point if found
    const topLevelSentinelCursor = mirrorDoc.getTokenCursor(rangeStart);
    let startPaintingFrom = rangeStart;
    for (let i = 0; i < 25 && topLevelSentinelCursor.backwardSexp(); i++) {
      if (topLevelSentinelCursor.getToken().type === 'ignore') {
        do {
          topLevelSentinelCursor.backwardSexp();
        } while (
          !topLevelSentinelCursor.atStart() &&
          topLevelSentinelCursor.getToken().type === 'ignore'
        );
        startPaintingFrom = topLevelSentinelCursor.offsetStart;
        break;
      }
    }
    // Start painting!
    const cursor: LispTokenCursor = mirrorDoc.getTokenCursor(startPaintingFrom);
    do {
      cursor.forwardWhitespace();
      {
        // Skip pass strings and literals, and highlight ignored forms.
        const token: Token = cursor.getToken();
        if (token.type === 'str-inside' || token.raw.includes('"')) {
          continue;
        } else if (token.type === 'lit') {
          continue;
        } else if (token.type === 'ignore') {
          const ignoreCursor = cursor.clone();
          let ignore_counter = 0;
          const ignore_start = activeEditor.document.positionAt(ignoreCursor.offsetStart);
          while (ignoreCursor.getToken().type === 'ignore') {
            ignore_counter++;
            ignoreCursor.next();
            ignoreCursor.forwardWhitespace();
          }
          for (let i = 0; i < ignore_counter; i++) {
            ignoreCursor.forwardSexp(true, true, true);
          }
          const ignore_end = activeEditor.document.positionAt(ignoreCursor.offsetStart);
          if (cursor.atTopLevel()) {
            topLevelIgnores.push(new Range(ignore_start, ignore_end));
          } else {
            ignores.push(new Range(ignore_start, ignore_end));
          }
        }
      }
      const token = cursor.getToken(),
        char = token.raw,
        charLength = char.length;
      // Highlight (comment ...) forms
      if (!in_comment_form && char === 'comment') {
        const peekCursor = cursor.clone();
        peekCursor.backwardWhitespace();
        if (peekCursor.getPrevToken().raw === '(') {
          in_comment_form = true;
          stack[stack.length - 1].opens_comment_form = true;
        }
      }
      // Rainbows! (And also highlight current parens.)
      if (token.type === 'open') {
        const readerCursor = cursor.clone();
        readerCursor.backwardThroughAnyReader();
        const start = activeEditor.document.positionAt(readerCursor.offsetStart),
          end = activeEditor.document.positionAt(cursor.offsetEnd),
          openRange = new Range(start, end),
          openString = activeEditor.document.getText(openRange);
        if (colorsEnabled) {
          const decoration = { range: openRange };
          rainbow[colorIndex(stack_depth)].push(decoration);
        }
        ++stack_depth;
        stack.push({
          char: openString,
          start: start,
          end: end,
          pair_idx: undefined,
          opens_comment_form: false,
        });
        continue;
      } else if (token.type === 'close') {
        const pos = activeEditor.document.positionAt(cursor.offsetStart),
          decoration = { range: new Range(pos, pos.translate(0, 1)) };
        let pair_idx = stack.length - 1;
        while (pair_idx >= 0 && stack[pair_idx].pair_idx !== undefined) {
          pair_idx = stack[pair_idx].pair_idx - 1;
        }
        if (pair_idx === undefined || pair_idx < 0 || !validPair(stack[pair_idx].char, char)) {
          misplaced.push(decoration);
        } else {
          const pair = stack[pair_idx],
            closing = new Range(pos, pos.translate(0, charLength)),
            opening = new Range(pair.end.translate(0, -1), pair.end);
          if (in_comment_form && pair.opens_comment_form) {
            comment_forms.push(new Range(pair.start, pos.translate(0, charLength)));
            in_comment_form = false;
          }
          stack.push({
            char: char,
            start: pos,
            end: pos.translate(0, charLength),
            pair_idx: pair_idx,
          });
          pairsBack.set(position_str(pos), [opening, closing]);
          const startOffset = activeEditor.document.offsetAt(pair.start);
          for (let i = 0; i < pair.char.length; ++i) {
            pairsForward.set(position_str(activeEditor.document.positionAt(startOffset + i)), [
              opening,
              closing,
            ]);
          }
          --stack_depth;
          if (colorsEnabled) {
            rainbow[colorIndex(stack_depth)].push(decoration);
          }
          if (guideColorsEnabled || activeGuideEnabled) {
            const matchPos = pos.translate(0, 1);
            const openSelection = matchBefore(new vscode.Selection(matchPos, matchPos));
            const openSelectionPos = openSelection[0].start;
            const guideLength = decorateGuide(
              doc,
              openSelectionPos,
              matchPos,
              rainbowGuides[colorIndex(stack_depth)]
            );
            if (guideLength > 0) {
              placedGuidesColor.set(position_str(openSelectionPos), colorIndex(stack_depth));
            }
          }
          continue;
        }
      }
    } while (cursor.offsetStart < rangeEnd && cursor.next());
  });

  for (let i = 0; i < rainbowTypes.length; ++i) {
    activeEditor.setDecorations(rainbowTypes[i], rainbow[i]);
    if (guideColorsEnabled) {
      activeEditor.setDecorations(rainbowGuidesTypes[i], rainbowGuides[i]);
    }
  }
  activeEditor.setDecorations(misplacedType, misplaced);
  activeEditor.setDecorations(commentFormType, comment_forms);
  activeEditor.setDecorations(ignoredFormType, ignores);
  activeEditor.setDecorations(ignoredTopLevelFormType, topLevelIgnores);
  matchPairs();
  if (activeGuideEnabled) {
    decorateActiveGuides();
  }
}

function matchBefore(selection) {
  const cursor = selection.active;
  if (cursor.isBeforeOrEqual(selection.anchor)) {
    if (cursor.character > 0) {
      return pairsBack.get(position_str(cursor.translate(0, -1)));
    }
  }
}

function matchAfter(selection) {
  const cursor = selection.active;
  if (cursor.isAfterOrEqual(selection.anchor)) {
    if (cursor.translate(0, 1).line === cursor.line) {
      return pairsForward.get(position_str(cursor));
    }
  }
}

function matchPairs() {
  if (!is_clojure(activeEditor)) {
    return;
  }

  const matches: { range: vscode.Range }[] = [];
  activeEditor.selections.forEach((selection) => {
    const match_before = matchBefore(selection),
      match_after = matchAfter(selection);
    if (match_before) {
      matches.push({ range: match_before[0] });
      matches.push({ range: match_before[1] });
    }
    if (match_after) {
      matches.push({ range: match_after[0] });
      matches.push({ range: match_after[1] });
    }
  });
  activeEditor.setDecorations(matchedType, matches);
}

function decorateGuide(
  doc: vscode.TextDocument,
  startPos: vscode.Position,
  endPos: vscode.Position,
  guides: any[]
): number {
  let guideLength = 0;
  for (let lineDelta = 1; lineDelta <= endPos.line - startPos.line; lineDelta++) {
    const guidePos = startPos.translate(lineDelta, 0);
    if (doc.lineAt(guidePos).text.match(/^ */)[0].length >= startPos.character) {
      const guidesDecoration = { range: new Range(guidePos, guidePos) };
      guides.push(guidesDecoration);
      guideLength++;
    }
  }
  return guideLength;
}

function decorateActiveGuides() {
  const activeGuides = [];
  activeEditor = getActiveTextEditor();
  if (activeGuidesTypes) {
    activeGuidesTypes.forEach((type) => activeEditor.setDecorations(type, []));
  }
  activeEditor.selections.forEach((selection) => {
    const doc = activeEditor.document;
    const mirrorDoc = docMirror.getDocument(doc);
    const cursor = mirrorDoc.getTokenCursor(doc.offsetAt(selection.start));
    const visitedEndPositions = [selection.start];
    findActiveGuide: while (cursor.forwardList() && cursor.upList()) {
      const endPos = doc.positionAt(cursor.offsetStart);
      for (let i = 0; i < visitedEndPositions.length; i++) {
        if (endPos.isEqual(visitedEndPositions[i])) {
          break findActiveGuide;
        }
      }
      visitedEndPositions.push(endPos);
      cursor.backwardSexp();
      const downCursor = cursor.clone();
      if (downCursor.downList()) {
        const startPos = doc.positionAt(downCursor.offsetStart - 1);
        const guideRange = new vscode.Range(startPos, endPos);
        const colorIndex = placedGuidesColor.get(position_str(startPos));
        if (colorIndex !== undefined) {
          if (guideRange.contains(selection)) {
            decorateGuide(doc, startPos, endPos, activeGuides);
            activeEditor.setDecorations(activeGuidesTypes[colorIndex], activeGuides);
          }
          break;
        }
      } else {
        break;
      }
    }
  });
}

export function activate(context: vscode.ExtensionContext) {
  activeEditor = tryToGetActiveTextEditor();

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor;
      if (is_clojure(editor)) {
        scheduleRainbowBrackets();
      }
    },
    null,
    context.subscriptions
  );

  vscode.window.onDidChangeTextEditorSelection(
    (event) => {
      if (event.textEditor === tryToGetActiveTextEditor() && is_clojure(event.textEditor)) {
        if (lastHighlightedEditor !== event.textEditor) {
          scheduleRainbowBrackets();
        } else {
          if (matchTimer) {
            clearTimeout(matchTimer);
          }
          matchTimer = setTimeout(() => {
            matchPairs();
            if (highlightActiveIndent && rainbowTypes.length) {
              decorateActiveGuides();
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
