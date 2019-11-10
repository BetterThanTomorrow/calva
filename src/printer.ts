import * as state from './state';

export type PrettyPrintingOptions = {
    enabled: boolean,
    clientOrServer: 'client' | 'server',
    width: number,
    maxLength?: number,
    maxDepth?: number,
    serverPrinter?: 'pprint' | 'fipp' | 'puget' | 'zprint'
};

export const disabledPrettyPrinter: PrettyPrintingOptions = {
    enabled: false,
    clientOrServer: 'client',
    width: 0,
    maxLength: 0,
    maxDepth: 0
};

function getPrinter(pprintOptions: PrettyPrintingOptions, printerFn: string, widthSlug: string, lengthSlug: string, depthsSlug: string, moreOptions = {}) {
    const PRINTER_FN = 'nrepl.middleware.print/print',
        OPTIONS = 'nrepl.middleware.print/options';
    let printer = {};
    printer[OPTIONS] = moreOptions;
    printer[PRINTER_FN] = printerFn;
    printer[OPTIONS][widthSlug] = pprintOptions.width;
    if (pprintOptions.maxLength && lengthSlug !== undefined) {
        printer[OPTIONS][lengthSlug] = pprintOptions.maxLength;
    }
    if (pprintOptions.maxDepth && depthsSlug !== undefined) {
        printer[OPTIONS][depthsSlug] = pprintOptions.maxDepth;
    }
    return printer;
}

const zprintExtraOptions = {
    // Can't do this, because `bencode` translates `false` to 0, and `zprint` does not approve (yet, Kim is looking into relaxing this)
    // "record": { 
    //     "to-string?": true
    // }
}

export function getServerSidePrinter(pprintOptions: PrettyPrintingOptions) {
    if (pprintOptions.clientOrServer === 'server' && pprintOptions.enabled && pprintOptions.serverPrinter != undefined) {
        switch (pprintOptions.serverPrinter) {
            case "pprint":
                return getPrinter(pprintOptions, 'cider.nrepl.pprint/pprint', 'right-margin', 'length', 'level');
            case "fipp":
                return getPrinter(pprintOptions, 'cider.nrepl.pprint/fipp-pprint', 'width', 'print-length', 'print-level');
            case "puget":
                return getPrinter(pprintOptions, 'cider.nrepl.pprint/puget-pprint', 'width', 'seq-limit', undefined);
            case "zprint":
                return getPrinter(pprintOptions, 'cider.nrepl.pprint/zprint-pprint', 'width', 'max-length', 'print-depth', zprintExtraOptions);
            default:
                return undefined;
        }
    }
    return undefined;
}

export function prettyPrintingOptions(): PrettyPrintingOptions {
    return state.config().prettyPrintingOptions;
}

export const zprintDependencies = {
    "zprint": "0.4.16"
}