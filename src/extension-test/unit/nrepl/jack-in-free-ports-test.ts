import * as expectLib from 'expect';
import * as jackInFreePorts from '../../../../src/nrepl/jack-in-free-ports';

describe('jack-in free ports', () => {
  describe('parseLsofPids', () => {
    it('parses one pid per line and drops duplicates', () => {
      expectLib
        .expect(jackInFreePorts.parseLsofPids('47618\n47618\n23712\n'))
        .toStrictEqual([47618, 23712]);
    });

    it('returns no pids for empty output', () => {
      expectLib.expect(jackInFreePorts.parseLsofPids('')).toStrictEqual([]);
    });
  });

  describe('parseNetstatListeningPids', () => {
    const netstatOutput = [
      'Active Connections',
      '',
      '  Proto  Local Address          Foreign Address        State           PID',
      '  TCP    0.0.0.0:4242           0.0.0.0:0              LISTENING       1234',
      '  TCP    [::]:4242              [::]:0                 LISTENING       1234',
      '  TCP    127.0.0.1:42420        0.0.0.0:0              LISTENING       5678',
      '  TCP    127.0.0.1:4242         127.0.0.1:50000        ESTABLISHED     9999',
    ].join('\r\n');

    it('returns the pids listening on the exact port', () => {
      expectLib
        .expect(jackInFreePorts.parseNetstatListeningPids(netstatOutput, 4242))
        .toStrictEqual([1234]);
    });

    it('returns no pids when nothing listens on the port', () => {
      expectLib
        .expect(jackInFreePorts.parseNetstatListeningPids(netstatOutput, 7888))
        .toStrictEqual([]);
    });
  });

  describe('parseProcessParents', () => {
    it('parses pid and parent pid pairs from ps and PowerShell output', () => {
      expectLib
        .expect(jackInFreePorts.parseProcessParents('    1     0\n  412     1\r\n 5120  412\n'))
        .toStrictEqual([
          { pid: 1, parentPid: 0 },
          { pid: 412, parentPid: 1 },
          { pid: 5120, parentPid: 412 },
        ]);
    });

    it('drops lines that are not pid pairs', () => {
      expectLib.expect(jackInFreePorts.parseProcessParents('\nPID PPID\n')).toStrictEqual([]);
    });
  });

  describe('descendantPids', () => {
    const parents = [
      { pid: 1, parentPid: 0 },
      { pid: 100, parentPid: 1 },
      { pid: 101, parentPid: 100 },
      { pid: 102, parentPid: 101 },
      { pid: 200, parentPid: 1 },
    ];

    it('includes the root and all its descendants', () => {
      expectLib
        .expect(jackInFreePorts.descendantPids({ parents, rootPid: 100 }))
        .toStrictEqual(new Set([100, 101, 102]));
    });

    it('excludes processes outside the tree', () => {
      expectLib
        .expect(jackInFreePorts.descendantPids({ parents, rootPid: 100 }).has(200))
        .toBe(false);
    });

    it('returns only the root when it has no children', () => {
      expectLib
        .expect(jackInFreePorts.descendantPids({ parents, rootPid: 999 }))
        .toStrictEqual(new Set([999]));
    });
  });
});
