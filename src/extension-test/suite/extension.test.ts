import * as assert from 'assert';
import { after } from 'mocha';
import {keywordize, unKeywordize} from '../../nrepl/project-types';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../extension';

suite('Extension Test Suite', () => {
  after(() => {
    vscode.window.showInformationMessage('All tests done!');
  });

  test('Sample test', () => {
    assert.equal(-1, [1, 2, 3].indexOf(5));
    assert.equal(-1, [1, 2, 3].indexOf(0));
  });

  test('Un/Keywordize Test', () => {
    assert.equal(":test", keywordize("test"));
    assert.equal(":foo", keywordize(":foo"));
    assert.equal("test", unKeywordize("test"));
    assert.equal("foo", unKeywordize(":foo"));
  });
});