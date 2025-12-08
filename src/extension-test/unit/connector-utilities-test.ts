import * as expect from 'expect';
import * as connectorUtils from '../../connector-utilities';

describe('connector-utilities', () => {
  describe('buildDisconnectItemLabel', () => {
    it('uses connectSequenceName when available', () => {
      const client: connectorUtils.ClientDisplayInfo = {
        key: 'client-abc',
        connectSequenceName: 'My Project REPL',
        sessionKeys: [],
      };
      expect(connectorUtils.buildDisconnectItemLabel(client)).toBe('My Project REPL');
    });

    it('falls back to client key when no connectSequenceName', () => {
      const client: connectorUtils.ClientDisplayInfo = {
        key: 'client-abc',
        sessionKeys: [],
      };
      expect(connectorUtils.buildDisconnectItemLabel(client)).toBe('client-abc');
    });

    it('prefers connectSequenceName over key', () => {
      const client: connectorUtils.ClientDisplayInfo = {
        key: 'boring-key',
        connectSequenceName: 'Descriptive Name',
        sessionKeys: ['clj', 'cljs'],
      };
      expect(connectorUtils.buildDisconnectItemLabel(client)).toBe('Descriptive Name');
    });
  });

  describe('buildDisconnectItemDescription', () => {
    it('shows session summary only when no project root', () => {
      expect(connectorUtils.buildDisconnectItemDescription(['clj', 'cljs'])).toBe('clj, cljs');
    });

    it('combines session summary and project root', () => {
      expect(connectorUtils.buildDisconnectItemDescription(['clj'], 'my-project')).toBe(
        'clj — my-project'
      );
    });

    it('handles multiple sessions', () => {
      expect(connectorUtils.buildDisconnectItemDescription(['clj', 'cljs', 'cljc'], 'proj')).toBe(
        'clj, cljs, cljc — proj'
      );
    });

    it('shows fallback message for empty sessions', () => {
      expect(connectorUtils.buildDisconnectItemDescription([])).toBe('No sessions registered');
    });

    it('shows fallback message with project root for empty sessions', () => {
      expect(connectorUtils.buildDisconnectItemDescription([], 'my-project')).toBe(
        'No sessions registered — my-project'
      );
    });
  });

  describe('buildDisconnectItemDetail', () => {
    it('returns undefined when no host', () => {
      expect(connectorUtils.buildDisconnectItemDetail()).toBeUndefined();
    });

    it('returns undefined for empty host', () => {
      expect(connectorUtils.buildDisconnectItemDetail('')).toBeUndefined();
    });

    it('returns host only when no port', () => {
      expect(connectorUtils.buildDisconnectItemDetail('localhost')).toBe('localhost');
    });

    it('returns host:port when both provided', () => {
      expect(connectorUtils.buildDisconnectItemDetail('localhost', 12345)).toBe('localhost:12345');
    });

    it('handles IP addresses', () => {
      expect(connectorUtils.buildDisconnectItemDetail('127.0.0.1', 8080)).toBe('127.0.0.1:8080');
    });
  });
});
