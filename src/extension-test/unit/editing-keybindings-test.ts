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
const REPL_INPUT_LAST_FOCUSED = 'calva:replInputLastFocused';
const IN_QUICK_OPEN = 'inQuickOpen';
const EDITOR_CLAUSE = 'editorLangId == clojure && editorTextFocus';
const REPL_INPUT_CLAUSE = `(${EDITOR_CLAUSE} || ${REPL_INPUT_FOCUSED})`;
const EDITOR_ENABLEMENT = 'editorLangId == clojure';
const REPL_INPUT_PALETTE_CLAUSE = `${REPL_INPUT_FOCUSED} || ${REPL_INPUT_LAST_FOCUSED} && ${IN_QUICK_OPEN}`;
const REPL_INPUT_ENABLEMENT = `${EDITOR_ENABLEMENT} || ${REPL_INPUT_PALETTE_CLAUSE}`;
const REPL_INPUT_ATOMS = [REPL_INPUT_FOCUSED, REPL_INPUT_LAST_FOCUSED];

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
];

const EVALUATION_COMMANDS_LEFT_AS_THEY_ARE = [
  'calva.evaluateCurrentTopLevelForm',
  'calva.evaluateSelectionReplace',
  'calva.evaluateSelectionAsComment',
  'calva.evaluateTopLevelFormAsComment',
  'calva.evaluateReplWindowForm',
];

const isReplInputCommand = (command: string) => command.startsWith('calva.replInput.');

function isEditingCommand(command: string) {
  return (
    NAMED_EDITING_COMMANDS.includes(command) ||
    (command.startsWith('paredit.') && !PAREDIT_COMMANDS_LEFT_AS_THEY_ARE.includes(command))
  );
}

const isEvaluationCommand = (command: string) =>
  /^calva\.(evaluate|tap)/.test(command) && !EVALUATION_COMMANDS_LEFT_AS_THEY_ARE.includes(command);

const reachesReplInput = (command: string) =>
  isEditingCommand(command) || isEvaluationCommand(command);

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

/** The contexts, with the REPL Input neither focused nor the last focused place, where the two clauses disagree */
function disagreementsWithoutReplInput(clause: string, editorOnlyClause: string) {
  const expr = parseWhen(clause);
  const editorOnlyExpr = parseWhen(editorOnlyClause);
  const atoms = [...new Set([...atomsOf(expr), ...atomsOf(editorOnlyExpr)])].filter(
    (atom) => !REPL_INPUT_ATOMS.includes(atom)
  );
  return contexts(atoms)
    .map(
      (context) => new Map([...context, ...REPL_INPUT_ATOMS.map((atom) => [atom, false] as const)])
    )
    .filter((context) => evaluate(expr, context) !== evaluate(editorOnlyExpr, context))
    .map((context) => Object.fromEntries(context));
}

/** True when some context with the REPL Input focused has both clauses hold */
function holdTogetherInReplInput(clause: string, otherClause: string) {
  const exprs = [parseWhen(clause), parseWhen(otherClause)];
  const atoms = [...new Set(exprs.flatMap((expr) => [...atomsOf(expr)]))].filter(
    (atom) => atom !== REPL_INPUT_FOCUSED
  );
  return contexts(atoms)
    .map((context) => context.set(REPL_INPUT_FOCUSED, true))
    .some((context) => exprs.every((expr) => evaluate(expr, context)));
}

const REPL_INPUT_KEY_PREFIX = 'calva:replInput';

const menuEntries: { command?: string; when?: string }[] = Object.values<
  { command?: string; when?: string }[]
>(manifest.contributes.menus).flat();

/** Every `when` and `enablement` clause of the manifest's commands, keybindings and menus, with its command */
const manifestClauses: { command?: string; clause: string }[] = [
  ...commands.map(({ command, enablement }) => ({ command, clause: enablement })),
  ...keybindings.map(({ command, when }) => ({ command, clause: when })),
  ...menuEntries.map(({ command, when }) => ({ command, clause: when })),
].filter(({ clause }) => clause !== undefined);

function occurrences(s: string, sub: string) {
  return s.split(sub).length - 1;
}

const requiresEditorTextFocus = (when: string) => atomsOf(parseWhen(when)).has('editorTextFocus');

describe('Calva editing keybindings and the REPL Input', () => {
  const editingBindings = keybindings.filter(
    ({ command, when }) => reachesReplInput(command) && when && requiresEditorTextFocus(when)
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

  it('every keybinding of a Calva editing or evaluation command that requires editorTextFocus holds for the REPL Input', () => {
    expect(editingBindings.length).toBeGreaterThan(50);
    const missing = editingBindings
      .filter(({ when }) => occurrences(when, REPL_INPUT_CLAUSE) !== 1)
      .map(({ command, key, mac }) => `${command} ${mac ?? key}`);
    expect(missing).toEqual([]);
  });

  it('only Calva editing and evaluation commands are bound for the REPL Input, and only through the clause', () => {
    const elsewhere = replInputBindings
      .filter(
        ({ command, when }) =>
          !reachesReplInput(command) ||
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
          REPL_INPUT_ATOMS.some((atom) => enablement?.includes(atom))
      )
      .map(({ command }) => command);
    expect(others).toEqual([]);
  });

  it('the command palette enables Calva editing commands and the REPL Input commands while the REPL Input is the last focused place', () => {
    const paletteWhen = new Map<string, string>(
      manifest.contributes.menus.commandPalette.map(({ command, when }) => [command, when])
    );
    const clauses = commands
      .filter(
        ({ command, enablement }) =>
          isReplInputCommand(command) || (isEditingCommand(command) && enablement)
      )
      .flatMap(({ command, enablement }) => [
        [`${command} enablement`, enablement],
        ...(paletteWhen.has(command) ? [[`${command} palette`, paletteWhen.get(command)]] : []),
      ]);
    expect(clauses.length).toBeGreaterThan(100);
    const wrong = clauses
      .filter(([, clause]) => {
        const expr = parseWhen(clause);
        const lastFocused = new Map([...atomsOf(expr)].map((atom) => [atom, false])).set(
          REPL_INPUT_LAST_FOCUSED,
          true
        );
        const inPalette = evaluate(expr, new Map(lastFocused).set(IN_QUICK_OPEN, true));
        const outsidePalette = evaluate(expr, new Map(lastFocused).set(IN_QUICK_OPEN, false));
        return !inPalette || outsidePalette;
      })
      .map(([label]) => label);
    expect(wrong).toEqual([]);
  });

  it("the REPL Input's own keys and the Calva commands that reach it never hold together on a key", () => {
    const keyOn = (binding: typeof keybindings[number], platform: string) =>
      binding[platform] ?? binding.key;
    const collisions = ['mac', 'win', 'linux'].flatMap((platform) =>
      keybindings
        .filter(({ command }) => isReplInputCommand(command))
        .flatMap((own) =>
          replInputBindings
            .filter(
              (other) =>
                keyOn(own, platform) &&
                keyOn(own, platform) === keyOn(other, platform) &&
                holdTogetherInReplInput(own.when, other.when)
            )
            .map((other) => `${platform} ${keyOn(own, platform)}: ${own.command} ${other.command}`)
        )
    );
    expect(collisions).toEqual([]);
  });

  it("the REPL Input's own commands are bound only while it has focus", () => {
    const ownBindings = keybindings.filter(({ command }) => isReplInputCommand(command));
    expect(ownBindings.length).toBeGreaterThan(0);
    const isFocusAtom = (expr: WhenExpr) => expr.op === 'atom' && expr.name === REPL_INPUT_FOCUSED;
    const requiresFocus = (expr: WhenExpr) =>
      isFocusAtom(expr) || (expr.op === 'and' && expr.args.some(isFocusAtom));
    const unfocused = ownBindings
      .filter(({ when }) => {
        const expr = parseWhen(when);
        return !requiresFocus(expr) || atomsOf(expr).has('editorTextFocus');
      })
      .map(({ command, key }) => `${command} ${key}`);
    expect(unfocused).toEqual([]);
  });

  it('without a REPL Input, every other clause in the manifest reads as it would without the REPL Input', () => {
    const touched = manifestClauses.filter(
      ({ command, clause }) =>
        !isReplInputCommand(command ?? '') && clause.includes(REPL_INPUT_KEY_PREFIX)
    );
    expect(touched.length).toBeGreaterThan(100);
    const changed = touched
      .filter(({ clause }) => {
        const without =
          clause === REPL_INPUT_ENABLEMENT
            ? EDITOR_ENABLEMENT
            : clause.split(REPL_INPUT_CLAUSE).join(EDITOR_CLAUSE);
        return (
          without.includes(REPL_INPUT_KEY_PREFIX) ||
          disagreementsWithoutReplInput(clause, without).length > 0
        );
      })
      .map(({ command, clause }) => `${command}: ${clause}`);
    expect(changed).toEqual([]);
  });

  it("without a REPL Input, the REPL Input's own commands are disabled, unbound and out of every menu", () => {
    const unguarded = [
      ...commands.filter(({ command, enablement }) => isReplInputCommand(command) && !enablement),
      ...keybindings.filter(({ command, when }) => isReplInputCommand(command) && !when),
      ...menuEntries.filter(({ command, when }) => isReplInputCommand(command ?? '') && !when),
    ].map(({ command }) => command);
    expect(unguarded).toEqual([]);
    const own = manifestClauses.filter(({ command }) => isReplInputCommand(command ?? ''));
    expect(own.length).toBeGreaterThan(100);
    const holdingWithReplInputKeysFalse = own
      .filter(({ clause }) => {
        const expr = parseWhen(clause);
        const atoms = [...atomsOf(expr)];
        const replInputKeysFalse = atoms
          .filter((atom) => atom.startsWith(REPL_INPUT_KEY_PREFIX))
          .map((atom) => [atom, false] as const);
        return contexts(atoms.filter((atom) => !atom.startsWith(REPL_INPUT_KEY_PREFIX))).some(
          (context) => evaluate(expr, new Map([...context, ...replInputKeysFalse]))
        );
      })
      .map(({ command, clause }) => `${command}: ${clause}`);
    expect(holdingWithReplInputKeysFalse).toEqual([]);
  });

  it("the REPL Input's own commands are in the command palette only while it has focus, or is the last focused place", () => {
    const paletteWhen = new Map<string, string>(
      manifest.contributes.menus.commandPalette.map(({ command, when }) => [command, when])
    );
    const ungated = commands
      .filter(({ command }) => isReplInputCommand(command))
      .filter(({ command }) => paletteWhen.get(command) !== REPL_INPUT_PALETTE_CLAUSE)
      .map(({ command }) => command);
    expect(ungated).toEqual([]);
  });
});
