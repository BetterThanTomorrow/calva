import WebSocket = require('ws');
import { AddressInfo } from 'net';

export class WsPortInUseError extends Error {
  constructor(public readonly port: number) {
    super(`WebSocket port ${port} is in use`);
    this.name = 'WsPortInUseError';
  }
}

export class NReplWsServer {
  private wss: WebSocket.Server | null = null;
  private client: WebSocket | null = null;
  private _port: number;
  private _host: string;
  private connectionHandlers: Array<(socket: WebSocket) => void> = [];
  private disconnectionHandlers: Array<() => void> = [];
  private messageHandlers: Array<(msg: string) => void> = [];
  private errorHandlers: Array<(err: Error) => void> = [];

  constructor(port: number, host: string = '127.0.0.1') {
    this._port = port;
    this._host = host;
  }

  get port(): number {
    return this._port;
  }

  get host(): string {
    return this._host;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocket.Server({
        port: this._port,
        host: this._host,
        path: '/_nrepl',
      });

      this.wss.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new WsPortInUseError(this._port));
        } else {
          this.errorHandlers.forEach((h) => h(err));
          reject(err);
        }
      });

      this.wss.on('listening', () => {
        const addr = this.wss.address() as AddressInfo;
        if (addr && typeof addr === 'object') {
          this._port = addr.port;
        }
        resolve();
      });

      this.wss.on('connection', (socket: WebSocket) => {
        // Single-client: replace previous connection
        if (this.client) {
          try {
            this.client.close();
          } catch (_) {
            /* ignore */
          }
          this.disconnectionHandlers.forEach((h) => h());
        }

        this.client = socket;

        socket.on('message', (data: WebSocket.Data) => {
          const msg = typeof data === 'string' ? data : data.toString();
          this.messageHandlers.forEach((h) => h(msg));
        });

        socket.on('close', () => {
          if (this.client === socket) {
            this.client = null;
            this.disconnectionHandlers.forEach((h) => h());
          }
        });

        socket.on('error', (err: Error) => {
          this.errorHandlers.forEach((h) => h(err));
        });

        this.connectionHandlers.forEach((h) => h(socket));
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        try {
          this.client.close();
        } catch (_) {
          /* ignore */
        }
        this.client = null;
      }
      if (this.wss) {
        this.wss.close(() => {
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  send(msg: string): void {
    if (this.client && this.client.readyState === WebSocket.OPEN) {
      this.client.send(msg);
    }
  }

  isListening(): boolean {
    return this.wss !== null;
  }

  isClientConnected(): boolean {
    return this.client !== null && this.client.readyState === WebSocket.OPEN;
  }

  onClientConnected(handler: (socket: WebSocket) => void): void {
    this.connectionHandlers.push(handler);
  }

  onClientDisconnected(handler: () => void): void {
    this.disconnectionHandlers.push(handler);
  }

  onMessage(handler: (msg: string) => void): void {
    this.messageHandlers.push(handler);
  }

  onError(handler: (err: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  dispose(): void {
    void this.stop();
  }
}

export async function startNReplWsServer(port: number, host?: string): Promise<NReplWsServer> {
  const server = new NReplWsServer(port, host);
  await server.start();
  return server;
}
