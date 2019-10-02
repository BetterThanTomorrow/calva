import { LineInputModel } from "./model";

const whitespace = new Set(["ws", "comment", "eol"])

type IndentRule = ["block", number] | ["inner", number] | ["inner", number, number];

/** Rules shamelessly copied from cljfmt. */
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

/**
 * The information about an enclosing s-expr, returned by collectIndents
 */
interface IndentInformation {
    /** The first token in the expression (after the open paren/bracket etc.), as a raw string */
    first: string;
    
    /** The indent immediately after the open paren/bracket etc */
    startIndent: number;

    /** If there is a second token on the same line as the first token, the indent for that token */
    firstItemIdent: number;

    /** The applicable indent rules for this IndentInformation, local only. */
    rules: IndentRule[];

    /** The index at which the cursor (or the sexpr containing the cursor at this level) is in the expression. */
    argPos: number;

    /** The number of expressions on the first line of this expression. */
    exprsOnLine: number;
}

/**
 * If a token's raw string is in this set, then it counts as an 'open list'. An open list that starts with a symbol
 * is something that could be
 * considered code, so special formatting rules apply.
 */
const OPEN_LIST = new Set(["#(", "#?(", "(", "#?@("])

/**
 * Analyses the text before position in the document, and returns a list of enclosing expression information with
 * various indent information, for use with getIndent()
 * 
 * @param document The document to analyse
 * @param position The position (as [row, col] into the document to analyse from)
 * @param maxDepth The maximum depth upwards from the expression to search.
 * @param maxLines The maximum number of lines above the position to search until we bail with an imprecise answer.
 */
export function collectIndents(document: LineInputModel, offset: number, maxDepth: number = 3, maxLines: number = 20): IndentInformation[] {
    let cursor = document.getTokenCursor(offset);
    cursor.backwardWhitespace();
    let argPos = 0;
    let startLine = cursor.line;
    let exprsOnLine = 0;
    let lastLine = cursor.line;
    let lastIndent = 0;
    let indents: IndentInformation[] = [];
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
            let firstItemIdent = cursor.getToken().type == "id" && nextCursor.line == cursor.line && !nextCursor.atEnd() && OPEN_LIST.has(prevToken.raw) ? nextCursor.rowCol[1] : cursor.rowCol[1];


            let token = cursor.getToken().raw;
            let startIndent = cursor.rowCol[1];
            if(!cursor.backwardUpList())
                break;
            let indentRule = indentRules[token] || [];
            indents.unshift({ first: token, rules: indentRule, argPos, exprsOnLine, startIndent, firstItemIdent });
            argPos = 0;
            exprsOnLine = 1;
        }

        if(cursor.line != lastLine) {
            let head = cursor.clone();
            head.forwardSexp();
            head.forwardWhitespace();
            if(!head.atEnd()) {
                lastIndent = head.rowCol[1];
                exprsOnLine = 0;
                lastLine = cursor.line;
            }
        }

        if(whitespace.has(cursor.getPrevToken().type)) {
            argPos++;
            exprsOnLine++;
        }
    } while(!cursor.atStart() && Math.abs(startLine-cursor.line) < maxLines && indents.length < maxDepth);
    if(!indents.length)
        indents.push({argPos: 0, first: null, rules: [], exprsOnLine: 0, startIndent: lastIndent >= 0 ? lastIndent : 0, firstItemIdent: lastIndent >= 0 ? lastIndent : 0})
    return indents;
}

/** Returns the expected newline indent for the given position, in characters. */
export function getIndent(document: LineInputModel, offset: number): number {
    let state = collectIndents(document, offset);
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
                    if(thisBlock.argPos >= rule[1])
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