import * as expectLib from 'expect';
import * as cider from '../../../nrepl/cider';

const coords = { group: 'org.clojure', artifact: 'clojure', version: '1.12.0' };

function feed(messages: object[]) {
  let resolved: unknown;
  let rejected: unknown;
  const downloads: unknown[] = [];
  const handler = cider.infoHandler(
    (info) => (resolved = info),
    (reason) => (rejected = reason),
    (coords) => downloads.push(coords)
  );
  const handled = messages.map(handler);
  return { resolved, rejected, downloads, handled };
}

describe('infoHandler', () => {
  it('resolves with the info message', () => {
    const info = { id: '3', file: 'jar:file:/x.jar!/a.clj', line: 1, status: ['done'] };
    const { resolved, handled } = feed([info]);
    expectLib.expect(resolved).toBe(info);
    expectLib.expect(handled).toEqual([true]);
  });

  it('reports a sources jar download, and waits for the info that follows it', () => {
    const info = {
      id: '3',
      'file-url': 'jar:file:/s.jar!/clojure/lang/LazySeq.java',
      status: ['done'],
    };
    const { resolved, downloads, handled } = feed([
      { id: '3', status: ['download-sources-jar'], coords },
      info,
    ]);
    expectLib.expect(downloads).toEqual([coords]);
    expectLib.expect(resolved).toBe(info);
    expectLib.expect(handled).toEqual([false, true]);
  });

  it('rejects when the server does not know the op', () => {
    const { resolved, rejected } = feed([{ id: '3', op: 'info', status: ['unknown-op', 'done'] }]);
    expectLib.expect(resolved).toBeUndefined();
    expectLib.expect(rejected).toBeDefined();
  });
});
