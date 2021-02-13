const config = {
    REPL_FILE_EXT: 'calva-repl',
    KEYBINDINGS_ENABLED_CONFIG_KEY: 'calva.keybindingsEnabled',
    KEYBINDINGS_ENABLED_CONTEXT_KEY: 'calva:keybindingsEnabled',
    CURSOR_CONTEXT_IN_STRING: 'calva:cursorInString',
    CURSOR_CONTEXT_IN_COMMENT: 'calva:cursorInComment',
};

type ReplSessionType = 'clj' | 'cljs';

export {
    ReplSessionType
}

export default config;
