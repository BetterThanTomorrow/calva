function addToHistory(history: string[], content: string): string[] {
    if (content) {
        const entry = content.trim();
        if (entry !== '') {
            if (history.length === 0 || entry !== history[history.length - 1]) {
                return [...history, entry];
            }
        }
    }
    return history;
}

export {
    addToHistory
};