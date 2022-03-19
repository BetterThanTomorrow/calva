import * as path from 'path';

export const testDataDir = path.join(
  __dirname,
  ...['..', '..', '..', '..'],
  'test-data',
  'integration-test'
);
