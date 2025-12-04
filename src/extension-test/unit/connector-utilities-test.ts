import * as expect from 'expect';
import {
  buildDocsUrl,
  buildDisconnectItemLabel,
  buildDisconnectItemDescription,
  buildDisconnectItemDetail,
  formatHostPort,
  ClientDisplayInfo,
} from '../../connector-utilities';

describe('connector-utilities', () => {
  describe('buildDocsUrl', () => {
    it('returns base URL when no slug provided', () => {
      expect(buildDocsUrl()).toBe('https://calva.io/');
    });

    it('returns base URL for empty string', () => {
      expect(buildDocsUrl('')).toBe('https://calva.io/');
    });

    it('appends slug to base URL', () => {
      expect(buildDocsUrl('connect')).toBe('https://calva.io/connect');
    });

    it('handles slug with leading slash', () => {
      expect(buildDocsUrl('/connect')).toBe('https://calva.io/connect');
    });

    it('handles complex paths', () => {
      expect(buildDocsUrl('nrepl/connect-sequences')).toBe(
        'https://calva.io/nrepl/connect-sequences'
      );
    });
  });

  describe('buildDisconnectItemLabel', () => {
    it('uses connectSequenceName when available', () => {
      const client: ClientDisplayInfo = {
        key: 'client-abc',
        connectSequenceName: 'My Project REPL',
        sessionKeys: [],
      };
      expect(buildDisconnectItemLabel(client)).toBe('My Project REPL');
    });

    it('falls back to client key when no connectSequenceName', () => {
      const client: ClientDisplayInfo = {
        key: 'client-abc',
        sessionKeys: [],
      };
      expect(buildDisconnectItemLabel(client)).toBe('client-abc');
    });

    it('prefers connectSequenceName over key', () => {
      const client: ClientDisplayInfo = {
        key: 'boring-key',
        connectSequenceName: 'Descriptive Name',
        sessionKeys: ['clj', 'cljs'],
      };
      expect(buildDisconnectItemLabel(client)).toBe('Descriptive Name');
    });
  });

  describe('buildDisconnectItemDescription', () => {
    it('shows session summary only when no project root', () => {
      expect(buildDisconnectItemDescription(['clj', 'cljs'])).toBe('clj, cljs');
    });

    it('combines session summary and project root', () => {
      expect(buildDisconnectItemDescription(['clj'], 'my-project')).toBe('clj — my-project');
    });

    it('handles multiple sessions', () => {
      expect(buildDisconnectItemDescription(['clj', 'cljs', 'cljc'], 'proj')).toBe(
        'clj, cljs, cljc — proj'
      );
    });

    it('shows fallback message for empty sessions', () => {
      expect(buildDisconnectItemDescription([])).toBe('No sessions registered');
    });

    it('shows fallback message with project root for empty sessions', () => {
      expect(buildDisconnectItemDescription([], 'my-project')).toBe(
        'No sessions registered — my-project'
      );
    });
  });

  describe('buildDisconnectItemDetail', () => {
    it('returns undefined when no host', () => {
      expect(buildDisconnectItemDetail()).toBeUndefined();
    });

    it('returns undefined for empty host', () => {
      expect(buildDisconnectItemDetail('')).toBeUndefined();
    });

    it('returns host only when no port', () => {
      expect(buildDisconnectItemDetail('localhost')).toBe('localhost');
    });

    it('returns host:port when both provided', () => {
      expect(buildDisconnectItemDetail('localhost', 12345)).toBe('localhost:12345');
    });

    it('handles IP addresses', () => {
      expect(buildDisconnectItemDetail('127.0.0.1', 8080)).toBe('127.0.0.1:8080');
    });
  });

  describe('formatHostPort', () => {
    it('returns host only when no port', () => {
      expect(formatHostPort('localhost')).toBe('localhost');
    });

    it('returns host:port when both provided', () => {
      expect(formatHostPort('localhost', 12345)).toBe('localhost:12345');
    });

    it('handles IP addresses', () => {
      expect(formatHostPort('192.168.1.1', 3000)).toBe('192.168.1.1:3000');
    });
  });
});
