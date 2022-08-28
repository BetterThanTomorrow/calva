import assert = require('assert');
import * as fsPromises from 'fs/promises';
import path = require('path');
import * as testUtil from './util';
import { NotebookProvider } from '../../../NotebookProvider';
import { before, after } from 'mocha';
import { serialize } from 'v8';
import _ = require('lodash');

const tester = new NotebookProvider();
const suiteName = 'notebook';
const decoder = new TextDecoder();

const ignoreList = ['highlight_test.clj'];

async function absoluteFileNamesIn(directoryName, results: string[] = []) {
  const files = await fsPromises.readdir(directoryName, { withFileTypes: true });
  for (const f of files) {
    const fullPath = path.join(directoryName, f.name);
    if (f.isDirectory()) {
      await absoluteFileNamesIn(fullPath, results);
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

suite('serialization', () => {
  before(() => {
    testUtil.showMessage(suiteName, `suite starting!`);
  });

  after(() => {
    testUtil.showMessage(suiteName, `suite done!`);
  });

  test('input equals output', async () => {
    const testFilePath = path.join(testUtil.testDataDir, '..');

    const fileNames = await absoluteFileNamesIn(testFilePath);

    const contents = await Promise.all(
      fileNames
        .filter(
          (x) =>
            '.clj' === path.parse(x).ext && _.some(ignoreList, (toIgnore) => !x.endsWith(toIgnore))
        )
        .map((name) => fsPromises.readFile(name))
    );

    for (const fileBuffer of contents) {
      const notebook = await tester.deserializeNotebook(fileBuffer, null);
      const serializedNotebook = await tester.serializeNotebook(notebook, null);

      assert.equal(decoder.decode(serializedNotebook), decoder.decode(fileBuffer));
    }
  });
});
