const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { startWatcher } = require('./lint-watch');

async function waitFor(predicate, description) {
  const deadline = Date.now() + 8000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, `Timed out: ${description}`);
    await delay(20);
  }
}

void test('coalesces changes, recovers after failure, reloads exclusions and cleans up children', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'calva-lint-watch-'));
  const config = { ignorePatterns: ['/out', '/test-fixtures'] };
  fs.writeFileSync(path.join(cwd, '.oxlintrc.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(cwd, '.gitignore'), 'ignored/\n');
  fs.mkdirSync(path.join(cwd, 'src'));
  fs.writeFileSync(path.join(cwd, 'src/main.ts'), 'export const x = 1;');
  const worker = path.join(cwd, 'worker.cjs');
  fs.writeFileSync(
    worker,
    `const fs = require('node:fs');
const { spawn } = require('node:child_process');
const rows = fs.existsSync('runs') ? fs.readFileSync('runs', 'utf8').trim().split('\\n') : [];
const index = rows.length + 1;
const descendant = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], {stdio: 'ignore'});
fs.appendFileSync('runs', JSON.stringify({index, pid: process.pid, descendant: descendant.pid}) + '\\n');
process.on('SIGTERM', () => {});
setInterval(() => {
  if (fs.existsSync('release') && Number(fs.readFileSync('release', 'utf8')) >= index) {
    descendant.kill('SIGKILL');
    descendant.once('exit', () => process.exit(index === 2 ? 1 : 0));
  }
}, 20);
`
  );
  let output = '';
  const options = {
    cwd,
    command: process.execPath,
    args: [worker],
    output: { write: (text) => (output += text) },
    debounceMs: 30,
    killGraceMs: 200,
  };
  let watcher = startWatcher(options);
  const runs = () =>
    fs.existsSync(path.join(cwd, 'runs'))
      ? fs.readFileSync(path.join(cwd, 'runs'), 'utf8').trim().split('\n').map(JSON.parse)
      : [];
  const release = (index) => fs.writeFileSync(path.join(cwd, 'release'), String(index));
  const write = (file) => {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), 'export const changed = true;');
  };
  try {
    await waitFor(() => runs().length === 1, 'initial run');
    for (let i = 0; i < 30; i++) {
      write(`src/burst-${i}.ts`);
    }
    await delay(200);
    assert.equal(runs().length, 1, 'changes must not overlap the active run');
    release(1);
    await waitFor(() => runs().length === 2, 'one coalesced rerun');
    release(2);
    await waitFor(() => output.includes('END failed (1)'), 'failed lint result');
    await delay(150);
    assert.equal(runs().length, 2, 'a burst must not create a queue of runs');

    write('src/added.ts');
    await waitFor(() => runs().length === 3, 'file addition after failure');
    release(3);
    await waitFor(() => (output.match(/END/g) || []).length === 3, 'third run completion');
    fs.unlinkSync(path.join(cwd, 'src/added.ts'));
    await waitFor(() => runs().length === 4, 'file deletion');
    release(4);
    await waitFor(() => (output.match(/END/g) || []).length === 4, 'fourth run completion');

    write('out/generated.js');
    write('test-fixtures/example.ts');
    write('ignored/example.ts');
    write('node_modules/example/index.js');
    await delay(200);
    assert.equal(runs().length, 4, 'generated files and ignored paths must not trigger lint');

    config.ignorePatterns = ['/out'];
    fs.writeFileSync(path.join(cwd, '.oxlintrc.json'), JSON.stringify(config));
    await waitFor(() => runs().length === 5, 'configuration change');
    release(5);
    await waitFor(() => (output.match(/END/g) || []).length === 5, 'config lint completion');
    write('test-fixtures/newly-included.ts');
    await waitFor(() => runs().length === 6, 'newly included directory');
    write('src/pending.ts');
    await delay(100);
    const lastRun = runs()[5];
    await watcher.close();
    await watcher.close();
    assert.equal(runs().length, 6, 'shutdown must discard the pending rerun');
    for (const pid of [lastRun.pid, lastRun.descendant]) {
      await waitFor(() => {
        try {
          process.kill(pid, 0);
          return false;
        } catch (error) {
          return error.code === 'ESRCH';
        }
      }, `process ${pid} stopped`);
    }
    watcher = startWatcher(options);
    await waitFor(() => runs().length === 7, 'restart');
  } finally {
    await watcher.close();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
