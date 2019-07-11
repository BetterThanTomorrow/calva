import * as vscode from 'vscode';
import { Position, Range, Selection } from 'vscode';
import * as isEqual from 'lodash.isequal';
import { isArray } from 'util';
import { open } from 'fs';

export function activate(context: vscode.ExtensionContext) {
  const pairs = [["(",   ")"],
                 ["[",   "]"],
                 ["{",   "}"],
                 ["#(",  ")"],
                 ["#{",  "}"],
                 ["#?(", ")"],
                 ["#?@(",")"]];
  const opening  = {},
        closing  = {},
        pairings = {},
        tokens   = ['"', "\\.", ";"];
  pairs.forEach(pair => {
    const [o,c]   = pair;
    opening[o]    = true;
    closing[c]    = true;
    pairings[o+c] = true;
    tokens.push(o, c);
  });
  const regexp = new RegExp("(" + "#_[\\s\\n,~@'^`]*|\\bcomment\\b|[\\s,]+|" + tokens.map(t => t.replace(/[\\()\[\]{}?]/g, "\\$&")).join("|") + ")", "g");
  function position_str(pos: Position) { return "" + pos.line + ":" + pos.character; }
  function is_clojure(editor) { return !!editor && editor.document.languageId === "clojure"; }

  vscode.commands.registerCommand("clojureWarrior.jumpToMatchingBracket", jumpToMatchingBracket);
  vscode.commands.registerCommand("clojureWarrior.selectToMatchingBracket", selectToMatchingBracket);

  let activeEditor:  vscode.TextEditor = vscode.window.activeTextEditor,
      configuration: vscode.WorkspaceConfiguration,
      rainbowColors,
      rainbowTypes:  vscode.TextEditorDecorationType[],
      cycleBracketColors,
      misplacedBracketStyle,
      misplacedType: vscode.TextEditorDecorationType,
      matchedBracketStyle,
      matchedType:   vscode.TextEditorDecorationType,
      commentFormStyle,
      commentFormType: vscode.TextEditorDecorationType,
      ignoredFormStyle,
      ignoredFormType: vscode.TextEditorDecorationType,
      enableBracketColors,
      pairsBack:     Map<string, [Range, Range]> = new Map(),
      pairsForward:  Map<string, [Range, Range]> = new Map(),
      rainbowTimer = undefined,
      dirty = false;

  if (is_clojure(activeEditor))
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
      return decorationType({light: {color: color[0]}, dark: {color: color[1]}});
    else
      return decorationType({color: color});
  }

  function reset_styles() {
    if (!!rainbowTypes)
      rainbowTypes.forEach(type => activeEditor.setDecorations(type, []));
    rainbowTypes = rainbowColors.map(colorDecorationType);

    if (!!misplacedType)
      activeEditor.setDecorations(misplacedType, []);
    misplacedType = decorationType(misplacedBracketStyle || {light: {color: "#fff", backgroundColor: "#c33"},
      dark: {color: "#ccc", backgroundColor: "#933"},
      overviewRulerColor: new vscode.ThemeColor("editorOverviewRuler.errorForeground"),
        overviewRulerLane: 4});

    if (!!matchedType)
      activeEditor.setDecorations(matchedType, []);
    matchedType = decorationType(matchedBracketStyle || {light: {backgroundColor: "#d0d0d0"}, dark: {backgroundColor: "#444"}});

    if(!!commentFormType)
      activeEditor.setDecorations(commentFormType, []);
    commentFormType = decorationType(commentFormStyle || {"textDecoration": "none; opacity: 0.5"});

    if(!!ignoredFormType)
      activeEditor.setDecorations(ignoredFormType, []);
    ignoredFormType = decorationType(ignoredFormStyle || {"textDecoration": "none; opacity: 0.5"});

    dirty = false;
  }

  function reloadConfig() {
    let configuration = vscode.workspace.getConfiguration("clojureWarrior", (!!activeEditor) ? activeEditor.document.uri : null);

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

    const doc           = activeEditor.document,
          text          = doc.getText(),
          rainbow       = rainbowTypes.map(()=>[]),
          misplaced     = [],
          comment_forms = [],
          ignores       = [],
          len           = rainbowTypes.length,
          colorsEnabled = enableBracketColors && len > 0,
          colorIndex    = cycleBracketColors ? (i => i % len) : (i => Math.min(i, len-1));

    let match,
        in_string = false,
        in_comment = false,
        in_ignore = false,
        ignore_start: Position,
        ignored_text_start: Position,
        ignored_list_opened = false,
        in_comment_form = false,
        stack = [],
        stack_depth = 0;
    pairsBack = new Map();
    pairsForward = new Map();
    regexp.lastIndex = 0;
    while (match = regexp.exec(text)) {
      let char: string = match[0];
      if (in_comment) {
        if (char.startsWith("\n")) { in_comment = false; continue; }
      } else if (char[0] === "\\") {
        continue;
      } else if (in_string) {
        if (char === "\"") { in_string = false; continue; }
      } else if (char === ";") {
        in_comment = true;
        continue;
      } else if (char === "\"") {
        in_string = true;
        continue;
      } else if (char.startsWith("#_") && !in_ignore) {
        in_ignore = true;
        ignore_start = activeEditor.document.positionAt(match.index);
        ignored_text_start = activeEditor.document.positionAt(match.index + char.length);
        continue;
      } else if (char.match(/[\s,]+/)) {
        if (in_ignore && !ignored_list_opened) {
          in_ignore = false;
          ignores.push(new Range(ignore_start, activeEditor.document.positionAt(match.index)));
        }
        continue;
      } else {
        if (!in_comment_form && char === "comment" && stack[stack.length - 1].char === "(") {
          in_comment_form = true;
          stack[stack.length - 1].opens_comment_form = true;
        }
        if (opening[char]) {
          const len = char.length,
            pos = activeEditor.document.positionAt(match.index);
          if (colorsEnabled) {
            const decoration = { range: new Range(pos, pos.translate(0, len)) };
            rainbow[colorIndex(stack_depth)].push(decoration);
          }
          ++stack_depth;
          const opens_ignore = in_ignore && !ignored_list_opened && pos.isEqual(ignored_text_start);
          if (opens_ignore)
            ignored_list_opened = true;
          stack.push({ char: char, pos: pos, pair_idx: undefined, opens_comment_form: false, opens_ignore: opens_ignore });
          continue;
        } else if (closing[char]) {
          const pos = activeEditor.document.positionAt(match.index),
            decoration = { range: new Range(pos, pos.translate(0, 1)) };
          var pair_idx = stack.length - 1;
          while (pair_idx >= 0 && stack[pair_idx].pair_idx !== undefined) {
            pair_idx = stack[pair_idx].pair_idx - 1;
          }
          if (pair_idx === undefined || pair_idx < 0 || !pairings[stack[pair_idx].char + char]) {
            misplaced.push(decoration);
          } else {
            let pair = stack[pair_idx],
              closing = new Range(pos, pos.translate(0, char.length)),
              opening = new Range(pair.pos, pair.pos.translate(0, pair.char.length));
            if (in_comment_form && pair.opens_comment_form) {
              comment_forms.push(new Range(pair.pos, pos.translate(0, char.length)));
              in_comment_form = false;
            }
            if (in_ignore && (pair.opens_ignore || !ignored_list_opened)) {
              const ignore_end = ignored_list_opened ? pos.translate(0, char.length) : pos;
              ignores.push(new Range(ignore_start, ignore_end));
              in_ignore = false;
              ignored_list_opened = false;
            }
            stack.push({ char: char, pos: pos, pair_idx: pair_idx });
            for (let i = 0; i < char.length; ++i)
              pairsBack.set(position_str(pos.translate(0, i)), [opening, closing]);
            for (let i = 0; i < pair.char.length; ++i)
              pairsForward.set(position_str(pair.pos.translate(0, i)), [opening, closing]);
            --stack_depth;
            if (colorsEnabled) rainbow[colorIndex(stack_depth)].push(decoration);
          }
          continue;
        }
      }
    }
    for (var i=0; i<rainbowTypes.length; ++i) {
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
        return pairsBack.get(position_str(cursor.translate(0,-1)));
  }

  function matchAfter(selection) {
    const cursor = selection.active;
    if (cursor.isAfterOrEqual(selection.anchor))
      if (cursor.translate(0,1).line === cursor.line)
        return pairsForward.get(position_str(cursor));
  }

  function matchPairs() {
    if (!is_clojure(activeEditor)) return;

    const matches = [];
    activeEditor.selections.forEach(selection => {
      const match_before  = matchBefore(selection),
            match_after   = matchAfter(selection);
      if (!!match_before) {
          matches.push({range: match_before[0]});
          matches.push({range: match_before[1]});
      }
      if (!!match_after) {
        matches.push({range: match_after[0]});
        matches.push({range: match_after[1]});
      }
    });
    activeEditor.setDecorations(matchedType, matches);
  }

  function jumpToMatchingBracket() {
    if (!is_clojure(activeEditor)) return;
    activeEditor.selections = activeEditor.selections.map(selection => {
      const match_before  = matchBefore(selection),
            match_after   = matchAfter(selection);
      if (!!match_before) {
        const opening = match_before[0];
        return new Selection(opening.start, opening.start);
      } else if (!!match_after) {
        const closing = match_after[1];
        return new Selection(closing.end, closing.end);
      } else
        return selection;
    });
    activeEditor.revealRange(activeEditor.selections[0]);
  }

  function selectToMatchingBracket() {
    if (!is_clojure(activeEditor)) return;


    activeEditor.selections = activeEditor.selections.map(selection => {
      const cursor = selection.active,
            match_before  = matchBefore(selection),
            match_after   = matchAfter(selection);
      if (!!match_before) {
        const opening = match_before[0];
        return new Selection(cursor, opening.start);
      } else if (!!match_after) {
        const closing = match_after[1];
        return new Selection(cursor, closing.end);
      } else
        return selection;
    });
    activeEditor.revealRange(new Range(activeEditor.selections[0].active, activeEditor.selections[0].active));
  }
}
