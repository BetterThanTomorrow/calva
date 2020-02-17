import * as vscode from 'vscode';
import { Position, Range } from 'vscode';
import * as isEqual from 'lodash.isequal';
import { isArray } from 'util';
import * as docMirror from '../../doc-mirror'
import { Token, validPair } from '../../cursor-doc/clojure-lexer';
import * as util from '../../utilities';
import { LispTokenCursor } from '../../cursor-doc/token-cursor';

export function activate(context: vscode.ExtensionContext) {
  function position_str(pos: Position) { return "" + pos.line + ":" + pos.character; }
  function is_clojure(editor) { return !!editor && editor.document.languageId === "clojure"; }

  let activeEditor: vscode.TextEditor = vscode.window.activeTextEditor,
    rainbowColors,
    rainbowTypes: vscode.TextEditorDecorationType[],
    cycleBracketColors,
    misplacedBracketStyle,
    misplacedType: vscode.TextEditorDecorationType,
    matchedBracketStyle,
    matchedType: vscode.TextEditorDecorationType,
    commentFormStyle,
    commentFormType: vscode.TextEditorDecorationType,
    ignoredFormStyle,
    ignoredFormType: vscode.TextEditorDecorationType,
    enableBracketColors,
    pairsBack: Map<string, [Range, Range]> = new Map(),
    pairsForward: Map<string, [Range, Range]> = new Map(),
    rainbowTimer = undefined,
    dirty = false;

  reloadConfig();

  vscode.window.onDidChangeActiveTextEditor(editor => {
    activeEditor = editor;
    if (is_clojure(editor))
      scheduleRainbowBrackets();
  }, null, context.subscriptions);

  vscode.window.onDidChangeTextEditorSelection(event => {
    if (event.textEditor === vscode.window.activeTextEditor && is_clojure(event.textEditor))
      matchPairs();
  }, null, context.subscriptions);

  vscode.workspace.onDidChangeTextDocument(event => {
    if (is_clojure(activeEditor) && event.document === activeEditor.document)
      scheduleRainbowBrackets();
  }, null, context.subscriptions);

  vscode.window.onDidChangeTextEditorVisibleRanges(event => {
    if (is_clojure(activeEditor) && event.textEditor === activeEditor)
      scheduleRainbowBrackets();
  }, null, context.subscriptions);

  vscode.workspace.onDidChangeConfiguration(event => {
    reloadConfig();
    scheduleRainbowBrackets();
  }, null, context.subscriptions);

  function decorationType(opts) {
    opts.rangeBehavior = vscode.DecorationRangeBehavior.ClosedClosed;
    return vscode.window.createTextEditorDecorationType(opts);
  }

  function colorDecorationType(color) {
    if (isArray(color))
      return decorationType({ light: { color: color[0] }, dark: { color: color[1] } });
    else
      return decorationType({ color: color });
  }

  function reset_styles() {
    if (!!rainbowTypes)
      rainbowTypes.forEach(type => activeEditor.setDecorations(type, []));
    rainbowTypes = rainbowColors.map(colorDecorationType);

    if (!!misplacedType)
      activeEditor.setDecorations(misplacedType, []);
    misplacedType = decorationType(misplacedBracketStyle || {
      light: { color: "#fff", backgroundColor: "#c33" },
      dark: { color: "#ccc", backgroundColor: "#933" },
      overviewRulerColor: new vscode.ThemeColor("editorOverviewRuler.errorForeground"),
      overviewRulerLane: 4
    });

    if (!!matchedType)
      activeEditor.setDecorations(matchedType, []);
    matchedType = decorationType(matchedBracketStyle || { light: { backgroundColor: "#d0d0d0" }, dark: { backgroundColor: "#444" } });

    if (!!commentFormType)
      activeEditor.setDecorations(commentFormType, []);
    commentFormType = decorationType(commentFormStyle || { "fontStyle": "italic" });

    if (!!ignoredFormType)
      activeEditor.setDecorations(ignoredFormType, []);
    ignoredFormType = decorationType(ignoredFormStyle || { "textDecoration": "none; opacity: 0.5" });

    dirty = false;
  }

  function reloadConfig() {
    let configuration = vscode.workspace.getConfiguration("calva.highlight", (!!activeEditor) ? activeEditor.document.uri : null);

    if (!isEqual(rainbowColors, configuration.get<string[]>("bracketColors"))) {
      rainbowColors = configuration.get<string[]>("bracketColors") || [["#000", "#ccc"], "#0098e6", "#e16d6d", "#3fa455", "#c968e6", "#999", "#ce7e00"];
      dirty = true;
    }

    if (cycleBracketColors !== configuration.get<boolean>("cycleBracketColors")) {
      cycleBracketColors = configuration.get<boolean>("cycleBracketColors");
      dirty = true;
    }

    if (!isEqual(misplacedBracketStyle, configuration.get("misplacedBracketStyle"))) {
      misplacedBracketStyle = configuration.get("misplacedBracketStyle");
      dirty = true;
    }

    if (!isEqual(matchedBracketStyle, configuration.get("matchedBracketStyle"))) {
      matchedBracketStyle = configuration.get("matchedBracketStyle");
      dirty = true;
    }

    if (enableBracketColors !== configuration.get<boolean>("enableBracketColors")) {
      enableBracketColors = configuration.get<boolean>("enableBracketColors");
      dirty = true;
    }

    if (!isEqual(commentFormStyle, configuration.get("commentFormStyle"))) {
      commentFormStyle = configuration.get("commentFormStyle");
      dirty = true;
    }

    if (!isEqual(ignoredFormStyle, configuration.get("ignoredFormStyle"))) {
      ignoredFormStyle = configuration.get("ignoredFormStyle");
      dirty = true;
    }

    if (dirty)
      scheduleRainbowBrackets();
  }

  function scheduleRainbowBrackets() {
    if (rainbowTimer)
      clearTimeout(rainbowTimer);
    if (is_clojure(activeEditor))
      rainbowTimer = setTimeout(updateRainbowBrackets, 16);
  }

  function updateRainbowBrackets() {
    if (!is_clojure(activeEditor)) return;

    if (dirty) reset_styles();

    const t1 = new Date();

    const doc = activeEditor.document,
      tokenCursor = docMirror.getDocument(doc).getTokenCursor(0),
      toplevelRanges = tokenCursor.rangesForTopLevelForms()
        .map((r: [number, number]) => {
          return new Range(doc.positionAt(r[0]), doc.positionAt(r[1]));
        }),
      rainbow = rainbowTypes.map(() => []),
      misplaced = [],
      comment_forms = [],
      ignores = [],
      len = rainbowTypes.length,
      colorsEnabled = enableBracketColors && len > 0,
      colorIndex = cycleBracketColors ? (i => i % len) : (i => Math.min(i, len - 1));

    let in_comment = false,
      ignore_counter = 0,
      ignore_start: Position,
      ignored_text_start: Position,
      ignored_list_opened = false,
      ignore_pushed_by_closing = false,
      in_comment_form = false,
      stack = [],
      stack_depth = 0;
    pairsBack = new Map();
    pairsForward = new Map();
    const visibleTopLevelRanges = util.filterVisibleRanges(activeEditor, toplevelRanges);
    console.log(visibleTopLevelRanges);
    visibleTopLevelRanges.forEach(range => {
      const rangeStart = doc.offsetAt(range.start),
        rangeEnd = doc.offsetAt(range.end),
        cursor = docMirror.getDocument(doc).getTokenCursor(rangeStart);
      do {
        const token: Token = cursor.getToken(),
          char: string = token.raw;
        if (in_comment) {
          if (char.includes("\n")) { in_comment = false; continue; }
        } else if (char[0] === "\\") {
          continue;
        } else if (token.type === 'str-inside') {
          continue;
        } else if (char === ";") {
          in_comment = true;
          continue;
        } else if (char.startsWith('#_')) {
          if (ignore_counter == 0) {
            ignore_start = activeEditor.document.positionAt(cursor.offsetStart);
          }
          ignored_text_start = activeEditor.document.positionAt(cursor.offsetEnd);
          ignore_counter++
          continue;
        } else if (token.type === 'ws') {
          if (ignore_counter > 0 && !ignored_list_opened) {
            ignored_text_start = activeEditor.document.positionAt(cursor.offsetEnd);
            if (!ignore_pushed_by_closing) {
              ignore_counter--;
              ignores.push(new Range(ignore_start, activeEditor.document.positionAt(cursor.offsetStart)));
            }
          }
          ignore_pushed_by_closing = false;
          continue;
        } else if (char.endsWith('"') && (token.type === 'open' || token.type === 'close')) {
          continue;
        } else {
          const charLength = char.length;
          if (!in_comment_form && char === "comment") {
            const peekCursor = cursor.clone();
            peekCursor.backwardWhitespace();
            if (peekCursor.getPrevToken().raw === '(') {
              in_comment_form = true;
              stack[stack.length - 1].opens_comment_form = true;
            }
          }
          if (token.type === 'open') {
            const pos = activeEditor.document.positionAt(cursor.offsetStart);
            if (colorsEnabled) {
              const decoration = { range: new Range(pos, pos.translate(0, charLength)) };
              rainbow[colorIndex(stack_depth)].push(decoration);
            }
            ++stack_depth;
            const opens_ignore = ignore_counter > 0 && !ignored_list_opened && pos.isEqual(ignored_text_start);
            if (opens_ignore) {
              ignored_list_opened = opens_ignore;
            }
            stack.push({ char: char, pos: pos, pair_idx: undefined, opens_comment_form: false, opens_ignore: opens_ignore });
            continue;
          } else if (token.type === 'close') {
            const pos = activeEditor.document.positionAt(cursor.offsetStart),
              decoration = { range: new Range(pos, pos.translate(0, 1)) };
            var pair_idx = stack.length - 1;
            while (pair_idx >= 0 && stack[pair_idx].pair_idx !== undefined) {
              pair_idx = stack[pair_idx].pair_idx - 1;
            }
            if (pair_idx === undefined || pair_idx < 0 || !validPair(stack[pair_idx].char, char)) {
              misplaced.push(decoration);
            } else {
              let pair = stack[pair_idx],
                closing = new Range(pos, pos.translate(0, charLength)),
                opening = new Range(pair.pos, pair.pos.translate(0, pair.char.length));
              if (in_comment_form && pair.opens_comment_form) {
                comment_forms.push(new Range(pair.pos, pos.translate(0, charLength)));
                in_comment_form = false;
              }
              if (ignore_counter > 0 && (pair.opens_ignore || !ignored_list_opened)) {
                const ignore_end = ignored_list_opened ? pos.translate(0, charLength) : pos;
                ignore_counter--;
                ignores.push(new Range(ignore_start, ignore_end));
                ignored_list_opened = false;
                ignored_text_start = activeEditor.document.positionAt(cursor.offsetEnd);
                ignore_pushed_by_closing = true;
              }
              stack.push({ char: char, pos: pos, pair_idx: pair_idx });
              for (let i = 0; i < charLength; ++i)
                pairsBack.set(position_str(pos.translate(0, i)), [opening, closing]);
              for (let i = 0; i < pair.char.length; ++i)
                pairsForward.set(position_str(pair.pos.translate(0, i)), [opening, closing]);
              --stack_depth;
              if (colorsEnabled) rainbow[colorIndex(stack_depth)].push(decoration);
            }
            continue;
          }
        }
      } while (cursor.offsetStart < rangeEnd && cursor.next());
    });

    console.log("Highlight parsing took: ", new Date().valueOf() - t1.valueOf());

    for (var i = 0; i < rainbowTypes.length; ++i) {
      activeEditor.setDecorations(rainbowTypes[i], rainbow[i]);
    }
    activeEditor.setDecorations(misplacedType, misplaced);
    activeEditor.setDecorations(commentFormType, comment_forms);
    activeEditor.setDecorations(ignoredFormType, ignores);
    matchPairs();
  }

  function matchBefore(selection) {
    const cursor = selection.active;
    if (cursor.isBeforeOrEqual(selection.anchor))
      if (cursor.character > 0)
        return pairsBack.get(position_str(cursor.translate(0, -1)));
  }

  function matchAfter(selection) {
    const cursor = selection.active;
    if (cursor.isAfterOrEqual(selection.anchor))
      if (cursor.translate(0, 1).line === cursor.line)
        return pairsForward.get(position_str(cursor));
  }

  function matchPairs() {
    if (!is_clojure(activeEditor)) return;

    const matches = [];
    activeEditor.selections.forEach(selection => {
      const match_before = matchBefore(selection),
        match_after = matchAfter(selection);
      if (!!match_before) {
        matches.push({ range: match_before[0] });
        matches.push({ range: match_before[1] });
      }
      if (!!match_after) {
        matches.push({ range: match_after[0] });
        matches.push({ range: match_after[1] });
      }
    });
    activeEditor.setDecorations(matchedType, matches);
  }
}