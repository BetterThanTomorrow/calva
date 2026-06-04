import * as fs from 'fs';
import * as path from 'path';
import {
  Registry,
  type IGrammar,
  type IRawGrammar,
  type IToken,
  type StateStack,
} from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';

export interface GrammarToken {
  value: string;
  scopes: string[];
}

export interface GrammarTestContext {
  grammar: IGrammar;
  scopeName: string;
  tokenizeLine(line: string): { tokens: GrammarToken[] };
  tokenizeLines(multiline: string): GrammarToken[][];
  firstLineMatches(line: string): boolean;
}

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const GRAMMAR_PATH = path.join(REPO_ROOT, 'clojure.tmLanguage.json');

/** Oniguruma has no (?x); strip extended-mode comments and whitespace like TextMate. */
function compileFirstLineMatch(pattern: string): string {
  if (!pattern.startsWith('(?x)')) {
    return pattern;
  }
  return pattern
    .slice(4)
    .split('\n')
    .map((line) => {
      if (/^\s*#/.test(line)) {
        return '';
      }
      return line.replace(/[ \t]/g, '');
    })
    .join('');
}

function wasmPath(): string {
  return path.join(
    path.dirname(require.resolve('vscode-oniguruma/package.json')),
    'release/onig.wasm'
  );
}

function rawTokensToGrammarTokens(line: string, rawTokens: IToken[]): GrammarToken[] {
  const tokens: GrammarToken[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const start = rawTokens[i].startIndex;
    const end = i + 1 < rawTokens.length ? rawTokens[i + 1].startIndex : line.length;
    if (end <= start) {
      continue;
    }
    const value = line.slice(start, end);
    tokens.push({ value, scopes: [...rawTokens[i].scopes] });
  }
  return tokens;
}

let initPromise: Promise<GrammarTestContext> | undefined;

export function createGrammarTestContext(): Promise<GrammarTestContext> {
  if (initPromise === undefined) {
    initPromise = init();
  }
  return initPromise;
}

async function init(): Promise<GrammarTestContext> {
  await loadWASM(fs.readFileSync(wasmPath()));

  const rawGrammar = JSON.parse(fs.readFileSync(GRAMMAR_PATH, 'utf8')) as IRawGrammar;
  const firstLineMatch = rawGrammar.firstLineMatch;
  const firstLineScanner = firstLineMatch
    ? new OnigScanner([compileFirstLineMatch(firstLineMatch)])
    : undefined;

  const registry = new Registry({
    onigLib: Promise.resolve({
      createOnigScanner(patterns: string[]) {
        return new OnigScanner(patterns);
      },
      createOnigString(s: string) {
        return new OnigString(s);
      },
    }),
    loadGrammar: (scope) => Promise.resolve(scope === 'source.clojure' ? rawGrammar : null),
  });

  const grammar = await registry.loadGrammar('source.clojure');
  if (!grammar) {
    throw new Error(`Failed to load grammar from ${GRAMMAR_PATH}`);
  }

  return {
    grammar,
    scopeName: rawGrammar.scopeName,

    tokenizeLine(line: string): { tokens: GrammarToken[] } {
      const { tokens } = grammar.tokenizeLine(line, null as unknown as StateStack);
      return { tokens: rawTokensToGrammarTokens(line, tokens) };
    },

    tokenizeLines(multiline: string): GrammarToken[][] {
      const lines = multiline.split('\n');
      let ruleStack: StateStack | null = null;
      return lines.map((line) => {
        const { tokens, ruleStack: nextStack } = grammar.tokenizeLine(
          line,
          ruleStack as unknown as StateStack
        );
        ruleStack = nextStack;
        return rawTokensToGrammarTokens(line, tokens);
      });
    },

    firstLineMatches(line: string): boolean {
      if (!firstLineScanner) {
        return false;
      }
      const onigLine = new OnigString(line);
      try {
        return firstLineScanner.findNextMatchSync(onigLine, 0) !== null;
      } finally {
        onigLine.dispose?.();
      }
    },
  };
}
