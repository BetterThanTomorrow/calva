import * as vscode from "vscode";
import { Scanner, ScannerState, Token } from "./clojure-lexer";

const scanner = new Scanner();

class ClojureSourceLine {
    tokens: Token[];
    endState: ScannerState;
    constructor(public text: string, public startState: ScannerState, lineNo: number) {
        this.tokens = scanner.processLine(text, lineNo, startState)
        this.endState = scanner.state;
    }

    get length() {
        return this.text.length;
    }
}

let debugValidation = false

/** A mutable cursor into the token stream. */
class TokenCursor {
    constructor(public doc: DocumentMirror, public line: number, public token: number) {
    }

    /** Create a copy of this cursor. */
    clone() {
        return new TokenCursor(this.doc, this.line, this.token);
    }

    set(cursor: TokenCursor) {
        this.doc = cursor.doc;
        this.line = cursor.line;
        this.token = cursor.token;
    }

    /** Return the position */
    get position() {
        return new vscode.Position(this.line, this.getToken().offset);
    }

    /** True if we are at the start of the document */
    atStart() {
        return this.token == 0 && this.line == 0;
    }

    /** True if we are at the end of the document */
    atEnd() {
        return this.line == this.doc.lines.length-1 && this.token == this.doc.lines[this.line].tokens.length-1;
    }

    /** Move this cursor backwards one token */
    previous() {
        if(this.token > 0) {
            this.token--;
        } else {
            if(this.line == 0) return;
            this.line--;
            this.token = this.doc.lines[this.line].tokens.length-1;
        }
        return this;
    }

    /** Move this cursor forwards one token */
    next() {
        if(this.token < this.doc.lines[this.line].tokens.length-1) {
            this.token++;
        } else {
            if(this.line == this.doc.lines.length-1) return;
            this.line++;
            this.token = 0;
        }
    }

    fowardString() {
        while(!this.atEnd()) {
            switch(this.getToken().type) {
                case "eol":
                case "str-inside":
                case "str-start":
                    this.next();
                    continue;
                default:
                    return;
            }
        }
    }

    forwardWhitespace() {
        while(!this.atEnd()) {
            switch(this.getToken().type) {
                case "eol":
                case "ws":
                case "comment":
                    this.next();
                    continue;
                default:
                    return;
            }
        }
    }

    backwardWhitespace() {
        while(!this.atStart()) {
            switch(this.getPrevToken().type) {
                case "eol":
                case "ws":
                case "comment":
                    this.previous();
                    continue;
                default:
                    return;
            }
        }
    }

    forwardSexp(): boolean {
        let delta = 0;
        this.forwardWhitespace();
        if(this.getToken().type == "close") {
            return false;
        }
        while(!this.atEnd()) {
            this.forwardWhitespace();
            let tk = this.getToken();
            switch(tk.type) {
                case 'id':
                case 'lit':
                case 'str':
                case 'str-end':
                    this.next();
                    if(delta <= 0)
                        return true;
                    break;
                case 'str-inside':
                case 'str-start':
                    do {
                        this.next();
                        tk = this.getToken();
                    } while(!this.atEnd() && (tk.type == "str-inside" || tk.type == "eol"))
                    continue;
                case 'close':
                    delta--;
                    this.next();
                    if(delta <= 0)
                        return true;
                    break;
                case 'open':
                    delta++;
                    this.next();
                    break;
                default:
                    this.next();
                    break;
            }
        }
    }

    backwardSexp() {
        let delta = 0;
        this.backwardWhitespace();
        switch(this.getPrevToken().type) {
            case "open":
                return false;
        }
        while(!this.atStart()) {
            this.backwardWhitespace();
            let tk = this.getPrevToken();
            switch(tk.type) {
                case 'id':
                case 'lit':
                case 'str':
                case 'str-start':
                    this.previous();
                    if(delta <= 0)
                        return true;
                    break;
                case 'str-inside':
                case 'str-end':
                    do {
                        this.previous();
                        tk = this.getPrevToken();
                    } while(!this.atStart() && tk.type == "str-inside")
                    continue;                    
                case 'close':
                    delta++;
                    this.previous();
                    break;
                case 'open':
                    delta--;
                    this.previous();
                    if(delta <= 0)
                        return true;
                    break;
                default:
                    this.previous();
            }
        }
    }

    forwardList(): boolean {
        let cursor = this.clone();
        while(cursor.forwardSexp()) {
            if(cursor.getPrevToken().type == "close") {
                this.set(cursor);
                return true;
            }
            this.next()
        }
        return false;
    }

    backwardList(): boolean {
        let cursor = this.clone();
        while(cursor.backwardSexp()) {
            if(cursor.getToken().type == "open") {
                this.set(cursor);
                return true;
            }
        }
        return false;
    }

    downList(): boolean {
        let cursor = this.clone();
        do {
            cursor.forwardWhitespace();
            if(cursor.getToken().type == "open") {
                cursor.next();
                this.set(cursor);
                return true;
            }
        } while(cursor.forwardSexp())
        return false;
    }

    upList(): boolean {
        let cursor = this.clone();
        do {
            cursor.forwardWhitespace();
            if(cursor.getToken().type == "close") {
                cursor.next();
                this.set(cursor);
                return true;
            }
        } while(cursor.forwardSexp())
        return false;
    }

    backwardUpList(): boolean {
        let cursor = this.clone();
        do {
            cursor.backwardWhitespace();
            if(cursor.getPrevToken().type == "open") {
                cursor.previous();
                this.set(cursor);
                return true;
            }
        } while(cursor.backwardSexp())
        return false;
    }

    getPrevToken(): Token {
        if(this.line == 0 && this.token == 0)
            return { type: "eol", raw: "\n", offset: 0, state: null };
        let cursor = this.clone();
        cursor.previous();
        return cursor.getToken();
    }

    getToken() {
        return this.doc.lines[this.line].tokens[this.token];
    }
}

function equal(x: any, y: any): boolean {
    if(x==y) return true;
    if(x instanceof Array && y instanceof Array) {
        if(x.length == y.length) {
            for(let i = 0; i<x.length; i++)
                if(!equal(x[i], y[i]))
                    return false;
            return true;
        } else
            return false;
    } else if (!(x instanceof Array) && !(y instanceof Array) && x instanceof Object && y instanceof Object) {
        for(let f in x)
            if(!equal(x[f], y[f]))
                return false;
        for(let f in y)
            if(!x.hasOwnProperty(f))
                return false
        return true;
    }
    return false;
}

class DocumentMirror {
    lines: ClojureSourceLine[] = [];
    scanner = new Scanner();

    dirtyLines: number[] = [];

    constructor(public doc: vscode.TextDocument) {
        scanner.state = this.getStateForLine(0);
        for(let i=0; i<doc.lineCount; i++) {
            let line = doc.lineAt(i);
            this.lines.push(new ClojureSourceLine(line.text, scanner.state, i));
        }
    }

    rescanAll() {
        scanner.state = this.getStateForLine(0);
        this.lines = [];
        let now = Date.now();
        for(let i=0; i<this.doc.lineCount; i++) {
            let line = this.doc.lineAt(i);
            this.lines.push(new ClojureSourceLine(line.text, scanner.state, i));
        }
        console.log("Rescanned document in "+(Date.now()-now)+"ms");
    }

    private markDirty(idx: number) {
        if(idx >= 0 && idx < this.lines.length)
        if(this.dirtyLines.indexOf(idx) == -1)
            this.dirtyLines.push(idx);
    }

    private removeDirty(start: number, end: number, inserted: number) {
        let delta = end-start + inserted;
        this.dirtyLines = this.dirtyLines.filter(x => x < start || x > end)
                                          .map(x => x > start ? x - delta : x);
    }
    
    private getStateForLine(line: number): ScannerState {
        return line == 0 ? { inString: false, } : { ... this.lines[line-1].endState };
    }

    public getTokenCursor(pos: vscode.Position, previous: boolean = false) {
        this.flushChanges();
        let line = this.lines[pos.line]
        let lastIndex = 0;
        if(line) {
            for(let i=0; i<line.tokens.length; i++) {
                let tk = line.tokens[i];
                if(previous ? tk.offset > pos.character : tk.offset > pos.character)
                    return new TokenCursor(this, pos.line, previous ? Math.max(0, lastIndex-1) : lastIndex);
                lastIndex = i;
            }
            return new TokenCursor(this, pos.line, line.tokens.length-1);
        }
    }

    private changeRange(e: vscode.TextDocumentContentChangeEvent) {
        // extract the lines we will replace
        let replaceLines = e.text.split(this.doc.eol == vscode.EndOfLine.LF ? /\n/ : /\r\n/);

        // the left side of the line unaffected by the edit.
        let left = this.lines[e.range.start.line].text.substr(0, e.range.start.character);

        // the right side of the line unaffected by the edit.
        let right = this.lines[e.range.end.line].text.substr(e.range.end.character);

        // we've nuked these lines, so update the dirty line array to correct the indices and delete affected ranges.
        this.removeDirty(e.range.start.line, e.range.end.line, replaceLines.length-1);

        let items: ClojureSourceLine[] = [];
        
        // initialize the lexer state - the first line is definitely not in a string, otherwise copy the
        // end state of the previous line before the edit
        let state = this.getStateForLine(e.range.start.line)

        if(replaceLines.length == 1) {
            // trivial single line edit
            items.push(new ClojureSourceLine(left + replaceLines[0] + right, state, e.range.start.line));
        } else {
            // multi line edit.
            items.push(new ClojureSourceLine(left + replaceLines[0], state, e.range.start.line));
            for(let i=1; i<replaceLines.length-1; i++)
                items.push(new ClojureSourceLine(replaceLines[i], scanner.state, e.range.start.line+i));
            items.push(new ClojureSourceLine(replaceLines[replaceLines.length-1] + right, scanner.state, e.range.start.line+replaceLines.length))
        }

        // now splice in our edited lines
        this.lines.splice(e.range.start.line, e.range.end.line-e.range.start.line+1, ...items);
        let nextIdx = e.range.start.line
        this.markDirty(nextIdx+1);
    }

    flushChanges() {
        if(!this.dirtyLines.length)
            return;
        let seen = new Set<number>();
        this.dirtyLines.sort();
        while(this.dirtyLines.length) {
            let nextIdx = this.dirtyLines.shift();
            if(seen.has(nextIdx))
                continue; // already processed.
            seen.add(nextIdx);
            let prevState = this.getStateForLine(nextIdx);
            let newLine: ClojureSourceLine;
            do {
                seen.add(nextIdx);
                newLine = new ClojureSourceLine(this.lines[nextIdx].text, prevState, nextIdx);
                prevState = newLine.endState;
                this.lines[nextIdx] = newLine;    
            } while(this.lines[++nextIdx] && !(equal(this.lines[nextIdx].startState, prevState)))
        }
    }

    processChanges(e: vscode.TextDocumentContentChangeEvent[]) {
        for(let change of e)
            this.changeRange(change);
        this.flushChanges();
        
        if(debugValidation && this.doc.getText() != this.text)
            vscode.window.showErrorMessage("DocumentMirror failed");
    }

    get text() {
        return this.lines.map(x => x.text).join(this.doc.eol == vscode.EndOfLine.LF ? "\n" : "\r\n");
    }
}

let documents = new Map<vscode.TextDocument, DocumentMirror>();

let registered = false;
export function activate() {
    // the last thing we want is to register twice and receive double events...
    if(registered)
        return;
    registered = true;

    vscode.workspace.onDidCloseTextDocument(e => {
        if(e.languageId == "clojure") {
            documents.delete(e);
        }
    })

    vscode.workspace.onDidChangeTextDocument(e => {
        if(e.document.languageId == "clojure") {
            if(!documents.get(e.document))
                documents.set(e.document, new DocumentMirror(e.document));
            else
                documents.get(e.document).processChanges(e.contentChanges)
        }
    })
}

export function getDocument(doc: vscode.TextDocument) {
    if(doc.languageId == "clojure") {
        if(!documents.get(doc))
            documents.set(doc, new DocumentMirror(doc));
        return documents.get(doc);
    }
}

/**
 * Temporary formatting commands
 * 
 * These won't live here.
 */
export function forwardSexp() {
    let textEditor = vscode.window.activeTextEditor;
    let cursor = getDocument(textEditor.document).getTokenCursor(textEditor.selection.start);
    cursor.forwardSexp();
    textEditor.selection = new vscode.Selection(cursor.position, cursor.position);
}

export function backwardSexp() {
    let textEditor = vscode.window.activeTextEditor;
    let cursor = getDocument(textEditor.document).getTokenCursor(textEditor.selection.start);
    cursor.backwardSexp();
    textEditor.selection = new vscode.Selection(cursor.position, cursor.position);    
}

export function forwardList() {
    let textEditor = vscode.window.activeTextEditor;
    let cursor = getDocument(textEditor.document).getTokenCursor(textEditor.selection.start);
    cursor.forwardList();
    textEditor.selection = new vscode.Selection(cursor.position, cursor.position);
}

export function backwardList() {
    let textEditor = vscode.window.activeTextEditor;
    let cursor = getDocument(textEditor.document).getTokenCursor(textEditor.selection.start);
    cursor.backwardList();
    textEditor.selection = new vscode.Selection(cursor.position, cursor.position);    
}

export function downList() {
    let textEditor = vscode.window.activeTextEditor;
    let cursor = getDocument(textEditor.document).getTokenCursor(textEditor.selection.start);
    cursor.downList();
    textEditor.selection = new vscode.Selection(cursor.position, cursor.position);    
}

export function upList() {
    let textEditor = vscode.window.activeTextEditor;
    let cursor = getDocument(textEditor.document).getTokenCursor(textEditor.selection.start);
    cursor.upList();
    textEditor.selection = new vscode.Selection(cursor.position, cursor.position);    
}

export function backwardUpList() {
    let textEditor = vscode.window.activeTextEditor;
    let cursor = getDocument(textEditor.document).getTokenCursor(textEditor.selection.start);
    cursor.backwardUpList();
    textEditor.selection = new vscode.Selection(cursor.position, cursor.position);    
}

const whitespace = new Set(["ws", "comment", "eol"])

type IndentRule = ["block", number] | ["inner", number] | ["inner", number, number];

let indentRules: { [id: string]: IndentRule[]} = {
    "alt!": [["block", 0]],
    "alt!!": [["block", 0]],
    "are": [["block", 2]] ,
    "as->": [["block", 2]],
    "binding": [["block", 1]],
    "bound-fn": [["inner", 1]],
    "case": [["block", 1]],
    "catch": [["block", 2]],
    "comment": [["block", 0]],
    "cond": [["block", 0]],
    "condp": [["block", 2]],
    "cond->": [["block", 1]],
    "cond->>": [["block", 1]],
    "def": [["inner", 0]],
    "defmacro": [["inner", 0]],
    "defmethod": [["inner", 0]],
    "defmulti": [["inner", 0]],
    "defn": [["inner", 0]],
    "defn-": [["inner", 0]],
    "defonce": [["inner", 0]],
    "defprotocol": [["block", 1], ["inner", 1]],
    "defrecord": [["block", 2], ["inner", 1]],
    "defstruct": [["block", 1]],
    "deftest": [["inner", 0]],
    "deftype": [["block", 2], ["inner", 1]],
    "do": [["block", 0]],
    "doseq": [["block", 1]],
    "dotimes": [["block", 1]],
    "doto": [["block", 1]],
    "extend": [["block", 1]],
    "extend-protocol": [["block", 1], ["inner", 1]],
    "extend-type": [["block", 1], ["inner", 1]],
    "fdef": [["inner", 0]],
    "finally": [["block", 0]],
    "fn": [["inner", 0]],
    "for": [["block", 1]],
    "future": [["block", 0]],
    "go": [["block", 0]],
    "go-loop": [["block", 1]],
    "if": [["block", 1]],
    "if-let": [["block", 1]],
    "if-not": [["block", 1]],
    "if-some": [["block", 1]],
    "let": [["block", 1]],
    "letfn": [["block", 1], ["inner", 2, 0]],
    "locking": [["block", 1]],
    "loop": [["block", 1]],
    "match": [["block", 1]],
    "ns": [["block", 1]],
    "proxy": [["block", 2], ["inner", 1]],
    "reify": [["inner", 0], ["inner", 1]],
    "struct-map": [["block", 1]],
    "testing": [["block", 1]],
    "thread": [["block", 0]],
    "try": [["block", 0]],
    "use-fixtures": [["inner", 0]],
    "when": [["block", 1]],
    "when-first": [["block", 1]],
    "when-let": [["block", 1]],
    "when-not": [["block", 1]],
    "when-some": [["block", 1]],
    "while": [["block", 1]],
    "with-local-vars": [["block", 1]],
    "with-open": [["block", 1]],
    "with-out-str": [["block", 0]],
    "with-precision": [["block", 1]],
    "with-redefs": [["block", 1]],
}

interface IndentState {
    first: string;
    startIndent: number;
    firstItemIdent: number;
    rules: IndentRule[];
    argPos: number;
    exprsOnLine: number;
}

// If a token's raw string is in this set, then it counts as an 'open list'. An open list is something that could be
// considered code, so special formatting rules apply.
let OPEN_LIST = new Set(["#(", "#?(", "(", "#?@("])

export function collectIndentState(document: vscode.TextDocument, position: vscode.Position, maxDepth: number = 3, maxLines: number = 20): IndentState[] {
    let cursor = getDocument(document).getTokenCursor(position);
    let argPos = 0;
    let startLine = cursor.line;
    let exprsOnLine = 0;
    let lastLine = cursor.line;
    let lastIndent = -1;
    let indents: IndentState[] = [];
    do {
        if(!cursor.backwardSexp()) {
            // this needs some work..
            let prevToken = cursor.getPrevToken();
            if(prevToken.type == 'open' && prevToken.offset <= 1) {
                maxDepth = 0; // treat an sexpr starting on line 0 sensibly.
            }
            // skip past the first item and record the indent of the first item on the same line if there is one.
            let nextCursor = cursor.clone();
            nextCursor.forwardSexp()
            nextCursor.forwardWhitespace();

            // iff the first item of this list is a an identifier, and the second item is on the same line, indent to that second item. otherwise indent to the open paren.
            let firstItemIdent = cursor.getToken().type == "id" && nextCursor.line == cursor.line && OPEN_LIST.has(prevToken.raw) ? nextCursor.position.character : cursor.position.character;


            let token = cursor.getToken().raw;
            let startIndent = cursor.position.character;
            if(!cursor.backwardUpList())
                break;
            let indentRule = indentRules[token] || [];
            indents.unshift({ first: token, rules: indentRule, argPos, exprsOnLine, startIndent, firstItemIdent });
            argPos = 0;
            exprsOnLine = 1;
        }
        if(!whitespace.has(cursor.getPrevToken().raw)) {
            argPos++;
            exprsOnLine++;
        }

        if(cursor.line != lastLine) {
            let head = cursor.clone();
            head.forwardSexp();
            head.forwardWhitespace();
            lastIndent = head.position.character;
            exprsOnLine = 0;
            lastLine = cursor.line;
        }
    } while(!cursor.atEnd() && Math.abs(startLine-cursor.line) < maxLines && indents.length < maxDepth);
    if(!indents.length)
        indents.push({argPos: 0, first: null, rules: [], exprsOnLine: 0, startIndent: lastIndent >= 0 ? lastIndent : 0, firstItemIdent: lastIndent >= 0 ? lastIndent : 0})
    return indents;
}

/** Returns [argumentPosition, startOfList] */
export function getIndent(document: vscode.TextDocument, position: vscode.Position): number {
    let state = collectIndentState(document, position);
    // now find applicable indent rules
    let indent = -1;
    let thisBlock = state[state.length-1];
    if(!state.length)
        return 0;
    
    for(let pos = state.length-1; pos >= 0; pos--) {
        for(let rule of state[pos].rules) {
            if(rule[0] == "inner") {
                if(pos + rule[1] == state.length-1) {
                    if(rule.length == 3) {
                        if(rule[2] > thisBlock.argPos)
                            indent = thisBlock.startIndent + 1;
                    } else
                        indent = thisBlock.startIndent + 1;
                }
            } else if(rule[0] == "block" && pos == state.length-1) {
                if(thisBlock.exprsOnLine <= rule[1]) {
                    if(thisBlock.argPos > rule[1])
                        indent = thisBlock.startIndent + 1
                } else {
                    indent = thisBlock.firstItemIdent;
                }
            }
        }
    }

    if(indent == -1) {
        // no indentation styles applied, so use default style.
        if(thisBlock.exprsOnLine > 0)
            indent = thisBlock.firstItemIdent;
        else
            indent = thisBlock.startIndent
    }
    return indent;
}