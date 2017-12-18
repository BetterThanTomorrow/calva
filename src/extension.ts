import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	const decorationTypes = [
    "#000",
    "#BF4640",
    "#BF7140",
    "#BF9B40",
    "#B9BF40",
    "#8EBF40",
    "#64BF40",
    "#40BF46",
    "#40BF71",
    "#40BF9B",
    "#40B9BF",
    "#408EBF"
  ].map(color => vscode.window.createTextEditorDecorationType({color: color}));

	const incorrectType = vscode.window.createTextEditorDecorationType({
		color: "#fff",
		backgroundColor: "rgba(204,51,51,1)"
	});

	const pairs = { ")": "(", "]": "[", "}": "{"};

	let activeEditor = vscode.window.activeTextEditor;

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
		const regexp = /(\[|\]|\(|\)|\{|\}|\"|\\.|\;|\n)/g,
		      text   = activeEditor.document.getText(),
		      decorations: vscode.DecorationOptions[][] = decorationTypes.map(()=>[]),
		      incorrect: vscode.DecorationOptions[] = [];
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
				decorations[stack.length % decorationTypes.length].push(decoration);
				stack += word;
				continue;
			} else if (word === ")" || word === "]" || word === "}") {
				const startPos   = activeEditor.document.positionAt(match.index),
				      endPos     = startPos.translate(0,1),
							decoration = { range: new vscode.Range(startPos, endPos) };
				if (stack.length > 0 && stack[stack.length-1] === pairs[word]) {
					stack = stack.substring(0, stack.length - 1);
					decorations[stack.length % decorationTypes.length].push(decoration);
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
