export type DisconnectCommandOptions = {
  clientKey?: string;
  host?: string;
  port?: number;
  wsServerPort?: number;
  disconnectAll?: boolean;
};

export type DisconnectCommandPlan =
  | { action: 'forward'; options: DisconnectCommandOptions | null }
  | { action: 'unknown'; message: string };

export type DisconnectCommandDeps = {
  hasClient: (clientKey: string) => boolean;
  hasWsServerPort: (port: number) => boolean;
  hasHostPort: (host: string, port: number) => boolean;
};

const MULTI_TARGET_MESSAGE =
  'calva.disconnect accepts only one of clientKey, host and port, wsServerPort, or disconnectAll';

function readDisconnectCommandFields(raw: Record<string, unknown>): DisconnectCommandOptions {
  const options: DisconnectCommandOptions = {};
  if (typeof raw.clientKey === 'string') {
    options.clientKey = raw.clientKey;
  }
  if (typeof raw.host === 'string' && typeof raw.port === 'number') {
    options.host = raw.host;
    options.port = raw.port;
  }
  if (typeof raw.wsServerPort === 'number') {
    options.wsServerPort = raw.wsServerPort;
  }
  if (raw.disconnectAll === true) {
    options.disconnectAll = true;
  }
  return options;
}

function hasHostPortTarget(options: DisconnectCommandOptions): boolean {
  return options.host !== undefined && options.port !== undefined;
}

function hasDisconnectCommandField(options: DisconnectCommandOptions): boolean {
  return (
    options.clientKey !== undefined ||
    hasHostPortTarget(options) ||
    options.wsServerPort !== undefined ||
    options.disconnectAll !== undefined
  );
}

function isPlainOptionsArg(arg: unknown): arg is Record<string, unknown> {
  return arg !== null && typeof arg === 'object';
}

function countDisconnectTargets(options: DisconnectCommandOptions): number {
  return (
    (options.clientKey !== undefined ? 1 : 0) +
    (hasHostPortTarget(options) ? 1 : 0) +
    (options.wsServerPort !== undefined ? 1 : 0) +
    (options.disconnectAll !== undefined ? 1 : 0)
  );
}

function unknownHostPortMessage(
  host: string | undefined,
  port: number | undefined,
  hasHostPort: (host: string, port: number) => boolean
): string | undefined {
  if (host === undefined) {
    return undefined;
  }
  if (port === undefined) {
    return undefined;
  }
  if (hasHostPort(host, port)) {
    return undefined;
  }
  return `No Calva connection at ${host}:${port}`;
}

function unknownTargetMessage(
  options: DisconnectCommandOptions,
  deps: DisconnectCommandDeps
): string | undefined {
  if (options.clientKey !== undefined) {
    if (!deps.hasClient(options.clientKey)) {
      return `No Calva connection with clientKey ${options.clientKey}`;
    }
  }
  const hostPortMessage = unknownHostPortMessage(options.host, options.port, deps.hasHostPort);
  if (hostPortMessage) {
    return hostPortMessage;
  }
  if (options.wsServerPort !== undefined) {
    if (!deps.hasWsServerPort(options.wsServerPort)) {
      return `No WebSocket server on port ${options.wsServerPort}`;
    }
  }
  return undefined;
}

/**
 * Builds disconnect command options from the first VS Code command argument.
 * Only known fields with the right typeof are kept; a Uri or other junk yields null.
 * host and port are kept only as a pair (both correctly typed).
 */
export function parseDisconnectCommandOptions(arg: unknown): DisconnectCommandOptions | null {
  if (!isPlainOptionsArg(arg)) {
    return null;
  }
  const options = readDisconnectCommandFields(arg);
  return hasDisconnectCommandField(options) ? options : null;
}

/**
 * Decides whether to forward options into connector.disconnect or report an unknown target.
 */
export function planDisconnectCommand(
  options: DisconnectCommandOptions | null,
  deps: DisconnectCommandDeps
): DisconnectCommandPlan {
  if (!options) {
    return { action: 'forward', options: null };
  }
  if (countDisconnectTargets(options) > 1) {
    return { action: 'unknown', message: MULTI_TARGET_MESSAGE };
  }
  const message = unknownTargetMessage(options, deps);
  if (message) {
    return { action: 'unknown', message };
  }
  return { action: 'forward', options };
}
