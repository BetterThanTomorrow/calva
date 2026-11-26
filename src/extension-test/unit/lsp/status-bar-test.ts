import { expect } from 'expect';
import { LspStatus } from '../../../lsp/definitions';
import { statusFor } from '../../../lsp/status-bar';

const input = {
  statuses: [LspStatus.Running, LspStatus.Stopped],
  downloadFailed: false,
  currentFileIsClojure: true,
  currentFileClientStatus: LspStatus.Stopped,
};

describe('lsp status bar', () => {
  describe('statusFor', () => {
    it('shows the status of the current file’s client among several', () => {
      expect(statusFor(input)).toBe(LspStatus.Stopped);
      expect(statusFor({ ...input, currentFileClientStatus: LspStatus.Running })).toBe(
        LspStatus.Running
      );
    });

    it('shows Stopped for a Clojure file without a client', () => {
      expect(statusFor({ ...input, currentFileClientStatus: undefined })).toBe(LspStatus.Stopped);
    });

    it('shows the only client’s status when the current file is not a Clojure file', () => {
      expect(
        statusFor({
          ...input,
          statuses: [LspStatus.Running],
          currentFileIsClojure: false,
          currentFileClientStatus: undefined,
        })
      ).toBe(LspStatus.Running);
    });

    it('shows Unknown for a file that is not a Clojure file with several clients or none', () => {
      const notClojure = {
        ...input,
        currentFileIsClojure: false,
        currentFileClientStatus: undefined,
      };
      expect(statusFor(notClojure)).toBe(LspStatus.Unknown);
      expect(statusFor({ ...notClojure, statuses: [] })).toBe(LspStatus.Unknown);
    });

    it('shows Starting while any client starts', () => {
      expect(statusFor({ ...input, statuses: [LspStatus.Running, LspStatus.Starting] })).toBe(
        LspStatus.Starting
      );
    });

    it('shows DownloadFailed when the download failed and there are no clients', () => {
      expect(statusFor({ ...input, statuses: [], downloadFailed: true })).toBe(
        LspStatus.DownloadFailed
      );
      expect(statusFor({ ...input, downloadFailed: true })).toBe(LspStatus.Stopped);
    });
  });
});
