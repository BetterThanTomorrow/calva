export type PrettyPrintingOptions = { enabled: boolean, clientOrServer: 'client' | 'server' };

export const disabledPrettyPrinter: PrettyPrintingOptions = { enabled: false, clientOrServer: 'client'}