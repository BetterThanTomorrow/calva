import * as stream from 'node:stream/web';

/**
 * A simple async queue implementation backed by a node transform stream in passthrough mode. This will
 * process items synchronously.
 */
export const createQueue = <T>(handler: (item: T) => Promise<void>) => {
  const queue = new stream.TransformStream<T, T>();
  const writer = queue.writable.getWriter();

  void (async () => {
    for await (const item of queue.readable) {
      await handler(item).catch((err) => {
        console.error('Failed to process queue item', err);
      });
    }
  })().catch((err) => {
    console.error(err);
  });

  return {
    push: (item: T) => writer.write(item),
  };
};
