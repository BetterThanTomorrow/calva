'use strict';
import { window, StatusBarAlignment, StatusBarItem } from 'vscode';
import statusbar from '../statusbar';
import * as paredit from './extension';

export class StatusBar {

    private _visible: Boolean;
    private _keyMapConfig: paredit.KeyMapConfig;

    private _toggleBarItem: StatusBarItem;

    constructor(keyMapConfig: paredit.KeyMapConfig) {
        this._toggleBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
        this._toggleBarItem.text = "(λ)";
        this._toggleBarItem.tooltip = "";
        this._toggleBarItem.command = 'paredit.togglemode';
        this._visible = false;
        this.keyMapConfig = keyMapConfig;

        paredit.onPareditKeyMapChanged((keyMapConfig) => {
            this.keyMapConfig = keyMapConfig;
        })
    }

    updateUIState() {
        let keyMap = this._keyMapConfig.keyMap.trim().toLowerCase();
        let keybindingsEnabled = this._keyMapConfig.keybindingsEnabled;

        if (keybindingsEnabled) {
            switch (keyMap) {
                case 'original':
                    this.visible = true;
                    this._toggleBarItem.text = "(λ)";
                    this._toggleBarItem.tooltip = "Toggle to strict Mode";
                    this._toggleBarItem.color = undefined;
                    break;
                case 'strict':
                    this.visible = true;
                    this._toggleBarItem.text = "[λ]";
                    this._toggleBarItem.tooltip = "Toggle to original Mode";
                    this._toggleBarItem.color = undefined;
                    break;
                default:
                    this.visible = true;
                    this._toggleBarItem.text = "λ";
                    this._toggleBarItem.tooltip = "Calva Paredit Keymap is set to none, Toggle to Strict Mode is Disabled"
                    this._toggleBarItem.color = statusbar.color.inactive;
            }
        } else {
            this.visible = true;
            this._toggleBarItem.text = "λ";
            this._toggleBarItem.tooltip = "Calva Paredit Keybindings Enabled is set to false"
            this._toggleBarItem.color = statusbar.color.inactive;
        }
    }

    get keyMapConfig() {
        return this._keyMapConfig;
    }

    set keyMapConfig(keyMapConfig: paredit.KeyMapConfig) {
        this._keyMapConfig = keyMapConfig;
        this.updateUIState();
    }

    get visible(): Boolean {
        return this._visible;
    }

    set visible(value: Boolean) {
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
