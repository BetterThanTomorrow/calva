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
});
