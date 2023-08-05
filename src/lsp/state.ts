import { get_state_value, set_state_value } from '../../out/cljs-lib/calva.state';
import { ClientProvider } from './provider';

const STATE_KEY = 'LSP_CLIENT_PROVIDER';

export const registerGlobally = (provider: ClientProvider) => {
  set_state_value(STATE_KEY, provider);
};

export const getClientProvider = (): ClientProvider => {
  const provider = get_state_value(STATE_KEY);
  if (!provider) {
    throw new Error('Failed to get LSP ClientProvider from global state');
  }
  return provider;
};
