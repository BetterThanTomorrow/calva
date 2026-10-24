import * as expectLib from 'expect';
import * as replDefinition from '../../../src/providers/repl-definition';
import * as textNotation from './common/text-notation';

function fakeSession(info: any, supportsInfo = true) {
  const calls: [string, string][] = [];
  const session = {
    supports: (op: string) => supportsInfo && op === 'info',
    info: (ns: string, symbol: string) => {
      calls.push([ns, symbol]);
      return Promise.resolve(info);
    },
  };
  return { calls, session };
}

async function defineAtCursor(s: string, ns: string, info: any, supportsInfo = true) {
  const doc = textNotation.docFromTextNotation(s);
  const { calls, session } = fakeSession(info, supportsInfo);
  const definition = await replDefinition.replDefinition(
    session,
    ns,
    doc,
    doc.selections[0].active
  );
  return { calls, definition };
}

describe('REPL definitions from text', () => {
  const info = { file: 'file:/src/foo.clj', line: 3, column: 7, doc: 'Does foo.' };

  it('asks the session for info on the word at the offset, in the namespace', async () => {
    const { calls } = await defineAtCursor('(ns foo)•(str/upp|er-case "x")', 'foo', info);
    expectLib.expect(calls).toEqual([['foo', 'str/upper-case']]);
  });
  it('drops a leading syntax quote from the word', async () => {
    const { calls } = await defineAtCursor('`(st|r 1)', 'user', info);
    expectLib.expect(calls).toEqual([['user', 'str']]);
  });
  it('gives the file, line and column the REPL reports', async () => {
    const { definition } = await defineAtCursor('(fo|o)', 'user', info);
    expectLib.expect(definition).toEqual({ file: 'file:/src/foo.clj', line: 3, column: 7 });
  });
  it('gives undefined when the REPL reports no file', async () => {
    const { definition } = await defineAtCursor('(fo|o)', 'user', { file: '', line: 3 });
    expectLib.expect(definition).toBeUndefined();
  });
  it('gives undefined without asking when the session does not support info', async () => {
    const { calls, definition } = await defineAtCursor('(fo|o)', 'user', info, false);
    expectLib.expect(calls).toEqual([]);
    expectLib.expect(definition).toBeUndefined();
  });
  it('gives undefined without a session', async () => {
    const doc = textNotation.docFromTextNotation('(fo|o)');
    expectLib
      .expect(await replDefinition.replDefinition(undefined, 'user', doc, doc.selections[0].active))
      .toBeUndefined();
  });
});
