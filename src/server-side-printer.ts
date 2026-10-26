import type * as printer from './printer';

export type CiderNreplVersion = { major: number; minor: number };

type ServerPrinter = printer.PrintFnOptions & { extraOptions?: Record<string, unknown> };

const zprintExtraOptions = {
  // Can't do this, because `bencode` translates `false` to 0, and `zprint` does not approve (yet, Kim is looking into relaxing this)
  // "record": {
  //     "to-string?": true
  // }
};

const pprintArguments = {
  maxWidthArgument: 'right-margin',
  seqLimitArgument: 'length',
  maxDepthArgument: 'level',
};

// cider-nrepl 0.61 backed `pprint` with orchard.pp, kept clojure.pprint as `clojure-pprint`,
// and made `orchard-pprint` take the same options as the other printers.
function hasClojurePprint(ciderVersion?: CiderNreplVersion) {
  return ciderVersion !== undefined && (ciderVersion.major > 0 || ciderVersion.minor >= 61);
}

function enginePrinters(
  ciderVersion?: CiderNreplVersion
): Partial<Record<printer.PrettyPrintingOptions['printEngine'], ServerPrinter>> {
  const withClojurePprint = hasClojurePprint(ciderVersion);
  return {
    pprint: {
      name: withClojurePprint ? 'cider.nrepl.pprint/clojure-pprint' : 'cider.nrepl.pprint/pprint',
      ...pprintArguments,
    },
    orchard: withClojurePprint
      ? { name: 'cider.nrepl.pprint/orchard-pprint', ...pprintArguments }
      : {
          name: 'cider.nrepl.pprint/orchard-pprint',
          maxWidthArgument: 'max-width',
          maxDepthArgument: undefined,
        },
    fipp: {
      name: 'cider.nrepl.pprint/fipp-pprint',
      maxWidthArgument: 'width',
      seqLimitArgument: 'print-length',
      maxDepthArgument: 'print-level',
    },
    puget: {
      name: 'cider.nrepl.pprint/puget-pprint',
      maxWidthArgument: 'width',
      seqLimitArgument: 'seq-limit',
      maxDepthArgument: undefined,
    },
    zprint: {
      name: 'cider.nrepl.pprint/zprint-pprint',
      maxWidthArgument: 'width',
      seqLimitArgument: 'max-length',
      maxDepthArgument: 'print-depth',
      extraOptions: zprintExtraOptions,
    },
  };
}

function printerOptions(
  pprintOptions: printer.PrettyPrintingOptions,
  { maxWidthArgument, seqLimitArgument, maxDepthArgument, extraOptions = {} }: ServerPrinter
) {
  const options: Record<string, unknown> = { ...extraOptions };
  if (maxWidthArgument !== undefined) {
    options[maxWidthArgument] = pprintOptions.width;
  }
  if (pprintOptions.maxLength && seqLimitArgument !== undefined) {
    options[seqLimitArgument] = pprintOptions.maxLength;
  }
  if (pprintOptions.maxDepth && maxDepthArgument !== undefined) {
    options[maxDepthArgument] = pprintOptions.maxDepth;
  }
  return options;
}

export function getServerSidePrinter(
  pprintOptions: printer.PrettyPrintingOptions,
  ciderVersion?: CiderNreplVersion
) {
  const serverPrinter =
    pprintOptions.printFn ??
    (pprintOptions.enabled ? enginePrinters(ciderVersion)[pprintOptions.printEngine] : undefined);
  if (serverPrinter) {
    return {
      'nrepl.middleware.print/print': serverPrinter.name,
      'nrepl.middleware.print/options': printerOptions(pprintOptions, serverPrinter),
    };
  }
}
