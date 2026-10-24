import * as expectLib from 'expect';
import * as fs from 'fs';
import * as path from 'path';

const expect = expectLib.expect;

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8')
);
const keybindings: { command: string; key?: string; mac?: string; when?: string }[] =
  manifest.contributes.keybindings;
const commands: { command: string; enablement?: string }[] = manifest.contributes.commands;

const REPL_INPUT_FOCUSED = 'calva:replInputFocused';
const EDITOR_CLAUSE = 'editorLangId == clojure && editorTextFocus';
const REPL_INPUT_CLAUSE = `(${EDITOR_CLAUSE} || ${REPL_INPUT_FOCUSED})`;
const EDITOR_ENABLEMENT = 'editorLangId == clojure';
const REPL_INPUT_ENABLEMENT = `${EDITOR_ENABLEMENT} || ${REPL_INPUT_FOCUSED}`;

const NAMED_EDITING_COMMANDS = [
  'calva.toggleLineComment',
  'calva-fmt.tabDedent',
  'calva.selectCurrentForm',
];
const PAREDIT_COMMANDS_LEFT_AS_THEY_ARE = [
  'paredit.togglemode',
  'paredit.addRichComment',
  'paredit.deleteForward',
  'paredit.deleteBackward',
  'paredit.forceDeleteForward',
  'paredit.forceDeleteBackward',
];

const isReplInputCommand = (command: string) => command.startsWith('calva.replInput.');

function isEditingCommand(command: string) {
  return (
    NAMED_EDITING_COMMANDS.includes(command) ||
    (command.startsWith('paredit.') && !PAREDIT_COMMANDS_LEFT_AS_THEY_ARE.includes(command))
  );
}

type WhenExpr =
  | { op: 'atom'; name: string }
  | { op: 'not'; arg: WhenExpr }
  | { op: 'and' | 'or'; args: WhenExpr[] };

const TOKEN =
  /\s*(\(|\)|&&|\|\||!(?!=)|[^\s()!&|=]+(?:\s*(?:==|!=)\s*(?:'[^']*'|[^\s()&|]+)|\s*=~\s*\/(?:\\.|[^/\\])*\/[a-z]*)?)/y;

function tokenize(clause: string): string[] {
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < clause.trimEnd().length) {
    const match = TOKEN.exec(clause);
    if (!match) {
      throw new Error(`Can't tokenize at ${TOKEN.lastIndex}: ${clause}`);
    }
    tokens.push(match[1].replace(/\s+/g, ' '));
  }
  return tokens;
}

/** Parses the subset of VS Code `when` clauses the manifest uses: `!`, `&&` binding tighter than `||`, parentheses. Comparisons are atoms. */
function parseWhen(clause: string): WhenExpr {
  const tokens = tokenize(clause);
  let pos = 0;
  const parseOr = (): WhenExpr => {
    const args = [parseAnd()];
    while (tokens[pos] === '||') {
      pos++;
      args.push(parseAnd());
    }
    return args.length === 1 ? args[0] : { op: 'or', args };
  };
  const parseAnd = (): WhenExpr => {
    const args = [parseUnary()];
    while (tokens[pos] === '&&') {
      pos++;
      args.push(parseUnary());
    }
    return args.length === 1 ? args[0] : { op: 'and', args };
  };
  const parseUnary = (): WhenExpr => {
    const token = tokens[pos++];
    if (token === '!') {
      return { op: 'not', arg: parseUnary() };
    }
    if (token === '(') {
      const expr = parseOr();
      if (tokens[pos++] !== ')') {
        throw new Error(`Expected ) in: ${clause}`);
      }
      return expr;
    }
    if (token === undefined || ['&&', '||', ')'].includes(token)) {
      throw new Error(`Unexpected ${token} in: ${clause}`);
    }
    return { op: 'atom', name: token };
  };
  const expr = parseOr();
  if (pos !== tokens.length) {
    throw new Error(`Trailing tokens in: ${clause}`);
  }
  return expr;
}

function atomsOf(expr: WhenExpr): Set<string> {
  switch (expr.op) {
    case 'atom':
      return new Set([expr.name]);
    case 'not':
      return atomsOf(expr.arg);
    default:
      return new Set(expr.args.flatMap((arg) => [...atomsOf(arg)]));
  }
}

function evaluate(expr: WhenExpr, context: Map<string, boolean>): boolean {
  switch (expr.op) {
    case 'atom':
      return context.get(expr.name) ?? false;
    case 'not':
      return !evaluate(expr.arg, context);
    case 'and':
      return expr.args.every((arg) => evaluate(arg, context));
    case 'or':
      return expr.args.some((arg) => evaluate(arg, context));
  }
}

function contexts(atoms: string[]): Map<string, boolean>[] {
  return Array.from(
    { length: 2 ** atoms.length },
    (_, bits) => new Map(atoms.map((atom, i) => [atom, ((bits >> i) & 1) === 1]))
  );
}

/** The contexts, with the REPL Input unfocused, where the two clauses disagree */
function disagreementsWithoutReplInput(clause: string, editorOnlyClause: string) {
  const expr = parseWhen(clause);
  const editorOnlyExpr = parseWhen(editorOnlyClause);
  const atoms = [...new Set([...atomsOf(expr), ...atomsOf(editorOnlyExpr)])].filter(
    (atom) => atom !== REPL_INPUT_FOCUSED
  );
  return contexts(atoms)
    .map((context) => context.set(REPL_INPUT_FOCUSED, false))
    .filter((context) => evaluate(expr, context) !== evaluate(editorOnlyExpr, context))
    .map((context) => Object.fromEntries(context));
}

function occurrences(s: string, sub: string) {
  return s.split(sub).length - 1;
}

const requiresEditorTextFocus = (when: string) => atomsOf(parseWhen(when)).has('editorTextFocus');

describe('Calva editing keybindings and the REPL Input', () => {
  const editingBindings = keybindings.filter(
    ({ command, when }) => isEditingCommand(command) && when && requiresEditorTextFocus(when)
  );
  const replInputBindings = keybindings.filter(
    ({ command, when }) => !isReplInputCommand(command) && when?.includes(REPL_INPUT_FOCUSED)
  );

  it('parses when clauses with VS Code precedence', () => {
    const expr = parseWhen('a && !b || c =~ /x|y/ && (d || e == f)');
    expect([...atomsOf(expr)]).toEqual(['a', 'b', 'c =~ /x|y/', 'd', 'e == f']);
    const ctx = (trueAtoms: string[]) =>
      new Map([...atomsOf(expr)].map((atom) => [atom, trueAtoms.includes(atom)]));
    expect(evaluate(expr, ctx(['a']))).toBe(true);
    expect(evaluate(expr, ctx(['a', 'b']))).toBe(false);
    expect(evaluate(expr, ctx(['c =~ /x|y/']))).toBe(false);
    expect(evaluate(expr, ctx(['c =~ /x|y/', 'e == f']))).toBe(true);
  });

  it('every keybinding of a Calva editing command that requires editorTextFocus holds for the REPL Input', () => {
    expect(editingBindings.length).toBeGreaterThan(50);
    const missing = editingBindings
      .filter(({ when }) => occurrences(when, REPL_INPUT_CLAUSE) !== 1)
      .map(({ command, key, mac }) => `${command} ${mac ?? key}`);
    expect(missing).toEqual([]);
  });

  it('only Calva editing commands are bound for the REPL Input, and only through the clause', () => {
    const elsewhere = replInputBindings
      .filter(
        ({ command, when }) =>
          !isEditingCommand(command) ||
          occurrences(when, REPL_INPUT_FOCUSED) !== occurrences(when, REPL_INPUT_CLAUSE)
      )
      .map(({ command, key, mac }) => `${command} ${mac ?? key}`);
    expect(elsewhere).toEqual([]);
  });

  it('the rewritten clauses hold exactly when the editor-only clauses do while the REPL Input is unfocused', () => {
    expect(replInputBindings.length).toBe(editingBindings.length);
    const disagreements = replInputBindings
      .map(({ command, key, mac, when }) => ({
        binding: `${command} ${mac ?? key}`,
        contexts: disagreementsWithoutReplInput(
          when,
          when.split(REPL_INPUT_CLAUSE).join(EDITOR_CLAUSE)
        ),
      }))
      .filter(({ contexts }) => contexts.length > 0);
    expect(disagreements).toEqual([]);
  });

  it('every Calva editing command with an enablement is enabled in the REPL Input', () => {
    const editingCommandsWithEnablement = commands.filter(
      ({ command, enablement }) => isEditingCommand(command) && enablement
    );
    expect(editingCommandsWithEnablement.length).toBeGreaterThan(50);
    const notEnabled = editingCommandsWithEnablement
      .filter(({ enablement }) => enablement !== REPL_INPUT_ENABLEMENT)
      .map(({ command }) => command);
    expect(notEnabled).toEqual([]);
    expect(disagreementsWithoutReplInput(REPL_INPUT_ENABLEMENT, EDITOR_ENABLEMENT)).toEqual([]);
  });

  it('other commands are not enabled through the REPL Input', () => {
    const others = commands
      .filter(
        ({ command, enablement }) =>
          !isEditingCommand(command) &&
          !isReplInputCommand(command) &&
          enablement?.includes(REPL_INPUT_FOCUSED)
      )
      .map(({ command }) => command);
    expect(others).toEqual([]);
  });

  it("the REPL Input's own commands are bound only while it has focus", () => {
    const ownBindings = keybindings.filter(({ command }) => isReplInputCommand(command));
    expect(ownBindings.length).toBeGreaterThan(0);
    const unfocused = ownBindings
      .filter(({ when }) => {
        const expr = parseWhen(when);
        return (
          expr.op !== 'and' ||
          !expr.args.some((arg) => arg.op === 'atom' && arg.name === REPL_INPUT_FOCUSED) ||
          atomsOf(expr).has('editorTextFocus')
        );
      })
      .map(({ command, key }) => `${command} ${key}`);
    expect(unfocused).toEqual([]);
  });
});
