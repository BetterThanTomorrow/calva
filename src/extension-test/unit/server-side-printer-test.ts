import * as expectLib from 'expect';
import * as serverSidePrinter from '../../server-side-printer';
import type * as printer from '../../printer';

const PRINT_FN = 'nrepl.middleware.print/print';
const OPTIONS = 'nrepl.middleware.print/options';

const ciderNrepl = (major: number, minor: number) => ({ major, minor });

const options = (printEngine: printer.PrettyPrintingOptions['printEngine']) => ({
  enabled: true,
  printEngine,
  width: 120,
  maxLength: 50,
  maxDepth: 10,
});

describe('server-side-printer', () => {
  describe('getServerSidePrinter', () => {
    it('uses clojure-pprint for the pprint engine with cider-nrepl 0.61 and later', () => {
      for (const version of [ciderNrepl(0, 61), ciderNrepl(0, 62), ciderNrepl(1, 0)]) {
        expectLib
          .expect(serverSidePrinter.getServerSidePrinter(options('pprint'), version))
          .toEqual({
            [PRINT_FN]: 'cider.nrepl.pprint/clojure-pprint',
            [OPTIONS]: { 'right-margin': 120, length: 50, level: 10 },
          });
      }
    });

    it('uses pprint for the pprint engine with cider-nrepl before 0.61', () => {
      expectLib
        .expect(serverSidePrinter.getServerSidePrinter(options('pprint'), ciderNrepl(0, 58)))
        .toEqual({
          [PRINT_FN]: 'cider.nrepl.pprint/pprint',
          [OPTIONS]: { 'right-margin': 120, length: 50, level: 10 },
        });
    });

    it('treats a server without a cider-nrepl version as older than 0.61', () => {
      expectLib
        .expect(serverSidePrinter.getServerSidePrinter(options('pprint'), undefined))
        .toEqual({
          [PRINT_FN]: 'cider.nrepl.pprint/pprint',
          [OPTIONS]: { 'right-margin': 120, length: 50, level: 10 },
        });
    });

    it('uses orchard-pprint for the orchard engine, with the common options from 0.61', () => {
      expectLib
        .expect(serverSidePrinter.getServerSidePrinter(options('orchard'), ciderNrepl(0, 62)))
        .toEqual({
          [PRINT_FN]: 'cider.nrepl.pprint/orchard-pprint',
          [OPTIONS]: { 'right-margin': 120, length: 50, level: 10 },
        });
    });

    it('sends only max-width to orchard-pprint before cider-nrepl 0.61', () => {
      expectLib
        .expect(serverSidePrinter.getServerSidePrinter(options('orchard'), ciderNrepl(0, 58)))
        .toEqual({
          [PRINT_FN]: 'cider.nrepl.pprint/orchard-pprint',
          [OPTIONS]: { 'max-width': 120 },
        });
    });

    it('uses printFn regardless of engine and cider-nrepl version', () => {
      expectLib
        .expect(
          serverSidePrinter.getServerSidePrinter(
            {
              ...options('pprint'),
              printFn: {
                name: 'my.ns/print',
                maxWidthArgument: 'width',
                maxDepthArgument: undefined,
              },
            },
            ciderNrepl(0, 62)
          )
        )
        .toEqual({ [PRINT_FN]: 'my.ns/print', [OPTIONS]: { width: 120 } });
    });

    it('maps fipp, puget and zprint to their cider-nrepl printers and options', () => {
      expectLib
        .expect(serverSidePrinter.getServerSidePrinter(options('fipp'), ciderNrepl(0, 62)))
        .toEqual({
          [PRINT_FN]: 'cider.nrepl.pprint/fipp-pprint',
          [OPTIONS]: { width: 120, 'print-length': 50, 'print-level': 10 },
        });
      expectLib
        .expect(serverSidePrinter.getServerSidePrinter(options('puget'), ciderNrepl(0, 62)))
        .toEqual({
          [PRINT_FN]: 'cider.nrepl.pprint/puget-pprint',
          [OPTIONS]: { width: 120, 'seq-limit': 50 },
        });
      expectLib
        .expect(serverSidePrinter.getServerSidePrinter(options('zprint'), ciderNrepl(0, 62)))
        .toEqual({
          [PRINT_FN]: 'cider.nrepl.pprint/zprint-pprint',
          [OPTIONS]: { width: 120, 'max-length': 50, 'print-depth': 10 },
        });
    });

    it('leaves printing to the client for the calva engine', () => {
      expectLib
        .expect(serverSidePrinter.getServerSidePrinter(options('calva'), ciderNrepl(0, 62)))
        .toBeUndefined();
    });
  });
});
