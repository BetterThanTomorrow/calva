'use strict';
import { window, StatusBarAlignment, StatusBarItem } from 'vscode';
import configReader from "../configReader";
import * as paredit from './extension';

export class StatusBar {

    private _enabled: Boolean;
    private _visible: Boolean;
    private _keyMap: String;

    private _toggleBarItem: StatusBarItem;

    constructor(keymap: String) {
        this._toggleBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
        this._toggleBarItem.text = "(λ)";
        this._toggleBarItem.tooltip = "";
        this._toggleBarItem.command = 'paredit.togglemode';
        this._enabled = false;
        this._visible = false;
        this.keyMap = keymap;

        paredit.onPareditKeyMapChanged((keymap) => {
            this.keyMap = keymap;
        })
    }

    get keyMap() {
        return this._keyMap;
    }

    set keyMap(keymap: String) {
        switch (keymap.trim().toLowerCase()) {
            case 'original':
                this._keyMap = 'original';
                this.enabled = true;
                this.visible = true;
                this._toggleBarItem.text = "(λ)";
                this._toggleBarItem.tooltip = "Toggle to strict Mode"
                break;
            case 'strict':
                this._keyMap = 'strict';
                this.enabled = true;
                this.visible = true;
                this._toggleBarItem.text = "[λ]";
                this._toggleBarItem.tooltip = "Toggle to original Mode"
                break;
            default:
                this._keyMap = 'none';
                this.enabled = false;
                this.visible = true;
                this._toggleBarItem.text = "λ";
                this._toggleBarItem.tooltip = "Calva Paredit Keymap is set to none, Toggle to Strict Mode is Disabled"
        }
    }

    get enabled() {
        return this._enabled;
    }

    set enabled(value: Boolean) {
        this._enabled = value;

        // NOTE: Changes to color config are not picked up
        if (this._enabled) {
            this._toggleBarItem.color = configReader.colors.active;
        } else {
            this._toggleBarItem.color = configReader.colors.inactive;
        }
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
