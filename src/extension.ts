import * as vscode from 'vscode';
import { Position, Range, Selection } from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const pairs = { ")": "(", "]": "[", "}": "{"};	
	function opening(char) { return char==="(" || char==="[" || char==="{"; }
	function closing(char) { return char===")" || char==="]" || char==="}"; }
	function position_str(pos: Position) { return "" + pos.line + ":" + pos.character; }
	function is_clojure(editor) { return !!editor && editor.document.languageId === "clojure"; } 

	let activeEditor:  vscode.TextEditor = vscode.window.activeTextEditor,
			configuration: vscode.WorkspaceConfiguration,
			rainbowTypes:  vscode.TextEditorDecorationType[],
			cycleRainbow:  boolean,
			misplacedType: vscode.TextEditorDecorationType,
			matchedType:   vscode.TextEditorDecorationType,
			bracketPairs:  Map<string, Position> = new Map();

	if (activeEditor)
		scheduleRainbowBrackets();

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		// console.log("onDidChangeActiveTextEditor", editor.document.languageId);
		if (is_clojure(editor))
			scheduleRainbowBrackets();
	}, null, context.subscriptions);

	vscode.window.onDidChangeTextEditorSelection(event => {
		if (event.textEditor === vscode.window.activeTextEditor && is_clojure(event.textEditor))
			scheduleMatchPairs();
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
    if (is_clojure(activeEditor) && event.document === activeEditor.document)
			scheduleRainbowBrackets();
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeConfiguration(event => {
		configuration = undefined;
		scheduleRainbowBrackets();
	}, null, context.subscriptions);
	
	function reloadConfig() {
		if (activeEditor && configuration === undefined) {
			configuration = vscode.workspace.getConfiguration("clojureWarrior", activeEditor.document.uri);
			rainbowTypes = configuration.get<string[]>("bracketColors").map(color => vscode.window.createTextEditorDecorationType({color: color}));
			cycleRainbow = configuration.get("cycleBracketColors");
			misplacedType = vscode.window.createTextEditorDecorationType(configuration.get("misplacedBracketStyle") || { "color": "#fff", "backgroundColor": "#c33" });
			matchedType = vscode.window.createTextEditorDecorationType(configuration.get("matchedBracketStyle") || {"backgroundColor": "#E0E0E0"});
			vscode.workspace.getConfiguration(undefined, activeEditor.document.uri).update('editor.matchBrackets', false, true);
		}
	}

	var rainbowTimer = null,
	    matchTimer = null;
	function scheduleRainbowBrackets() {
		if (rainbowTimer)
			clearTimeout(rainbowTimer);
		if (matchTimer) // because updateRainbowBrackets triggers matchPairs
			clearTimeout(matchTimer);
		if (is_clojure(activeEditor))
			rainbowTimer = setTimeout(updateRainbowBrackets, 16);
	}
	function scheduleMatchPairs() {
		if (matchTimer)
			clearTimeout(matchTimer);
		if (is_clojure(activeEditor))
			matchTimer = setTimeout(matchPairs, 16);
	}

	function updateRainbowBrackets() {
		if (!is_clojure(activeEditor)) return;
		reloadConfig();

		const regexp     = /(\[|\]|\(|\)|\{|\}|\"|\\.|\;|\n)/g,
					doc        = activeEditor.document,
		      text       = doc.getText(),
		      rainbow    = rainbowTypes.map(()=>[]),
		      misplaced  = [],
					len        = rainbowTypes.length,
					colorIndex = cycleRainbow ? (i => i % len) : (i => Math.min(i, len-1));

		let match,
		    in_string = false,
				in_comment = false,
				stack = [],
				stack_depth = 0;
		bracketPairs = new Map();
		while (match = regexp.exec(text)) {
			let char = match[0];
			if (in_comment) {
				if (char === "\n") { in_comment = false; continue; }
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
			} else if (char === "\n") {
				continue;
			} else if (opening(char)) {
				const pos = activeEditor.document.positionAt(match.index),
							decoration = { range: new Range(pos, pos.translate(0,1)) };
				rainbow[colorIndex(stack_depth)].push(decoration);
				++stack_depth;
				stack.push({ char: char, pos: pos, pair_idx: undefined});
				continue;
			} else if (closing(char)) {
				const pos = activeEditor.document.positionAt(match.index),
				      decoration = { range: new Range(pos, pos.translate(0,1)) };
				var pair_idx = stack.length - 1;
				while (pair_idx >= 0 && stack[pair_idx].pair_idx !== undefined) {
					pair_idx = stack[pair_idx].pair_idx - 1;
				}
				if (pair_idx === undefined || pair_idx < 0 || stack[pair_idx].char !== pairs[char]) {
					misplaced.push(decoration);
				} else {
					let pair = stack[pair_idx];
					stack.push({ char: char, pos: pos, pair_idx: pair_idx });
					bracketPairs.set(position_str(pos), pair.pos);
					bracketPairs.set(position_str(pair.pos), pos);
					--stack_depth;
					rainbow[colorIndex(stack_depth)].push(decoration);
				}
				continue;
			}
		}
		for (var i=0; i<rainbowTypes.length; ++i) {
		  activeEditor.setDecorations(rainbowTypes[i], rainbow[i]);
		}
		activeEditor.setDecorations(misplacedType, misplaced);
		matchPairs();
	}

	function matchBefore(doc: vscode.TextDocument, cursor: Position): Position {
		if (cursor.character > 0) {
			const cursor_before = cursor.translate(0,-1),
						range_before  = new Range(cursor_before, cursor),
						char_before   = doc.getText(range_before);
			if (closing(char_before)/* || !opening(char_after)*/)
				return bracketPairs.get(position_str(cursor_before));
		}
	}

	function matchAfter(doc: vscode.TextDocument, cursor: Position): Position {
		const cursor_after = cursor.translate(0,1);
		if (cursor_after.line === cursor.line) {
		  const range_after = new Range(cursor, cursor_after),
					  char_after  = doc.getText(range_after);
			if (opening(char_after)/* || !closing(char_before)*/)
				return bracketPairs.get(position_str(cursor));
		}
	}

	function matchPairs() {
		if (!is_clojure(activeEditor)) return;
		reloadConfig();
		const matches = [],
		      doc = activeEditor.document;
		activeEditor.selections.forEach(selection => {
			const cursor        = selection.active,
						match_before  = matchBefore(doc, cursor),
						match_after   = matchAfter(doc, cursor);
			if (!!match_before) {
				matches.push({range: new Range(cursor.translate(0,-1), cursor)});
				matches.push({range: new Range(match_before, match_before.translate(0,1))});
			}
			if (!!match_after) {
					matches.push({range: new Range(cursor, cursor.translate(0,1))});
					matches.push({range: new Range(match_after, match_after.translate(0,1))});
			}
		});
		activeEditor.setDecorations(matchedType, matches);	
	}

	function jumpToMatchingBracket() {
		if (!is_clojure(activeEditor)) return;
		reloadConfig();
		const doc = activeEditor.document;

		activeEditor.selections = activeEditor.selections.map(selection => {
			const cursor        = selection.active,
						match_before  = matchBefore(doc, cursor),
						match_after   = matchAfter(doc, cursor);
			if (!!match_before)
				return new Selection(match_before, match_before);
			else if (!!match_after)
				return new Selection(match_after.translate(0,1), match_after.translate(0,1));
			else
				return selection;
		});
	}

	function selectToMatchingBracket() {
		if (!is_clojure(activeEditor)) return;
		reloadConfig();
		const doc = activeEditor.document;

		activeEditor.selections = activeEditor.selections.map(selection => {
			const cursor        = selection.active,
						match_before  = matchBefore(doc, cursor),
						match_after   = matchAfter(doc, cursor);
			if (!!match_before)
				return new Selection(cursor, match_before);
			else if (!!match_after)
				return new Selection(cursor, match_after.translate(0,1));
			else
				return selection;
		});
	}

	vscode.commands.registerCommand("clojureWarrior.jumpToMatchingBracket", jumpToMatchingBracket);
	vscode.commands.registerCommand("clojureWarrior.selectToMatchingBracket", selectToMatchingBracket);
}
