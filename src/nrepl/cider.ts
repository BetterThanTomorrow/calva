
// https://github.com/clojure-emacs/cider-nrepl/blob/a740583c3aa8b582f3097611787a276775131d32/src/cider/nrepl/middleware/test.clj#L45
export interface TestSummary {
    ns: number;
    var: number;
    test: number;
    pass: number;
    fail: number;
    error: number;
};

// https://github.com/clojure-emacs/cider-nrepl/blob/a740583c3aa8b582f3097611787a276775131d32/src/cider/nrepl/middleware/test.clj#L97-L112
export interface TestResult {
    context: string;
    index: number;
    message: string;
    ns: string;
    type: string;
    var: string;
    expected?: string;
    'gen-input'?: string;
    actual?: string;
    diffs?: unknown;
    error?: unknown;
    line?: number
    file?: string;
}

// https://github.com/clojure-emacs/cider-nrepl/blob/a740583c3aa8b582f3097611787a276775131d32/src/cider/nrepl/middleware/test.clj#L45-L46
export interface TestResults {
    summary: TestSummary;
    results: {
        [key: string]: {
            [key: string]: TestResult[]
        }
    }
    'testing-ns'?: string
    'gen-input': unknown
}
