const vscode = require('vscode');
const state = require('../state');
const status = require('../status');

// Adapted from the Atom clojure-indent extension: https://github.com/Ciebiada/clojure-indent

const oneIndentForms = ['fn', 'def', 'defn', 'ns', 'let', 'for', 'loop',
    'when', 'when-let', 'if', 'if-let', 'if-not', 'when-not', 'cond', 'do',
    'doseq', 'dotimes'
]

function calculateIndent(lines) {
    let x = 0,
        y = 0,
        openBrackets = [];

    while (true) {
        const char = lines[y][x];

        if (char === '(') {
            const first = lines[y].slice(x + 1).split(' ')[0]

            openBrackets.push(
                oneIndentForms.includes(first)
                    ? (x + 2)
                    : (x + first.length + 2)
            );
        }

        if (char === '[' || char === '{') {
            openBrackets.push(x + 1)
        }

        if (char === ')' || char === ']' || char === '}') {
            openBrackets.pop()
        }

        x++

        if (x >= lines[y].length) {
            x = 0
            y++
            if (y >= lines.length) {
                break
            }
        }
    }

    return openBrackets.length
        ? openBrackets[openBrackets.length - 1]
        : 0
}


class ClojureOnTypeFormattingEditProvider {
    constructor() {
        this.state = state;
    }

    static toggleAutoAdjustIndentCommand() {
        state.cursor.set("autoAdjustIndent", !state.deref().get("autoAdjustIndent"));
        status.update();
    }

    provideOnTypeFormattingEdits(document, position, ch, options) {
        if (this.state.deref().get("autoAdjustIndent")) {
            let rangeUptoHere = new vscode.Range(new vscode.Position(0, 0), position),
                lines = document.getText(rangeUptoHere).split('\n'),
                indent = calculateIndent(lines),
                startPosition = position.with(position.line, 0),
                endPosition = position;

            if (endPosition.character != indent) {
                if (endPosition.character > indent) {
                    return [vscode.TextEdit.delete(new vscode.Range(endPosition.with(endPosition.line, indent), endPosition))];
                } else {
                    return [vscode.TextEdit.insert(startPosition, ' '.repeat(indent - endPosition.character))];
                }
            } else {
                return null;
            }
        } else {
            return null;
        }
    }
}

module.exports = ClojureOnTypeFormattingEditProvider;
