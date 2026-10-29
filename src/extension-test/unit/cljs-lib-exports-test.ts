import * as expectLib from 'expect';
import * as fs from 'fs';
import * as path from 'path';

const expect = expectLib.expect;

const repoRoot = path.join(__dirname, '..', '..', '..');

function calvaLibExports(): Set<string> {
  const edn = fs.readFileSync(path.join(repoRoot, 'shadow-cljs.edn'), 'utf8');
  const exportsMap = edn.match(/:calva-lib\s*\{[\s\S]*?:exports\s*\{([^}]*)\}/)[1];
  return new Set([...exportsMap.matchAll(/:([\w$]+)\s+\S+/g)].map((m) => m[1]));
}

function tsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return tsFiles(entryPath);
    }
    return entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}

function namesAfter(source: string, prefix: string): string[] {
  return [...source.matchAll(new RegExp(`(?<![\\w$.])${prefix}\\s*\\.([\\w$]+)`, 'g'))].map(
    (m) => m[1]
  );
}

function cljsLibUses(file: string): { file: string; name: string }[] {
  const source = fs.readFileSync(file, 'utf8');
  const aliases = [
    ...source.matchAll(/import \* as ([\w$]+) from '[^']*\/out\/cljs-lib\/cljs-lib'/g),
  ].map((m) => m[1]);
  const names = [
    ...aliases.flatMap((alias) => namesAfter(source, alias)),
    ...namesAfter(source, '[\\w$]+\\.cljsLib'),
  ];
  return names.map((name) => ({ file: path.relative(repoRoot, file), name }));
}

describe('cljs-lib exports', () => {
  it('has an export in shadow-cljs.edn for every cljs-lib function the TS code uses', () => {
    const exported = calvaLibExports();
    const uses = tsFiles(path.join(repoRoot, 'src')).flatMap(cljsLibUses);
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.filter(({ name }) => !exported.has(name))).toEqual([]);
  });
});
