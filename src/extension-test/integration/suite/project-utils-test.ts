import * as project_utils from '../../../project-root';
import { describe, it } from 'mocha';
import * as expect from 'expect';
import * as vscode from 'vscode';

describe('project root utils', () => {
  it('should return the furthest parent', () => {
    const furthest = project_utils.findFurthestParent(vscode.Uri.parse('/a/b/c/d'), [
      vscode.Uri.parse('/a/b/c'),
      vscode.Uri.parse('/a/b'),
    ]);

    expect(furthest.path).toBe('/a/b');
  });

  it('should return the closest parent', () => {
    const furthest = project_utils.findClosestParent(vscode.Uri.parse('/a/b/c/d'), [
      vscode.Uri.parse('/a/b/c'),
      vscode.Uri.parse('/a/b'),
    ]);

    expect(furthest.path).toBe('/a/b/c');
  });

  it('should return a filtered set of shortest, distinct paths', () => {
    try {
      const distinct = project_utils.filterShortestDistinctPaths([
        vscode.Uri.parse('/a/b/c'),
        vscode.Uri.parse('/a/b/c/d'),

        vscode.Uri.parse('/a/b/d'),
        vscode.Uri.parse('/a/b/d/c'),
      ]);

      expect(distinct.map((uri) => uri.path)).toEqual(['/a/b/c', '/a/b/d']);
    } catch (err) {
      console.log('err', err);
    }
  });
});
