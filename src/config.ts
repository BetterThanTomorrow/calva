const config = {
    REPL_FILE_EXT: 'calva-repl',
    KEYBINDINGS_ENABLED_CONFIG_KEY: 'calva.keybindingsEnabled',
    KEYBINDINGS_ENABLED_CONTEXT_KEY: 'calva:keybindingsEnabled'
};

type ReplSessionType = 'clj' | 'cljs';

export {
    ReplSessionType
}

export default config;
