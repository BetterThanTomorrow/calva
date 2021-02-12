const config = {
    REPL_FILE_EXT: 'calva-repl',
    KEYBINDINGS_ENABLED_CONFIG_KEY: 'calva.keybindingsEnabled',
    KEYBINDINGS_ENABLED_CONTEXT_KEY: 'calva:keybindingsEnabled',
    CURSOR_CONTEXT_IN_STRING: 'calva:inString',
    CURSOR_CONTEXT_IN_COMMENT: 'calva:inComment',
};

type ReplSessionType = 'clj' | 'cljs';

export {
    ReplSessionType
}

export default config;
