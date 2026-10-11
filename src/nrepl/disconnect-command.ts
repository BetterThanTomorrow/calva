export type DisconnectCommandOptions = {
  clientKey?: string;
  wsServerPort?: number;
  disconnectAll?: boolean;
};

export type DisconnectCommandPlan =
  | { action: 'forward'; options: DisconnectCommandOptions | null }
  | { action: 'unknown'; message: string };

function readDisconnectCommandFields(raw: Record<string, unknown>): DisconnectCommandOptions {
  const options: DisconnectCommandOptions = {};
  if (typeof raw.clientKey === 'string') {
    options.clientKey = raw.clientKey;
  }
  if (typeof raw.wsServerPort === 'number') {
    options.wsServerPort = raw.wsServerPort;
  }
  if (raw.disconnectAll === true) {
    options.disconnectAll = true;
  }
  return options;
}

function hasDisconnectCommandField(options: DisconnectCommandOptions): boolean {
  return (
    options.clientKey !== undefined ||
    options.wsServerPort !== undefined ||
    options.disconnectAll !== undefined
  );
}

function isPlainOptionsArg(arg: unknown): arg is Record<string, unknown> {
  return arg !== null && typeof arg === 'object';
}

/**
 * Builds disconnect command options from the first VS Code command argument.
 * Only known fields with the right typeof are kept; a Uri or other junk yields null.
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
  deps: {
    hasClient: (clientKey: string) => boolean;
    hasWsServerPort: (port: number) => boolean;
  }
): DisconnectCommandPlan {
  if (!options) {
    return { action: 'forward', options: null };
  }
  const targetCount =
    (options.clientKey !== undefined ? 1 : 0) +
    (options.wsServerPort !== undefined ? 1 : 0) +
    (options.disconnectAll !== undefined ? 1 : 0);
  if (targetCount > 1) {
    return {
      action: 'unknown',
      message: 'calva.disconnect accepts only one of clientKey, wsServerPort, or disconnectAll',
    };
  }
  if (options.clientKey !== undefined && !deps.hasClient(options.clientKey)) {
    return {
      action: 'unknown',
      message: `No Calva connection with clientKey ${options.clientKey}`,
    };
  }
  if (options.wsServerPort !== undefined && !deps.hasWsServerPort(options.wsServerPort)) {
    return {
      action: 'unknown',
      message: `No WebSocket server on port ${options.wsServerPort}`,
    };
  }
  return { action: 'forward', options };
}
