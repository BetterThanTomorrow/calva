import * as expectLib from 'expect';
import * as wsServer from '../../../nrepl/nrepl-ws-server';
import WebSocket = require('ws');

describe('ws-nrepl-server', () => {
  let server: wsServer.NReplWsServer;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = undefined;
    }
  });

  it('starts and stops cleanly', async () => {
    server = await wsServer.startNReplWsServer(0);
    expectLib.expect(server.isListening()).toBe(true);
    await server.stop();
    expectLib.expect(server.isListening()).toBe(false);
    server = undefined;
  });

  it('assigns an ephemeral port when started with port 0', async () => {
    server = await wsServer.startNReplWsServer(0);
    expectLib.expect(server.port).toBeGreaterThan(0);
  });

  it('throws WsPortInUseError on port conflict', async () => {
    server = await wsServer.startNReplWsServer(0);
    const port = server.port;
    try {
      await wsServer.startNReplWsServer(port);
      expectLib.expect(true).toBe(false); // should not reach
    } catch (err) {
      expectLib.expect(err).toBeInstanceOf(wsServer.WsPortInUseError);
      expectLib.expect((err as wsServer.WsPortInUseError).port).toBe(port);
    }
  });

  it('accepts client connections', async () => {
    server = await wsServer.startNReplWsServer(0);
    const connected = new Promise<void>((resolve) => {
      server.onClientConnected(() => resolve());
    });
    const client = new WebSocket(`ws://127.0.0.1:${server.port}/_nrepl`);
    await new Promise<void>((resolve) => {
      client.on('open', () => resolve());
    });
    await connected;
    expectLib.expect(server.isClientConnected()).toBe(true);
    client.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('receives messages from client', async () => {
    server = await wsServer.startNReplWsServer(0);
    const messagePromise = new Promise<string>((resolve) => {
      server.onMessage((msg) => resolve(msg));
    });
    const client = new WebSocket(`ws://127.0.0.1:${server.port}/_nrepl`);
    await new Promise<void>((resolve) => {
      client.on('open', () => resolve());
    });
    client.send('hello');
    const msg = await messagePromise;
    expectLib.expect(msg).toBe('hello');
    client.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('sends messages to connected client', async () => {
    server = await wsServer.startNReplWsServer(0);
    const client = new WebSocket(`ws://127.0.0.1:${server.port}/_nrepl`);
    const messagePromise = new Promise<string>((resolve) => {
      client.on('message', (data) => resolve(data.toString()));
    });
    await new Promise<void>((resolve) => {
      server.onClientConnected(() => resolve());
    });
    server.send('world');
    const msg = await messagePromise;
    expectLib.expect(msg).toBe('world');
    client.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('fires disconnection handler on client close', async () => {
    server = await wsServer.startNReplWsServer(0);
    const disconnected = new Promise<void>((resolve) => {
      server.onClientDisconnected(() => resolve());
    });
    const client = new WebSocket(`ws://127.0.0.1:${server.port}/_nrepl`);
    await new Promise<void>((resolve) => {
      client.on('open', () => resolve());
    });
    client.close();
    await disconnected;
    expectLib.expect(server.isClientConnected()).toBe(false);
  });

  it('replaces previous client on new connection', async () => {
    server = await wsServer.startNReplWsServer(0);
    const disconnected = new Promise<void>((resolve) => {
      server.onClientDisconnected(() => resolve());
    });
    const client1 = new WebSocket(`ws://127.0.0.1:${server.port}/_nrepl`);
    await new Promise<void>((resolve) => {
      client1.on('open', () => resolve());
    });
    const client2 = new WebSocket(`ws://127.0.0.1:${server.port}/_nrepl`);
    await disconnected;
    await new Promise<void>((resolve) => {
      client2.on('open', () => resolve());
    });
    expectLib.expect(server.isClientConnected()).toBe(true);
    client1.close();
    client2.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('send is a no-op when no client is connected', async () => {
    server = await wsServer.startNReplWsServer(0);
    // Should not throw
    server.send('orphan message');
  });

  it('stop is idempotent', async () => {
    server = await wsServer.startNReplWsServer(0);
    await server.stop();
    await server.stop(); // second stop should not throw
    server = undefined;
  });
});
