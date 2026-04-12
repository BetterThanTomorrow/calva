import { expect } from 'expect';
import * as cljsLib from '../../../../out/cljs-lib/cljs-lib';
import * as dramManifest from '../../../../src/nrepl/dram-manifest';

const miniDramEdn = `{:name "Mini Project REPL"
 :files [{:path "src/mini/playground.clj"
          :open? true}
         {:path "deps.edn"
          :open? false}
         {:path ".gitignore"
          :open? false}
         {:path ".vscode/settings.json"
          :open? false}]}`;

const gettingStartedDramEdn = `{:name "Getting Started REPL"
 :files [{:path "src/get_started/hello_repl.clj"
          :open? true}
         {:path "src/get_started/welcome_to_clojure.clj"
          :open? true}
         {:path "src/get_started/hello_paredit.clj"
          :open? true}
         {:path "deps.edn"
          :open? false}
         {:path ".vscode/settings.json"
          :open? false}
         {:path ".gitignore"
          :open? false}]}`;

const topLevelOpenOnlyDramEdn = `{:name "Top Level Open Only"
       :files [{:path "deps.edn"
          :open? false}
         {:path ".gitignore"
          :open? false}]
       :open ["deps.edn" ".gitignore"]}`;

const mixedOpenDramEdn = `{:name "Mixed Open"
       :files [{:path "src/example/a.clj"
          :open? true}
         {:path "src/example/b.clj"
          :open? true}
         {:path "src/example/c.clj"
          :open? false}]
       :open ["src/example/c.clj" "src/example/b.clj" "src/example/a.clj"]}`;

function parseManifest(edn: string): dramManifest.DramConfig {
  return cljsLib.parseEdn(edn) as dramManifest.DramConfig;
}

describe('dram manifest legacy helpers', () => {
  it('preserves staging order for the current mini starter manifest', () => {
    const config = parseManifest(miniDramEdn);

    expect(dramManifest.getLegacyDramFilePaths(config.files)).toEqual([
      'src/mini/playground.clj',
      'deps.edn',
      '.gitignore',
      '.vscode/settings.json',
    ]);
  });

  it('derives the current open list in file order for the getting started starter', () => {
    const config = parseManifest(gettingStartedDramEdn);

    expect(dramManifest.getLegacyOpenDramFiles(config.files).map((file) => file.path)).toEqual([
      'src/get_started/hello_repl.clj',
      'src/get_started/welcome_to_clojure.clj',
      'src/get_started/hello_paredit.clj',
    ]);
  });

  it('pins the current implicit primary target assumption for surfaced legacy starters', () => {
    const surfacedConfigs = [parseManifest(miniDramEdn), parseManifest(gettingStartedDramEdn)];

    expect(
      surfacedConfigs.every(
        (config) => dramManifest.normalizeLegacyDramFiles(config.files)[0]?.['open?']
      )
    ).toBe(true);
  });

  it('resolves legacy-only manifests to the current legacy open list', () => {
    const config = parseManifest(gettingStartedDramEdn);

    expect(dramManifest.resolveDramOpenPaths(config)).toEqual([
      'src/get_started/hello_repl.clj',
      'src/get_started/welcome_to_clojure.clj',
      'src/get_started/hello_paredit.clj',
    ]);
  });

  it('supports top-level open without relying on file-level open markers', () => {
    const config = parseManifest(topLevelOpenOnlyDramEdn);

    expect(dramManifest.resolveDramOpenPaths(config)).toEqual(['deps.edn', '.gitignore']);
  });

  it('deduplicates mixed legacy and top-level open paths by the last requested position', () => {
    const config = parseManifest(mixedOpenDramEdn);

    expect(dramManifest.resolveDramOpenPaths(config)).toEqual([
      'src/example/c.clj',
      'src/example/b.clj',
      'src/example/a.clj',
    ]);
  });
});
