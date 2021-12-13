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
    type: 'pass' | 'fail' | 'error';
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

function stripTrailingNewlines(s: string): string {
    return s.replace(/\r?\n$/, "");
}

function resultMessage(resultItem: Readonly<TestResult>): string {
    let msg = [];
    if (resultItem.context && resultItem.context !== "false")
        msg.push(resultItem.context);
    if (resultItem.message)
        msg.push(resultItem.message);
    return `${msg.length > 0 ? stripTrailingNewlines(msg.join(": ")) : ''}`;
}


// Remove any trailing blank lines from any of the string in result.
export function cleanUpWhiteSpace(result: TestResult) {
    for (const prop in result) {
        if (typeof (result[prop]) === 'string') {
            result[prop] = stripTrailingNewlines(result[prop]);
        }
    }
}
// Given a summary, return a message suitable for printing in the REPL to show
// the user a quick summary of the test run.
// Examples:
// ; No tests found. 😱, ns: 0, vars: 0
// ; 6 tests finished, all passing 👍, ns: 1, vars: 2
// ; 6 tests finished, problems found. 😭 errors: 0, failures: 1, ns: 1, vars: 2
export function summaryMessage(summary: Readonly<TestSummary>): string {
    let msg = [];
    if (summary.test > 0) {
        msg.push(summary.test + " tests finished");

        const hasProblems = summary.error + summary.fail > 0;
        if (!hasProblems) {
            msg.push("all passing 👍");
        } else {
            msg.push("problems found. 😭 errors: " + summary.error + ", failures: " + summary.fail);
        }

    } else {
        msg.push("No tests found. 😱");
    }

    msg.push("ns: " + summary.ns + ", vars: " + summary.var);
    return msg.join(", ");
}

// Given a list of summaries, sum them to compute the total number of tests,
// errors and vars, etc.
export function totalSummary(summaries: TestSummary[]): TestSummary {
    let result = { test: 0, error: 0, ns: 0, var: 0, fail: 0, pass: 0 };
    for (let summary of summaries) {
        for (const k in result) {
            result[k] = result[k] + summary[k];
        }
    }
    return result;
}

// Return a detailed message about why a test failed.
// If the test passed, return the empty string.
// The message contains "comment" lines that are prepended with ;
// and "data" lines that should be printed verbatim into the REPL.
export function detailedMessage(result: TestResult): string {
    const msg = [];
    const message = resultMessage(result);
    if (result.type === "error") {
        msg.push(`; ERROR in ${result.ns}/${result.var} (line ${result.line}):`)
        if (message) {
            msg.push(`; ${message}`);
        }
        msg.push(`; error: ${result.error} (${result.file})`);
        msg.push("; expected:");
        msg.push(result.expected);
    } else if (result.type === 'fail') {
        msg.push(`; FAIL in ${result.ns}/${result.var} (${result.file}:${result.line}):`);
        if (message) {
            msg.push(`; ${message}`);
        }
        msg.push(`; expected:\n${result.expected}\n; actual:\n${result.actual}`);
    }
    return msg.join("\n");
}

// Return a short message that can be shown to user as a Diagnostic.
export function diagnosticMessage(result: TestResult): string {
    return `failure in test: ${result.var} context: ${result.context}, expected ${result.expected}, got: ${result.actual}`
}

export function shortMessage(result: TestResult): string {
    switch (result.type) {
        case 'pass':
            return '';
        case 'error':
            return 'Error running test: ' + result.message + ' ' + result.error;
        case 'fail':
            if (result.message) {
                return 'Expected ' + result.expected + ' actual ' + result.actual
            } else {
                return result.message + ' expected ' + result.expected + ' actual' + result.actual;
            }
    }
}
