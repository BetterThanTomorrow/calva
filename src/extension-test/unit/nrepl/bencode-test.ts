import * as expectLib from 'expect';
import * as bencode from '../../../nrepl/bencode';

function encode(value: any): string {
  const encoder = new bencode.BEncoderStream();
  let encoded = '';
  encoder.on('data', (chunk: string) => {
    encoded += chunk;
  });
  encoder.write(value);
  return encoded;
}

function decodeChunks(chunks: Buffer[]): any[] {
  const decoder = new bencode.BDecoderStream();
  const messages: any[] = [];
  decoder.on('data', (message: any) => {
    messages.push(message);
  });
  for (const chunk of chunks) {
    decoder.write(chunk);
  }
  return messages;
}

function decode(encoded: string): any[] {
  return decodeChunks([Buffer.from(encoded, 'utf8')]);
}

describe('bencode', () => {
  describe('encode and decode', () => {
    it('encodes strings with a utf-8 byte length', () => {
      expectLib.expect(encode('hello')).toEqual('5:hello');
      expectLib.expect(encode('')).toEqual('0:');
      expectLib.expect(encode('héllo')).toEqual('6:héllo');
      expectLib.expect(decode('d1:a0:e')).toEqual([{ a: '' }]);
      expectLib.expect(decode('6:héllo')).toEqual(['héllo']);
    });

    it('encodes and decodes integers', () => {
      expectLib.expect(encode(42)).toEqual('i42e');
      expectLib.expect(decode('i42e')).toEqual([42]);
      expectLib.expect(decode('i-3e')).toEqual([-3]);
    });

    it('encodes null, undefined, and booleans as integers', () => {
      expectLib.expect(encode({ a: null })).toEqual('d1:ai0ee');
      expectLib.expect(encode({ a: undefined })).toEqual('d1:ai0ee');
      expectLib.expect(encode({ a: false })).toEqual('d1:ai0ee');
      expectLib.expect(encode({ a: true })).toEqual('d1:ai1ee');
    });

    it('encodes and decodes lists', () => {
      expectLib.expect(encode([1, 'ab'])).toEqual('li1e2:abe');
      expectLib.expect(decode('le')).toEqual([[]]);
    });

    it('encodes and decodes an empty dict', () => {
      expectLib.expect(encode({})).toEqual('de');
      expectLib.expect(decode('de')).toEqual([{}]);
    });

    it('decodes an nREPL response', () => {
      const encoded = 'd2:id1:16:statusl4:donee5:value2:42e';
      expectLib.expect(decode(encoded)).toEqual([{ id: '1', status: ['done'], value: '42' }]);
    });

    it('decodes consecutive values from one chunk', () => {
      expectLib.expect(decode('i1ei2e')).toEqual([1, 2]);
    });

    it('decodes a dict split across chunks', () => {
      const messages = decodeChunks([Buffer.from('d4:code7:(+ 1'), Buffer.from(' 2)e')]);
      expectLib.expect(messages).toEqual([{ code: '(+ 1 2)' }]);
    });

    it('decodes dict keys in arrival order', () => {
      expectLib.expect(decode('d2:op4:eval2:id1:1e')).toEqual([{ op: 'eval', id: '1' }]);
    });

    it('rejects malformed input', () => {
      expectLib.expect(() => decode('x')).toThrow('Malformed input in bencode');
    });

    it('round-trips an eval message', () => {
      const message = { op: 'eval', code: '(+ 1 2)', id: '1', session: 'abc', ns: 'user' };
      expectLib
        .expect(decode(encode(message)))
        .toEqual([{ op: 'eval', code: '(+ 1 2)', id: '1', session: 'abc', ns: 'user' }]);
    });
  });

  describe('dict key order', () => {
    it('sorts dict keys', () => {
      const encoded = encode({ op: 'eval', code: '*ns*', id: '1' });
      expectLib.expect(encoded).toEqual('d4:code4:*ns*2:id1:12:op4:evale');
      expectLib.expect(encode({ id: '1', code: '*ns*', op: 'eval' })).toEqual(encoded);
    });

    it('sorts keys in nested dicts', () => {
      const encoded = encode({ op: 'eval', opts: { verbose: true, level: 3 } });
      expectLib.expect(encoded).toEqual('d2:op4:eval4:optsd5:leveli3e7:verbosei1eee');
    });
  });
});
