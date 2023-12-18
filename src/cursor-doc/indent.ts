import { EditableModel } from './model';
import * as _ from 'lodash';
import * as regexUtil from '../util/regex';
import { FormatterConfig } from '../formatter-config';
import * as cljsLib from '../../out/cljs-lib/cljs-lib.js';
import { escapeStringRegexp } from '../util/string';

const whitespace = new Set(['ws', 'comment', 'eol']);

export type IndentRule = ['block', number] | ['inner', number] | ['inner', number, number];

export type IndentRules = {
  [id: string]: IndentRule[];
};

const indentRules: IndentRules = {
  '#"^\\w"': [['inner', 0]],
};

/**
 * The information about an enclosing s-expr, returned by collectIndents
 */
export interface IndentInformation {
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
 * Analyses the text before position in the document, and returns a list of enclosing expression information with
 * various indent information, for use with getIndent()
 *
 * @param document The document to analyse
 * @param position The position (as [row, col] into the document to analyse from)
 * @param maxDepth The maximum depth upwards from the expression to search.
 * @param maxLines The maximum number of lines above the position to search until we bail with an imprecise answer.
 */
export function collectIndents(
  document: EditableModel,
  offset: number,
  config: FormatterConfig,
  maxDepth: number = 3,
  maxLines: number = 20
): IndentInformation[] {
  const cursor = document.getTokenCursor(offset);
  cursor.backwardWhitespace();
  let argPos = 0;
  const startLine = cursor.line;
  let exprsOnLine = 0;
  let lastLine = cursor.line;
  let lastIndent = 0;
  const indents: IndentInformation[] = [];
  const replaceIndents = config['cljfmt-options']['indents'];
  const defaultIndents = cljsLib.defaultIndents();
  const extraIndents = config['cljfmt-options']['extra-indents'];
  const baseRules = replaceIndents
    ? Object.keys(replaceIndents).map((k) => [k, replaceIndents[k]])
    : Object.keys(defaultIndents).map((k) => [k, defaultIndents[k]]);
  const extraRules = extraIndents ? Object.keys(extraIndents).map((k) => [k, extraIndents[k]]) : [];

  const combinedRules = [...extraRules, ...baseRules].sort((a, b) => {
    const aIsRegex = regexUtil.isCljOrJsRegex(a[0]);
    const bIsRegex = regexUtil.isCljOrJsRegex(b[0]);

    if (aIsRegex && !bIsRegex) {
      return 1;
    } else if (!aIsRegex && bIsRegex) {
      return -1;
    } else {
      return 0;
    }
  });

  do {
    if (!cursor.backwardSexp()) {
      // this needs some work..
      const prevToken = cursor.getPrevToken();
      if (prevToken.type == 'open' && prevToken.offset <= 1) {
        maxDepth = 0; // treat an sexpr starting on line 0 sensibly.
      }
      // skip past the first item and record the indent of the first item on the same line if there is one.
      const nextCursor = cursor.clone();
      nextCursor.forwardSexp();
      nextCursor.forwardWhitespace();

      // if the first item of this list is a a function, and the second item is on the same line, indent to that second item. otherwise indent to the open paren.
      const isList = prevToken.type === 'open' && prevToken.raw.endsWith('(');
      const firstItemIdent =
        ['id', 'kw'].includes(cursor.getToken().type) &&
        nextCursor.line == cursor.line &&
        !nextCursor.atEnd() &&
        isList
          ? nextCursor.rowCol[1]
          : cursor.rowCol[1];

      const token = cursor.getToken().raw;
      const startIndent = cursor.rowCol[1];
      if (!cursor.backwardUpList()) {
        break;
      }

      const pattern =
        isList &&
        _.find(
          combinedRules,
          (rule) =>
            regexUtil.testCljOrJsRegex(`#"^(.*/)?${[escapeStringRegexp(rule[0])]}$"`, token) ||
            (regexUtil.isCljOrJsRegex(rule[0]) && regexUtil.testCljOrJsRegex(rule[0], token))
        );

      const indentRule = pattern ? pattern[1] : [];
      indents.unshift({
        first: token,
        rules: indentRule,
        argPos,
        exprsOnLine,
        startIndent,
        firstItemIdent,
      });
      argPos = 0;
      exprsOnLine = 1;
    }

    if (cursor.line != lastLine) {
      const head = cursor.clone();
      head.forwardSexp();
      head.forwardWhitespace();
      if (!head.atEnd()) {
        lastIndent = head.rowCol[1];
        exprsOnLine = 0;
        lastLine = cursor.line;
      }
    }

    if (whitespace.has(cursor.getPrevToken().type)) {
      argPos++;
      exprsOnLine++;
    }
  } while (
    !cursor.atStart() &&
    Math.abs(startLine - cursor.line) < maxLines &&
    indents.length < maxDepth
  );
  if (!indents.length) {
    indents.push({
      argPos: 0,
      first: null,
      rules: [],
      exprsOnLine: 0,
      startIndent: lastIndent >= 0 ? lastIndent : 0,
      firstItemIdent: lastIndent >= 0 ? lastIndent : 0,
    });
  }
  return indents;
}

const calculateDefaultIndent = (indentInfo: IndentInformation) =>
  indentInfo.exprsOnLine > 0 ? indentInfo.firstItemIdent : indentInfo.startIndent;

const calculateInnerIndent = (
  currentIndent: number,
  rule: IndentRule,
  indentInfo: IndentInformation
) => {
  if (rule.length !== 3 || rule[2] > indentInfo.argPos) {
    return indentInfo.startIndent + 1;
  }

  return currentIndent;
};

const calculateBlockIndent = (
  currentIndent: number,
  rule: IndentRule,
  indentInfo: IndentInformation
) => {
  if (indentInfo.exprsOnLine > rule[1]) {
    return indentInfo.firstItemIdent;
  }

  if (indentInfo.argPos >= rule[1]) {
    return indentInfo.startIndent + 1;
  }

  return currentIndent;
};

const calculateIndent = (
  currentIndent: number,
  rule: IndentRule,
  indentInfo: IndentInformation,
  stateSize: number,
  pos: number
) => {
  if (rule[0] === 'inner' && pos + rule[1] === stateSize) {
    return calculateInnerIndent(currentIndent, rule, indentInfo);
  }

  if (rule[0] === 'block' && pos === stateSize) {
    return calculateBlockIndent(currentIndent, rule, indentInfo);
  }

  return currentIndent;
};

/** Returns the expected newline indent for the given position, in characters. */
export function getIndent(
  document: EditableModel,
  offset: number,
  config: FormatterConfig = {
    'cljfmt-options': {
      indents: indentRules,
    },
  }
): number {
  const state = collectIndents(document, offset, config);
  if (!state.length) {
    return 0;
  }

  // now find applicable indent rules
  let indent = -1;
  const stateSize = state.length - 1;
  const thisBlock = state.at(-1);
  for (let pos = stateSize; pos >= 0; pos--) {
    indent = state[pos].rules.reduce(
      (currentIndent, rule) => calculateIndent(currentIndent, rule, thisBlock, stateSize, pos),
      indent
    );
  }

  if (indent == -1) {
    return calculateDefaultIndent(thisBlock);
  }

  return indent;
}
