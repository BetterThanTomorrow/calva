// HISTORY TODO: Add more defined type to this
// Should this be stored in global/central state?
const replHistory: any = {};

function pushToReplHistory(filePath: string, code: string): void {
    const history = replHistory[filePath] || [];
    history.push(code)
    if (history.length > 2) {
        history.shift();
    }
    replHistory[filePath] = history;
}

function popFromReplHistory(filePath: string): string | null {
    const history = replHistory[filePath];
    if (history) {
        return history.pop();
    } else {
        return null;
    }
}

export {
    pushToReplHistory,
    popFromReplHistory
};
