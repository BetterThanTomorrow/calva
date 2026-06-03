import * as project_utils from '../../../project-root';
import * as mocha from 'mocha';
import * as expectLib from 'expect';
import * as vscode from 'vscode';

mocha.describe('project root utils', () => {
  mocha.it('should return the furthest parent', () => {
    const furthest = project_utils.findFurthestParent(vscode.Uri.parse('/a/b/c/d'), [
      vscode.Uri.parse('/a/b/c'),
      vscode.Uri.parse('/a/b'),
    ]);

    expectLib.expect(furthest.path).toBe('/a/b');
  });

  mocha.it('should return the closest parent', () => {
    const furthest = project_utils.findClosestParent(vscode.Uri.parse('/a/b/c/d'), [
      vscode.Uri.parse('/a/b/c'),
      vscode.Uri.parse('/a/b'),
    ]);

    expectLib.expect(furthest.path).toBe('/a/b/c');
  });

  mocha.it('should return a filtered set of shortest, distinct paths', () => {
    try {
      const distinct = project_utils.filterShortestDistinctPaths([
        vscode.Uri.parse('/a/b/c'),
        vscode.Uri.parse('/a/b/c/d'),

        vscode.Uri.parse('/a/b/d'),
        vscode.Uri.parse('/a/b/d/c'),
      ]);

      expectLib.expect(distinct.map((uri) => uri.path)).toEqual(['/a/b/c', '/a/b/d']);
    } catch (err) {
      console.log('err', err);
    }
  });
});
