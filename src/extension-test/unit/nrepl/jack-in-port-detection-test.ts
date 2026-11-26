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

  describe('parsePortInUse', () => {
    it('parses the Jetty bind failure', () => {
      expectLib
        .expect(
          jackInPortDetection.parsePortInUse(
            'Caused by: java.io.IOException: Failed to bind to /127.0.0.1:4242'
          )
        )
        .toBe(4242);
    });

    it('parses the Node.js EADDRINUSE error', () => {
      expectLib
        .expect(
          jackInPortDetection.parsePortInUse(
            'Error: listen EADDRINUSE: address already in use :::8280'
          )
        )
        .toBe(8280);
    });

    it('parses the port already in use message', () => {
      expectLib
        .expect(jackInPortDetection.parsePortInUse('Port 9630 is already in use.'))
        .toBe(9630);
    });

    it('ignores a bind failure without a port', () => {
      expectLib
        .expect(
          jackInPortDetection.parsePortInUse('java.net.BindException: Address already in use')
        )
        .toBeUndefined();
    });

    it('ignores regular output', () => {
      expectLib
        .expect(
          jackInPortDetection.parsePortInUse(
            'nREPL server started on port 61419 on host localhost - nrepl://localhost:61419'
          )
        )
        .toBeUndefined();
    });
  });
});
