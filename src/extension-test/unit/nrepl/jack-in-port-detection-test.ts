import * as expectLib from 'expect';
import * as jackInPortDetection from '../../../../src/nrepl/jack-in-port-detection';

describe('jack-in port detection', () => {
  describe('parseReplStart', () => {
    it('parses localhost port output', () => {
      expectLib
        .expect(
          jackInPortDetection.parseReplStart(
            'nREPL server started on port 61419 on host localhost - nrepl://localhost:61419'
          )
        )
        .toStrictEqual({
          host: 'localhost',
          port: '61419',
          matchedText: 'nREPL server started on port 61419 on host localhost',
        });
    });

    it('parses host colon port output', () => {
      expectLib
        .expect(jackInPortDetection.parseReplStart('Started nREPL server at 127.0.0.1:1337'))
        .toStrictEqual({
          host: '127.0.0.1',
          port: '1337',
          matchedText: 'Started nREPL server at 127.0.0.1:1337',
        });
    });
  });

  describe('detectBufferedReplStart', () => {
    it('detects startup output that is split across stdout chunks', () => {
      const firstChunk = jackInPortDetection.detectBufferedReplStart(
        '',
        'nREPL server started on port 6141'
      );

      expectLib.expect(firstChunk.match).toBeUndefined();
      expectLib.expect(firstChunk.buffer).toBe('nREPL server started on port 6141');

      const secondChunk = jackInPortDetection.detectBufferedReplStart(
        firstChunk.buffer,
        '9 on host localhost - nrepl://localhost:61419\n'
      );

      expectLib.expect(secondChunk).toStrictEqual({
        buffer: '',
        match: {
          host: 'localhost',
          port: '61419',
          matchedText: 'nREPL server started on port 61419 on host localhost',
        },
      });
    });
  });
});
