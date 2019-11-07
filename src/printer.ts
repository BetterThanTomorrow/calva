export type PrettyPrintingOptions = {
    enabled: boolean,
    clientOrServer: 'client' | 'server',
    width: number,
    serverPrinter?: 'pprint' | 'fipp' | 'puget' | 'zprint'
};

export const disabledPrettyPrinter: PrettyPrintingOptions = {
    enabled: false,
    clientOrServer: 'client',
    width: 0
};

export function getServerSidePrinter(pprintOptions: PrettyPrintingOptions) {
    if (pprintOptions.clientOrServer === 'server' && pprintOptions.enabled && pprintOptions.serverPrinter != undefined) {
        switch (pprintOptions.serverPrinter) {
            case "pprint":
                return {
                    'nrepl.middleware.print/print': 'cider.nrepl.pprint/pprint',
                    'nrepl.middleware.print/options': {
                        "right-margin": pprintOptions.width
                    }
                }
                break;
            case "fipp":
                return {
                    'nrepl.middleware.print/print': 'cider.nrepl.pprint/fipp-pprint',
                    'nrepl.middleware.print/options': {
                        "width": pprintOptions.width
                    }
                }
                break;
            case "puget":
                return {
                    'nrepl.middleware.print/print': 'cider.nrepl.pprint/puget-pprint',
                    'nrepl.middleware.print/options': {
                        "width": pprintOptions.width
                    }
                }
                break;
            case "zprint":
                return {
                    'nrepl.middleware.print/print': 'cider.nrepl.pprint/zprint-pprint',
                    'nrepl.middleware.print/options': {
                        "width": pprintOptions.width
                    }
                }
                break;
            default:
                return {};
                break;
        }
    }
    return {};
}