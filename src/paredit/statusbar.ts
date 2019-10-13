'use strict';
import { window, StatusBarAlignment, StatusBarItem } from 'vscode';
import statusbar from '../statusbar';
import * as paredit from './extension';

export class StatusBar {

    private _enabled: Boolean;
    private _visible: Boolean;
    private _keyMap: String;

    private _toggleBarItem: StatusBarItem;

    constructor(keymap: String) {
        this._toggleBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
        this._toggleBarItem.text = "(λ)";
        this._toggleBarItem.command = 'paredit.toggle';
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
                this._toggleBarItem.tooltip = "Toggle to Strict Mode"
                break;
            case 'strict':
                this._keyMap = 'strict';
                this.enabled = true;
                this.visible = true;
                this._toggleBarItem.tooltip = "Toggle to Original Mode"
                break;
            default:
                this._keyMap = 'none';
                this.enabled = false;
                this.visible = true;
                this._toggleBarItem.tooltip = "Calva Paredit is Disabled"
        }
    }

    get enabled() {
        return this._enabled;
    }

    set enabled(value: Boolean) {
        this._enabled = value;

        if (this._enabled) {
            this._toggleBarItem.color = statusbar.color.active;
        } else {
            this._toggleBarItem.color = statusbar.color.inactive;
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