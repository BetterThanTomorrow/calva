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

function getPrinter(pprintOptions: PrettyPrintingOptions, printerFn: string, widthSlug: string, lengthSlug: string, depthsSlug: string) {
    const PRINTER_FN = 'nrepl.middleware.print/print',
        OPTIONS = 'nrepl.middleware.print/options';
    let printer = {};
    printer[OPTIONS] = {};
    printer[PRINTER_FN] = printerFn;
    printer[OPTIONS][widthSlug] = pprintOptions.width;
    if (pprintOptions.maxLength) {
        printer[OPTIONS][lengthSlug] = pprintOptions.maxLength;
    }
    if (pprintOptions.maxDepth) {
        printer[OPTIONS][depthsSlug] = pprintOptions.maxDepth;
    }
    return printer;
}

export function getServerSidePrinter(pprintOptions: PrettyPrintingOptions) {
    if (pprintOptions.clientOrServer === 'server' && pprintOptions.enabled && pprintOptions.serverPrinter != undefined) {
        switch (pprintOptions.serverPrinter) {
            case "pprint":
                return getPrinter(pprintOptions, 'cider.nrepl.pprint/pprint', 'right-margin', 'length', 'level');
            case "fipp":
                return getPrinter(pprintOptions, 'cider.nrepl.pprint/fipp-pprint', 'width', 'print-length', 'print-level');
            case "puget":
                return getPrinter(pprintOptions, 'cider.nrepl.pprint/puget-pprint', 'width', 'seq-limit', 'does-not-exist');
            case "zprint":
                return getPrinter(pprintOptions, 'cider.nrepl.pprint/zprint-pprint', 'width', 'max-length', 'print-depth');
            default:
                return {};
        }
    }
    return {};
}