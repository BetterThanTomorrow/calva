const config = {
    REPL_FILE_EXT: 'calva-repl',
    KEYBINDINGS_ENABLED_CONFIG_KEY: 'calva.keybindingsEnabled',
    KEYBINDINGS_ENABLED_CONTEXT_KEY: 'calva:keybindingsEnabled',
    CLOJURE_LSP_VERSION: '2021.01.05-13.31.52'
};

type ReplSessionType = 'clj' | 'cljs';

export {
    ReplSessionType
}

export default config;
