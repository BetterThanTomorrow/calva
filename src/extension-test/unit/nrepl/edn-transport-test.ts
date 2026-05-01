import * as expectLib from 'expect';
import * as ednTransport from '../../../nrepl/edn-transport';

describe('edn-transport', () => {
  describe('ednEncodeNReplMessage', () => {
    it('encodes eval request', () => {
      const msg = { op: 'eval', code: '(+ 1 2)', id: '1', session: 'abc-123', ns: 'user' };
      const edn = ednTransport.ednEncodeNReplMessage(msg);
      expectLib
        .expect(edn)
        .toEqual('{:op :eval :code "(+ 1 2)" :id "1" :session "abc-123" :ns "user"}');
    });

    it('encodes clone request', () => {
      const msg = { op: 'clone', id: '2' };
      const edn = ednTransport.ednEncodeNReplMessage(msg);
      expectLib.expect(edn).toEqual('{:op :clone :id "2"}');
    });

    it('encodes status array with keyword items', () => {
      const msg = { id: '1', status: ['done'], value: '42' };
      const edn = ednTransport.ednEncodeNReplMessage(msg);
      expectLib.expect(edn).toContain(':status [:done]');
    });

    it('encodes nil values', () => {
      const msg = { id: '1', value: null };
      const edn = ednTransport.ednEncodeNReplMessage(msg);
      expectLib.expect(edn).toContain(':value nil');
    });

    it('encodes numbers', () => {
      const msg = { op: 'eval', line: 42 };
      const edn = ednTransport.ednEncodeNReplMessage(msg);
      expectLib.expect(edn).toContain(':line 42');
    });

    it('escapes backslashes and quotes in strings', () => {
      const msg = { op: 'eval', code: 'say "hello"' };
      const edn = ednTransport.ednEncodeNReplMessage(msg);
      expectLib.expect(edn).toContain(':code "say \\"hello\\""');
    });

    it('handles empty map', () => {
      const edn = ednTransport.ednEncodeNReplMessage({});
      expectLib.expect(edn).toEqual('{}');
    });

    it('encodes boolean values', () => {
      const msg = { op: 'eval', pprint: true };
      const edn = ednTransport.ednEncodeNReplMessage(msg);
      expectLib.expect(edn).toContain(':pprint true');
    });

    it('encodes undefined values as nil', () => {
      const msg = { id: '1', value: undefined };
      const edn = ednTransport.ednEncodeNReplMessage(msg);
      expectLib.expect(edn).toContain(':value nil');
    });

    it('encodes multiple status keywords', () => {
      const msg = { id: '1', status: ['eval-error', 'done'] };
      const edn = ednTransport.ednEncodeNReplMessage(msg);
      expectLib.expect(edn).toContain(':status [:eval-error :done]');
    });

    it('encodes nested maps', () => {
      const msg = { op: 'eval', opts: { verbose: true, level: 3 } };
      const edn = ednTransport.ednEncodeNReplMessage(msg);
      expectLib.expect(edn).toContain(':opts {:verbose true :level 3}');
    });
  });

  describe('ednDecodeNReplMessage', () => {
    it('decodes eval response', () => {
      const edn = '{:id "1" :session "abc" :value "42" :ns "user" :status [:done]}';
      const msg = ednTransport.ednDecodeNReplMessage(edn);
      expectLib.expect(msg.id).toEqual('1');
      expectLib.expect(msg.session).toEqual('abc');
      expectLib.expect(msg.value).toEqual('42');
      expectLib.expect(msg.ns).toEqual('user');
      expectLib.expect(msg.status).toEqual(['done']);
    });

    it('strips keyword colons from keys and keyword values', () => {
      const edn = '{:op :eval :code "(+ 1 2)"}';
      const msg = ednTransport.ednDecodeNReplMessage(edn);
      expectLib.expect(msg.op).toEqual('eval');
      expectLib.expect(msg.code).toEqual('(+ 1 2)');
    });

    it('handles nil values', () => {
      const edn = '{:value nil :status [:done]}';
      const msg = ednTransport.ednDecodeNReplMessage(edn);
      expectLib.expect(msg.value).toEqual(null);
    });

    it('handles nested maps', () => {
      const edn = '{:ops {:eval {} :info {}}}';
      const msg = ednTransport.ednDecodeNReplMessage(edn);
      expectLib.expect(msg.ops).toEqual({ eval: {}, info: {} });
    });
  });

  describe('round-trip', () => {
    it('encode then decode preserves eval request structure', () => {
      const original = { op: 'eval', code: '(+ 1 2)', id: '1', session: 'abc', ns: 'user' };
      const encoded = ednTransport.ednEncodeNReplMessage(original);
      const decoded = ednTransport.ednDecodeNReplMessage(encoded);
      expectLib.expect(decoded.op).toEqual(original.op);
      expectLib.expect(decoded.code).toEqual(original.code);
      expectLib.expect(decoded.id).toEqual(original.id);
      expectLib.expect(decoded.session).toEqual(original.session);
      expectLib.expect(decoded.ns).toEqual(original.ns);
    });
  });
});
