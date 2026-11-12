import * as assert from 'assert';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import * as cp from 'child_process';
import { startBabashkaServer, stopBabashkaProcess } from '../../e2e/suite/babashka-server';

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  killed = false;
  kill(): boolean {
    this.killed = true;
    this.signalCode = 'SIGTERM';
    this.emit('close', null, 'SIGTERM');
    return true;
  }
}

function startOptions(child: FakeChild, overrides: Record<string, unknown> = {}) {
  return {
    executable: 'bb',
    cwd: '/fixture',
    getPort: () => Promise.resolve(12345),
    canConnect: () => Promise.resolve(false),
    timeoutMs: 20,
    intervalMs: 1,
    spawn: (() => child) as unknown as typeof cp.spawn,
    ...overrides,
  };
}

describe('Babashka E2E server startup', () => {
  it('waits for the port before returning and stops after success', async () => {
    const child = new FakeChild();
    let probes = 0;
    const result = await startBabashkaServer(
      startOptions(child, {
        canConnect: () => Promise.resolve(++probes > 1),
      })
    );
    assert.strictEqual(result.port, 12345);
    assert.strictEqual(result.process, child);
    await stopBabashkaProcess(child as unknown as cp.ChildProcessWithoutNullStreams);
    assert.strictEqual(child.killed, true);
  });

  it('reports a missing executable without spawning', async () => {
    await assert.rejects(
      startBabashkaServer(startOptions(new FakeChild(), { executable: undefined })),
      /executable `bb` was not found/
    );
  });

  it('reports spawn errors promptly and includes output while cleaning up', async () => {
    const child = new FakeChild();
    const options = startOptions(child);
    setImmediate(() => {
      child.stderr.write('spawn diagnostic');
      child.emit('error', new Error('ENOENT'));
    });
    await assert.rejects(
      startBabashkaServer(options),
      /Could not start Babashka: ENOENT[\s\S]*spawn diagnostic/
    );
    assert.strictEqual(child.killed, true);
  });

  it('reports early exit details and captured stdout and stderr', async () => {
    const child = new FakeChild();
    const options = startOptions(child);
    setImmediate(() => {
      child.stdout.write('bb starting');
      child.stderr.write('bind failed');
      child.exitCode = 7;
      child.emit('exit', 7, null);
    });
    await assert.rejects(
      startBabashkaServer(options),
      /exit code 7[\s\S]*bb starting[\s\S]*bind failed/
    );
  });

  it('does not signal a child that already exited before teardown', async () => {
    const child = new FakeChild();
    child.exitCode = 7;
    child.signalCode = null;
    await stopBabashkaProcess(child as unknown as cp.ChildProcessWithoutNullStreams);
    assert.strictEqual(child.killed, false);
  });

  it('times out with port and captured output and stops the process', async () => {
    const child = new FakeChild();
    const options = startOptions(child, { timeoutMs: 5 });
    child.stdout.write('still starting');
    await assert.rejects(startBabashkaServer(options), /port 12345[\s\S]*still starting/);
    assert.strictEqual(child.killed, true);
  });

  it('bounds captured stdout and stderr in startup failures', async () => {
    const child = new FakeChild();
    child.stdout.write('x'.repeat(5000));
    child.stderr.write('y'.repeat(5000));
    await assert.rejects(startBabashkaServer(startOptions(child)), (error: Error) => {
      const stdout = error.message.split('stdout:\n')[1].split('\nstderr:\n')[0];
      const stderr = error.message.split('\nstderr:\n')[1];
      assert.strictEqual(stdout.length, 4000);
      assert.strictEqual(stderr.length, 4000);
      return true;
    });
  });
});
