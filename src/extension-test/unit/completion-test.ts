import * as expectLib from 'expect';
import { CompletionItemKind } from 'vscode-languageserver-protocol';
import * as completionUtil from '../../../src/providers/completion-util';
import * as replCompletion from '../../../src/providers/repl-completion';
import * as model from '../../cursor-doc/model';
import * as textNotation from './common/text-notation';

model.initScanner(20000);

function fakeSession(completions: any[]) {
  const calls: [string, string, string | undefined][] = [];
  const session = {
    complete: (ns: string, symbol: string, context?: string) => {
      calls.push([ns, symbol, context]);
      return Promise.resolve({ completions });
    },
  };
  return { calls, session };
}

async function completeAtCursor(s: string, ns: string, completions: any[] = []) {
  const doc = textNotation.docFromTextNotation(s);
  const { calls, session } = fakeSession(completions);
  const items = await replCompletion.replCompletions(session, ns, doc, doc.selections[0].active);
  return { calls, items };
}

describe('REPL completions from text', () => {
  it('asks the session to complete the word at the offset, with the top-level form as context', async () => {
    const { calls } = await completeAtCursor('(ns foo)•(defn bar [] (str/upp|))', 'foo');
    expectLib.expect(calls).toEqual([['foo', 'str/upp', '(defn bar [] (__prefix__))']]);
  });
  it('completes the whole word around the offset', async () => {
    const { calls } = await completeAtCursor('(ma|p inc [1])', 'user');
    expectLib.expect(calls).toEqual([['user', 'map', '(__prefix__ inc [1])']]);
  });
  it('drops a leading syntax quote from the word, and keeps it out of the context', async () => {
    const { calls } = await completeAtCursor('(foo `ba|r)', 'user');
    expectLib.expect(calls).toEqual([['user', 'bar', '(foo __prefix__)']]);
  });
  it('sends no context for a word outside a list', async () => {
    const { calls } = await completeAtCursor('(ns foo)•upp|', 'foo');
    expectLib.expect(calls).toEqual([['foo', 'upp', undefined]]);
  });
  it('gives the candidates as completion items from the REPL, with a namespace each', async () => {
    const { items } = await completeAtCursor('(upp|)', 'foo', [
      { candidate: 'clojure.string/upper-case', type: 'function', ns: 'clojure.string' },
      { candidate: 'upp-local', type: 'local' },
      { candidate: 'upp-thing', type: 'something-else' },
    ]);
    expectLib.expect(items).toEqual([
      {
        label: 'clojure.string/upper-case',
        kind: CompletionItemKind.Function,
        data: {
          candidate: 'clojure.string/upper-case',
          type: 'function',
          ns: 'clojure.string',
          provider: 'repl',
        },
      },
      {
        label: 'upp-local',
        kind: CompletionItemKind.Variable,
        data: { candidate: 'upp-local', type: 'local', ns: 'foo', provider: 'repl' },
      },
      {
        label: 'upp-thing',
        kind: CompletionItemKind.Text,
        data: { candidate: 'upp-thing', type: 'something-else', ns: 'foo', provider: 'repl' },
      },
    ]);
  });
});

describe('Merging completion arrays', () => {
  it('it merges two empty arrays or completions', function () {
    expectLib.expect(completionUtil.mergeCompletions([], [])).toStrictEqual([]);
  });
  it('it merges an empty and a populated array or completions', function () {
    const completions = [
      { label: 'a', kind: 1 },
      { label: 'b', kind: 2 },
    ];
    expectLib.expect(completionUtil.mergeCompletions([], completions)).toStrictEqual(completions);
  });
  it('it merges a populated and empty array or completions', function () {
    const completions = [
      { label: 'a', kind: 1 },
      { label: 'b', kind: 2 },
    ];
    expectLib.expect(completionUtil.mergeCompletions(completions, [])).toStrictEqual(completions);
  });
  it('it merges two populated arrays or completions, the second array wins with equal scores', function () {
    const completions1 = [
      { label: 'a', kind: 1, detail: 'foo', score: 0 },
      { label: 'b', kind: 2 },
    ];
    const completions2 = [
      { label: 'a', kind: 1, detail: 'bar', score: 0 },
      { label: 'c', kind: 3 },
    ];
    const mergedCompletions = [
      { label: 'a', kind: 1, detail: 'bar', score: 0 },
      { label: 'b', kind: 2 },
      { label: 'c', kind: 3 },
    ];
    expectLib
      .expect(completionUtil.mergeCompletions(completions1, completions2))
      .toStrictEqual(mergedCompletions);
  });
  it('it merges two populated arrays or completions, the higher score wins', function () {
    const completions1 = [
      { label: 'a', kind: 1, detail: 'foo', score: 1 },
      { label: 'b', kind: 2, detail: 'foo', score: 0 },
      { label: 'd', kind: 4 },
    ];
    const completions2 = [
      { label: 'a', kind: 1, detail: 'bar', score: 0 },
      { label: 'b', kind: 2, detail: 'bar', score: 0 },
      { label: 'c', kind: 3 },
    ];
    const mergedCompletions = [
      { label: 'a', kind: 1, detail: 'foo', score: 1 },
      { label: 'b', kind: 2, detail: 'bar', score: 0 },
      { label: 'd', kind: 4 },
      { label: 'c', kind: 3 },
    ];
    expectLib
      .expect(completionUtil.mergeCompletions(completions1, completions2))
      .toStrictEqual(mergedCompletions);
  });
});
