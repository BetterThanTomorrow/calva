import * as clientRegistry from './client-registry';
import * as sessionRegistry from './session-registry';

export type ReplConnectionInfo = {
  clientKey: string;
  host?: string;
  port?: number;
  projectRoot?: string;
  replSessionKeys: string[];
};

/**
 * One entry per registered nREPL connection from the client registry.
 * projectRoot is the connection's own root string; no global project-root read.
 */
export function listConnections(): ReplConnectionInfo[] {
  return clientRegistry.listClients().map((client) => ({
    clientKey: client.key,
    host: client.host,
    port: client.port,
    projectRoot: client.projectRoot,
    replSessionKeys: sessionRegistry.listSessionsByClient(client.key).map((session) => session.key),
  }));
}
