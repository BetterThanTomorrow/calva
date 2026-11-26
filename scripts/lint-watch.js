const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const chokidar = require('chokidar');
const ignore = require('ignore');

const watchPatterns = [
  '**/*.{js,jsx,ts,tsx,cjs,mjs,cts,mts}',
  '**/tsconfig*.json',
  '**/jsconfig*.json',
  '.oxlintrc.json',
  '.gitignore',
  'package.json',
  'package-lock.json',
];

function killTree(child, signal) {
  if (!child.pid) {
    return;
  }
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => undefined);
  } else {
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error;
      }
    }
  }
}

function startWatcher({
  cwd = process.cwd(),
  command = process.execPath,
  args = [
    path.join(path.dirname(require.resolve('oxlint/package.json')), 'bin/oxlint'),
    '--threads=2',
    '--format=unix',
    '.',
  ],
  output = process.stdout,
  debounceMs = 200,
  killGraceMs = 1500,
} = {}) {
  let child;
  let timer;
  let pending = false;
  let stopping = false;
  let closePromise;
  let watcher;
  let reconfigure = Promise.resolve();
  let ignored = ignore().add(['.git/', 'node_modules/', '.cache/']);

  const report = (message) => output.write(`[lint] ${message}\n`);

  function run() {
    if (stopping || child || !pending) {
      return;
    }
    pending = false;
    report('START');
    child = spawn(command, args, {
      cwd,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const running = child;
    running.stdout.on('data', (data) => output.write(data));
    running.stderr.on('data', (data) => output.write(data));
    running.on('error', (error) => report(`Could not start Oxlint: ${error.message}`));
    running.once('close', (code, signal) => {
      child = undefined;
      if (stopping) {
        // The CLI may exit before a descendant. Clear the remaining process group too.
        killTree(running, 'SIGKILL');
        return;
      }
      report(`END ${code === 0 ? 'clean' : `failed (${signal || code})`}`);
      if (pending && !timer) {
        run();
      }
    });
  }

  function schedule() {
    if (stopping) {
      return;
    }
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      run();
    }, debounceMs);
  }

  function openFileWatcher() {
    try {
      const config = JSON.parse(fs.readFileSync(path.join(cwd, '.oxlintrc.json'), 'utf8'));
      const gitignore = path.join(cwd, '.gitignore');
      ignored = ignore()
        .add(fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : '')
        .add(config.ignorePatterns || [])
        .add(['.git/', 'node_modules/', '.cache/']);
    } catch (error) {
      // Keep watching through partially written or invalid config so the next save can recover.
      report(`Keeping previous watch exclusions: ${error.message}`);
    }
    watcher = chokidar.watch(watchPatterns, {
      cwd,
      ignoreInitial: true,
      followSymlinks: false,
      ignored: (file, stats) => {
        const relative = path.relative(cwd, path.resolve(cwd, file)).split(path.sep).join('/');
        return relative !== '' && ignored.ignores(relative + (stats?.isDirectory() ? '/' : ''));
      },
    });
    watcher.once('ready', schedule);
    watcher.on('all', (event, file) => {
      if (file === '.oxlintrc.json' || file === '.gitignore') {
        // Rebuild traversal as exclusions change, including previously ignored directories.
        reconfigure = reconfigure.then(async () => {
          await watcher.close();
          if (!stopping) {
            openFileWatcher();
          }
        });
      } else if (['add', 'change', 'unlink'].includes(event)) {
        schedule();
      }
    });
    watcher.on('error', (error) => {
      report(`Watcher failed: ${error.message}`);
      process.exitCode = 1;
      void close();
    });
  }

  function close() {
    if (closePromise) {
      return closePromise;
    }
    stopping = true;
    pending = false;
    clearTimeout(timer);
    const running = child;
    const childClosed = running
      ? new Promise((resolve) => {
          const force = setTimeout(() => killTree(running, 'SIGKILL'), killGraceMs);
          running.once('close', () => {
            clearTimeout(force);
            resolve();
          });
          killTree(running, 'SIGTERM');
        })
      : Promise.resolve();
    closePromise = Promise.all([childClosed, reconfigure.then(() => watcher.close())]).then(() => {
      report('Stopped');
    });
    return closePromise;
  }

  openFileWatcher();
  return { close };
}

if (require.main === module) {
  const watcher = startWatcher();
  const stop = () => void watcher.close();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

module.exports = { startWatcher };
