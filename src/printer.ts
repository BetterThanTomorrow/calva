import * as config from './config';
import * as utilities from './utilities';
import * as calvaLib from '../out/cljs-lib/cljs-lib';

export type PrintFnOptions = {
  name: string;
  maxWidthArgument?: string;
  seqLimitArgument?: string;
  maxDepthArgument: string;
};

export type PrettyPrintingOptions = {
  enabled: boolean;
  printFn?: PrintFnOptions;
  printEngine?: 'calva' | 'pprint' | 'orchard' | 'fipp' | 'puget' | 'zprint' | 'custom';
  width?: number;
  maxLength?: number;
  maxDepth?: number;
};

export const disabledPrettyPrinter: PrettyPrintingOptions = {
  enabled: false,
  printEngine: undefined,
  width: undefined,
  maxLength: undefined,
  maxDepth: undefined,
};

export function prettyPrintingOptions(): PrettyPrintingOptions | undefined {
  return config.getConfig().prettyPrintingOptions;
}

export const zprintDependencies = {
  zprint: '0.4.16',
};

export function getServerSidePrinterDependencies() {
  const options = prettyPrintingOptions();
  utilities.assertIsDefined(options, 'Expected prettyPrintingOptions to be defined!');

  if (options.printEngine === 'zprint') {
    return zprintDependencies;
  } else {
    return {};
  }
}

export function prettyPrint(value: any, options: any = prettyPrintingOptions()) {
  const optionsClone = JSON.parse(JSON.stringify(options));
  delete optionsClone['printFn']; // Zprint croaks on options it doesn't understand
  return calvaLib.prettyPrint(value, optionsClone);
}
