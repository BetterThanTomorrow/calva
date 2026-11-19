import * as model from '../cursor-doc/model';
import type { Token } from '../cursor-doc/clojure-lexer';
import { insertBreakpointForms, type BreakpointInsertion } from './breakpoint-encoding';

/** A gutter breakpoint as data: zero-based line and character in its document. */
export type SourceBreakpointData = {
  line: number;
  character: number;
  enabled?: boolean;
  condition?: string;
  logMessage?: string;
  /** Calva doesn't support hit counts, and ignores this. */
  hitCondition?: string;
};

export type CodeWithBreakpointsInput = {
  /** The text of the document the code is picked from. */
  documentText: string;
  /** The document offset where `code` starts. */
  codeStart: number;
  code: string;
  breakpoints: readonly SourceBreakpointData[];
};

type FormKind = 'list' | 'vector' | 'map' | 'symbol' | 'string' | 'other';

type Form = {
  start: number;
  end: number;
  kind: FormKind;
  raw: string;
  parent?: Form;
  /** Position among the parent's forms. Metadata and `#_` forms have none. */
  index?: number;
  children: Form[];
  isOpener: boolean;
  /** Quoted or metadata, so no form in it is evaluated. */
  isInert: boolean;
  isTagged: boolean;
  /** Where the `#_` that ignores this form is. */
  ignoredAt?: number;
};

type SourceIndex = {
  forms: Form[];
  lineStarts: number[];
  lineTexts: string[];
  comments: [number, number][];
};

/** What the forms that follow get: `#_` ignores them, a reader tag tags the next one. */
type Pending = { ignores: number; ignoreStart: number; isTagged: boolean };

type PendingIgnores = Pick<Pending, 'ignores' | 'ignoreStart'>;

/** `stack` holds the open forms, `outerIgnores` the pending ignores outside each of them. */
type IndexBuilder = {
  index: SourceIndex;
  stack: Form[];
  outerIgnores: PendingIgnores[];
  pending: Pending;
};

const TARGET_KINDS = new Set<FormKind>(['list', 'vector', 'map', 'symbol']);
const OPENER_KINDS: Record<string, FormKind> = {
  '(': 'list',
  '[': 'vector',
  '{': 'map',
};
const BINDING_HEADS = new Set([
  'let',
  'loop',
  'binding',
  'with-open',
  'with-redefs',
  'with-local-vars',
  'when-let',
  'if-let',
  'when-some',
  'if-some',
  'when-first',
  'dotimes',
  'doseq',
  'for',
]);
const METHOD_HOSTS = new Set([
  'reify',
  'deftype',
  'defrecord',
  'extend-type',
  'extend-protocol',
  'proxy',
  'defprotocol',
  'definterface',
]);
const BODY_INDEX = new Map([
  ['catch', 3],
  ['finally', 1],
]);
const PARAMS_INDEX = new Map<string, (form: Form) => number>([
  ['fn', (form) => (form.children[1]?.kind === 'symbol' ? 2 : 1)],
  ['defn', defnParamsIndex],
  ['defn-', defnParamsIndex],
  ['defmethod', () => 3],
]);

// Indexing the forms of a document

function newForm(start: number, raw: string, kind: FormKind, parent?: Form): Form {
  return {
    start,
    end: start + raw.length,
    kind,
    raw,
    parent,
    children: [],
    isOpener: false,
    isInert: Boolean(parent?.isInert) || /^['`^]/.test(raw),
    isTagged: false,
  };
}

function openerKind(token: Token): FormKind {
  return token.raw.endsWith('"') ? 'string' : OPENER_KINDS[token.raw] ?? 'other';
}

function atomKind(token: Token): FormKind {
  return token.type === 'id' && /^[^'`~#^]/.test(token.raw) ? 'symbol' : 'other';
}

function placeForm(form: Form, pending: Pending): void {
  const parent = form.parent;
  if (form.raw.startsWith('^')) {
    form.isInert = true;
    return;
  }
  form.isTagged = pending.isTagged;
  pending.isTagged = false;
  if (pending.ignores > 0) {
    pending.ignores--;
    form.ignoredAt = pending.ignoreStart;
    return;
  }
  form.index = parent.children.length;
  parent.children.push(form);
}

function openForm(builder: IndexBuilder): Form {
  return builder.stack[builder.stack.length - 1];
}

function addForm(builder: IndexBuilder, token: Token, offset: number): void {
  const isOpener = token.type === 'open';
  const kind = isOpener ? openerKind(token) : atomKind(token);
  const form = newForm(offset, token.raw, kind, openForm(builder));
  form.isOpener = isOpener;
  placeForm(form, builder.pending);
  builder.index.forms.push(form);
  if (isOpener) {
    const { ignores, ignoreStart } = builder.pending;
    builder.stack.push(form);
    builder.outerIgnores.push({ ignores, ignoreStart });
    builder.pending.ignores = 0;
  }
}

function closeForm(builder: IndexBuilder, offset: number): void {
  if (builder.stack.length > 1) {
    builder.stack.pop().end = offset + 1;
    Object.assign(builder.pending, builder.outerIgnores.pop());
  }
}

function addStringToken(builder: IndexBuilder, token: Token, offset: number): void {
  if (token.type === 'close') {
    closeForm(builder, offset);
  }
}

type TokenHandler = (builder: IndexBuilder, token: Token, offset: number) => void;

const skipToken: TokenHandler = () => undefined;

/** Token types that aren't forms. Any other token is one. */
const NON_FORM_TOKENS: Record<string, TokenHandler> = {
  ws: skipToken,
  eol: skipToken,
  prompt: skipToken,
  comment: (builder, token, offset) => {
    builder.index.comments.push([offset, offset + token.raw.length]);
  },
  ignore: (builder, _token, offset) => {
    if (builder.pending.ignores === 0) {
      builder.pending.ignoreStart = offset;
    }
    builder.pending.ignores++;
  },
  reader: (builder) => {
    builder.pending.isTagged = true;
  },
  close: (builder, _token, offset) => closeForm(builder, offset),
};

function addToken(builder: IndexBuilder, token: Token, offset: number): void {
  const handler =
    openForm(builder).kind === 'string' ? addStringToken : NON_FORM_TOKENS[token.type] ?? addForm;
  handler(builder, token, offset);
}

function indexSource(text: string): SourceIndex {
  const lineModel = new model.LineInputModel(model.getFirstEol(text)?.length ?? 1);
  lineModel.insertString(0, text);
  const root = newForm(0, '', 'other');
  root.end = text.length;
  const builder: IndexBuilder = {
    index: { forms: [], lineStarts: [], lineTexts: [], comments: [] },
    stack: [root],
    outerIgnores: [],
    pending: { ignores: 0, ignoreStart: 0, isTagged: false },
  };
  let lineStart = 0;
  for (const line of lineModel.lines) {
    builder.index.lineStarts.push(lineStart);
    builder.index.lineTexts.push(line.text);
    for (const token of line.tokens) {
      addToken(builder, token, lineStart + token.offset);
    }
    lineStart += line.text.length + lineModel.lineEndingLength;
  }
  return builder.index;
}

// What the forms are

function headName(form: Form | undefined): string | undefined {
  const head = form?.children[0];
  return form?.kind === 'list' && head?.kind === 'symbol' ? head.raw : undefined;
}

function defnParamsIndex(form: Form): number {
  let index = 2;
  if (form.children[index]?.kind === 'string') {
    index++;
  }
  if (form.children[index]?.kind === 'map') {
    index++;
  }
  return index;
}

function isLetfnVector(form: Form): boolean {
  return form.kind === 'vector' && form.index === 1 && headName(form.parent) === 'letfn';
}

/** A function spec in `letfn`, or a method in `reify`, `deftype` and the like. */
function isMethodSpec(form: Form): boolean {
  const parent = form.parent;
  return (
    form.children[0]?.kind === 'symbol' &&
    parent !== undefined &&
    (isLetfnVector(parent) || METHOD_HOSTS.has(headName(parent)))
  );
}

/** One arity, `([x] body)`, of a multi-arity function. */
function isArity(form: Form): boolean {
  const paramsAt = form.parent ? paramsIndex(form.parent) : undefined;
  return (
    paramsAt !== undefined &&
    form.parent.children[paramsAt]?.kind === 'list' &&
    form.index >= paramsAt
  );
}

/** Where a function's argument vector, or its first arity, is. */
function paramsIndex(form: Form): number | undefined {
  if (form.kind !== 'list') {
    return undefined;
  }
  if (isMethodSpec(form)) {
    return 1;
  }
  if (isArity(form)) {
    return 0;
  }
  return PARAMS_INDEX.get(headName(form))?.(form);
}

function holdsBody(form: Form): boolean {
  return paramsIndex(form) !== undefined || BODY_INDEX.has(headName(form));
}

/** A `{:pre … :post …}` map right after the argument vector, with more body after it. */
function isConditionMap(form: Form): boolean {
  const parent = form.parent;
  return (
    form.kind === 'map' &&
    parent?.children[form.index + 1] !== undefined &&
    parent.children[form.index - 1]?.kind === 'vector' &&
    paramsIndex(parent) === form.index - 1
  );
}

function firstBodyForm(form: Form): Form | undefined {
  const paramsAt = paramsIndex(form);
  if (paramsAt === undefined) {
    return form.children[BODY_INDEX.get(headName(form))];
  }
  const signature = form.children[paramsAt];
  if (signature?.kind === 'list') {
    return firstBodyForm(signature);
  }
  const first = form.children[paramsAt + 1];
  return first && isConditionMap(first) ? form.children[paramsAt + 2] : first;
}

function isArgVector(form: Form): boolean {
  return (
    form.kind === 'vector' && form.parent !== undefined && paramsIndex(form.parent) === form.index
  );
}

function isBindingVector(form: Form): boolean {
  if (form.kind !== 'vector' || !form.parent) {
    return false;
  }
  if (form.index === 1 && BINDING_HEADS.has(headName(form.parent))) {
    return true;
  }
  return form.parent.children[form.index - 1]?.raw === ':let' && isBindingVector(form.parent);
}

function isBindingName(form: Form): boolean {
  return Boolean(form.parent) && isBindingVector(form.parent) && form.index % 2 === 0;
}

function isHeadSymbol(form: Form): boolean {
  return form.kind === 'symbol' && form.index === 0 && form.parent.kind === 'list';
}

function canCarryBreak(form: Form): boolean {
  return TARGET_KINDS.has(form.kind) && !form.isTagged && !form.isInert;
}

function isSyntax(form: Form): boolean {
  return isHeadSymbol(form) || isBindingVector(form) || isLetfnVector(form);
}

/** Forms cider-nrepl's debugger never stops at. */
function isNeverStopped(form: Form): boolean {
  return headName(form) === 'recur' || isConditionMap(form);
}

function isInBindingNameOrArgs(form: Form): boolean {
  for (let current = form; current; current = current.parent) {
    if (isBindingName(current) || isArgVector(current)) {
      return true;
    }
  }
  return false;
}

function isTarget(form: Form): boolean {
  return (
    canCarryBreak(form) && !isSyntax(form) && !isNeverStopped(form) && !isInBindingNameOrArgs(form)
  );
}

/**
 * The form a `#break` goes before for `form`: the form itself, or for a function
 * definition, an arity, `catch` and `finally`, the first form of the body.
 */
function resolveTarget(form: Form | undefined): Form | undefined {
  if (!form) {
    return undefined;
  }
  if (holdsBody(form)) {
    return resolveTarget(firstBodyForm(form));
  }
  if (isArgVector(form)) {
    return resolveTarget(firstBodyForm(form.parent));
  }
  return isTarget(form) ? form : undefined;
}

// Where breakpoints land

function lineEnd(index: SourceIndex, line: number): number {
  return index.lineStarts[line] + index.lineTexts[line].length;
}

function formsStartingOnLine(index: SourceIndex, line: number): Form[] {
  const start = index.lineStarts[line];
  const end = lineEnd(index, line);
  return index.forms.filter((form) => form.start >= start && form.start < end);
}

/** The last list starting on the line that has a target, else the first other form that has one. */
function lineTarget(index: SourceIndex, line: number): Form | undefined {
  const forms = formsStartingOnLine(index, line);
  const listTargets = forms.filter((form) => form.kind === 'list').map(resolveTarget);
  return listTargets.filter(Boolean).pop() ?? forms.map(resolveTarget).find(Boolean);
}

function isInsideStringOrComment(index: SourceIndex, offset: number): boolean {
  const inString = index.forms.some(
    (form) => form.kind === 'string' && form.start < offset && offset < form.end
  );
  return inString || index.comments.some(([start, end]) => start <= offset && offset < end);
}

function innermostOpenerAround(index: SourceIndex, offset: number): Form | undefined {
  return index.forms
    .filter((form) => form.isOpener && form.start < offset && offset < form.end)
    .pop();
}

/** The form opening at the offset, else the closest enclosing form, that has a target. */
function inlineTarget(index: SourceIndex, offset: number): Form | undefined {
  if (isInsideStringOrComment(index, offset)) {
    return undefined;
  }
  const openedHere = index.forms.find((form) => form.isOpener && form.start === offset);
  for (let form = openedHere ?? innermostOpenerAround(index, offset); form; form = form.parent) {
    const target = resolveTarget(form);
    if (target) {
      return target;
    }
  }
  return undefined;
}

function firstNonWhitespace(lineText: string): number {
  const match = lineText.search(/\S/);
  return match === -1 ? lineText.length : match;
}

function breakpointTarget(
  index: SourceIndex,
  { line, character }: { line: number; character: number }
): Form | undefined {
  const lineText = index.lineTexts[line];
  if (lineText === undefined) {
    return undefined;
  }
  return character <= firstNonWhitespace(lineText)
    ? lineTarget(index, line)
    : inlineTarget(index, index.lineStarts[line] + character);
}

// Inserting `#break`

function isActive(breakpoint: SourceBreakpointData): boolean {
  return breakpoint.enabled !== false && !breakpoint.logMessage;
}

function conditionOf(breakpoint: SourceBreakpointData): string | undefined {
  return breakpoint.condition?.trim() || undefined;
}

function isInCode(
  form: Form,
  { documentText, codeStart, code }: CodeWithBreakpointsInput
): boolean {
  const start = form.start - codeStart;
  const end = form.end - codeStart;
  return (
    start >= 0 &&
    end <= code.length &&
    code.slice(start, end) === documentText.slice(form.start, form.end)
  );
}

/** Ignored by a `#_` in the code. A `#_` before the code, stripped when it was picked, doesn't count. */
function isIgnoredInCode(form: Form, codeStart: number): boolean {
  for (let current = form; current; current = current.parent) {
    if ((current.ignoredAt ?? -1) >= codeStart) {
      return true;
    }
  }
  return false;
}

function isLiveInCode(form: Form, input: CodeWithBreakpointsInput): boolean {
  return isInCode(form, input) && !isIgnoredInCode(form, input.codeStart);
}

/** Where `#break` goes in the code, and with which condition, for the breakpoints whose targets are in it. */
export function breakpointInsertions(input: CodeWithBreakpointsInput): BreakpointInsertion[] {
  const active = input.breakpoints.filter(isActive);
  if (active.length === 0) {
    return [];
  }
  const index = indexSource(input.documentText);
  const targeted = new Set<Form>();
  return active.flatMap((breakpoint) => {
    const target = breakpointTarget(index, breakpoint);
    const isNewTarget = target !== undefined && !targeted.has(target);
    if (!isNewTarget || !isLiveInCode(target, input)) {
      return [];
    }
    targeted.add(target);
    return [{ offset: target.start - input.codeStart, condition: conditionOf(breakpoint) }];
  });
}

/**
 * The code to send for an evaluation: `code` with `#break` before each breakpoint's
 * target when the session can debug, otherwise `code` as it is.
 */
export function codeWithBreakpoints(
  input: CodeWithBreakpointsInput & { canDebug: boolean }
): string {
  return input.canDebug
    ? insertBreakpointForms(input.code, breakpointInsertions(input))
    : input.code;
}
