
import * as vscode from 'vscode';

export interface TextIncrementor {
    next(): string;
    reset(): void;
}

export class Incrementor {
    constructor(
        private start: number,
        private end: number
    ) {
        this._val = start;
    }
    private _val: number;

    next() {
        if(this._val > this.end) {
            this._val = this.start;
        }
        return this._val++;
    }
    reset = () => this._val = this.start;
}

export class StatusBarAnimator {
    constructor(
        private incrementor: TextIncrementor,
        private interval: number
    ) { }
    timer: NodeJS.Timer;

    start(sbi: vscode.StatusBarItem) {
        this.incrementor.reset();
        this.timer = setInterval(
            () => sbi.text = this.incrementor.next(),
            this.interval
        );
    }
    stop = () => clearInterval(this.timer);
}
