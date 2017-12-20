import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const pairs = { ")": "(", "]": "[", "}": "{"};
	let activeEditor = vscode.window.activeTextEditor,
			configuration,
			decorationTypes,
			incorrectType,
			cycle: boolean;

	if (activeEditor) {
		triggerUpdateDecorations();
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (editor) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeConfiguration(event => {
		configuration = undefined;
		triggerUpdateDecorations();
	}, null, context.subscriptions);

	function reloadConfig() {
		if (activeEditor && configuration === undefined) {
			configuration = vscode.workspace.getConfiguration("clojureWarrior", activeEditor.document.uri);
			decorationTypes = configuration.get("bracketColors").map(color => vscode.window.createTextEditorDecorationType({color: color}));
			cycle = configuration.get("cycleBracketColors");
			incorrectType = vscode.window.createTextEditorDecorationType(configuration.get("misplacedBracketStyle") || { "color": "#fff", "backgroundColor": "#c33" });
		}
	}

	var timeout = null;
	function triggerUpdateDecorations() {
		if (timeout) {
			clearTimeout(timeout);
		}
		if (activeEditor && activeEditor.document.languageId === 'clojure') {
			timeout = setTimeout(updateDecorations, 16);
		}
	}

	function updateDecorations() {
		if (!activeEditor) return;
		reloadConfig();

		const regexp      = /(\[|\]|\(|\)|\{|\}|\"|\\.|\;|\n)/g,
		      text        = activeEditor.document.getText(),
		      decorations = decorationTypes.map(()=>[]),
		      incorrect   = [],
					len         = decorationTypes.length,
					colorIndex  = cycle ? (i => i % len) : (i => Math.min(i, len-1));

		let match,
		    in_string = false,
				in_comment = false,
				stack = "";
		while (match = regexp.exec(text)) {
			let word = match[0];
			if (in_comment) {
				if (word === "\n") { in_comment = false; continue; }
			} else if (word[0] === "\\") {
				continue;
			} else if (in_string) {
				if (word === "\"") { in_string = false; continue; }
			} else if (word === ";") {
				in_comment = true; continue;
			} else if (word === "\"") {
				in_string = true; continue;
			} else if (word === "\n") {
				continue;
			} else if (word === "(" || word === "[" || word === "{") {
				const startPos   = activeEditor.document.positionAt(match.index),
				      endPos     = startPos.translate(0,1),
							decoration = { range: new vscode.Range(startPos, endPos) };
				decorations[colorIndex(stack.length)].push(decoration);
				stack += word;
				continue;
			} else if (word === ")" || word === "]" || word === "}") {
				const startPos   = activeEditor.document.positionAt(match.index),
				      endPos     = startPos.translate(0,1),
							decoration = { range: new vscode.Range(startPos, endPos) };
				if (stack.length > 0 && stack[stack.length-1] === pairs[word]) {
					stack = stack.substring(0, stack.length - 1);
					decorations[colorIndex(stack.length)].push(decoration);
					continue;
				} else {
					incorrect.push(decoration);
					continue;
				}
			}
		}
		for (var i=0; i<decorationTypes.length; ++i) {
		  activeEditor.setDecorations(decorationTypes[i], decorations[i]);
		}
		activeEditor.setDecorations(incorrectType, incorrect);
	}
}
