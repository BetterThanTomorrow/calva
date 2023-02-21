import * as vscode from 'vscode';

export enum AutoStartBehaviour {
  WorkspaceOpened = 'when-workspace-opened-use-workspace-root',
  FirstWorkspace = 'always-use-first-workspace-root',
  FileOpened = 'when-file-opened-use-furthest-project',
  Never = 'never',
}

/**
 * Get the auto-start config from vscode.
 *
 * Translates boolean values into the AutoStartBehaviour enum for backwards compatibility
 * - true -> WorkspaceOpened
 * - false -> Never
 */
export const getAutoStartBehaviour = () => {
  const config = vscode.workspace.getConfiguration('calva');
  const auto_start = config.get<boolean | AutoStartBehaviour>('enableClojureLspOnStart');
  if (typeof auto_start === 'boolean') {
    if (auto_start) {
      return AutoStartBehaviour.WorkspaceOpened;
    } else {
      return AutoStartBehaviour.Never;
    }
  }
  return auto_start;
};
