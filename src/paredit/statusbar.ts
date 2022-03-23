'use strict';
import { window, StatusBarAlignment, StatusBarItem } from 'vscode';
import statusbar from '../statusbar';
import * as paredit from './extension';

export class StatusBar {
  private _visible: boolean;
  private _keyMap: string;

  private _toggleBarItem: StatusBarItem;

  constructor(keymap: string) {
    this._toggleBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
    this._toggleBarItem.text = '(λ)';
    this._toggleBarItem.tooltip = '';
    this._toggleBarItem.command = 'paredit.togglemode';
    this._visible = false;
    this.keyMap = keymap;

    paredit.onPareditKeyMapChanged((keymap) => {
      this.keyMap = keymap;
    });
  }

  get keyMap() {
    return this._keyMap;
  }

  set keyMap(keymap: string) {
    this._keyMap = keymap;
    this.updateUIState();
  }

  updateUIState() {
    switch (this.keyMap.trim().toLowerCase()) {
      case 'original':
        this.visible = true;
        this._toggleBarItem.text = '(λ)';
        this._toggleBarItem.tooltip = 'Toggle to Strict Mode';
        this._toggleBarItem.color = undefined;
        break;
      case 'strict':
        this.visible = true;
        this._toggleBarItem.text = '[λ]';
        this._toggleBarItem.tooltip = 'Toggle to Original Mode';
        this._toggleBarItem.color = undefined;
        break;
      default:
        this.visible = true;
        this._toggleBarItem.text = 'λ';
        this._toggleBarItem.tooltip =
          'Calva Paredit Keymap is set to none, Toggle to Strict Mode is Disabled';
        this._toggleBarItem.color = statusbar.color.inactive;
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    if (value) {
      this._toggleBarItem.show();
    } else {
      this._toggleBarItem.hide();
    }
  }

  dispose() {
    this._toggleBarItem.dispose();
  }
}
