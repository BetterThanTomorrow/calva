import * as state from '../../out/cljs-lib/cljs-lib';
import { ClientProvider } from './provider';

const STATE_KEY = 'LSP_CLIENT_PROVIDER';

export const registerGlobally = (provider: ClientProvider) => {
  state.setStateValue(STATE_KEY, provider);
};

export const getClientProvider = (): ClientProvider => {
  const provider = state.getStateValue(STATE_KEY);
  if (!provider) {
    throw new Error('Failed to get LSP ClientProvider from global state');
  }
  return provider;
};
