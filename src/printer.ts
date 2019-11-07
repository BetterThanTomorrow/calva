export type PrettyPrintingOptions = { 
    enabled: boolean, 
    clientOrServer: 'client' | 'server',
    width: number
};

export const disabledPrettyPrinter: PrettyPrintingOptions = { enabled: false, clientOrServer: 'client', width: 0 }