// https://github.com/clojure-emacs/cider-nrepl/blob/a740583c3aa8b582f3097611787a276775131d32/src/cider/nrepl/middleware/test.clj#L45
export interface TestSummary {
  ns: number;
  var: number;
  test: number;
  pass: number;
  fail: number;
  error: number;
}

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
  line?: number;
  file?: string;
}

// https://github.com/clojure-emacs/orchard/blob/febf8169675af1b11a8c00cfe1155ed40db8be42/src/orchard/query.clj#L10-L15
export interface NamespaceQuery {
  exactly: string[];
  'project?'?: boolean;
  'load-project-ns?'?: boolean;
  'has-tests?'?: boolean;
  'include-regexps'?: string[];
  'exclude-regexps'?: string[];
}

// https://github.com/clojure-emacs/orchard/blob/febf8169675af1b11a8c00cfe1155ed40db8be42/src/orchard/query.clj#L45-L52
export interface VarQuery {
  'ns-query'?: NamespaceQuery;
  'private?'?: boolean;
  'test?'?: boolean;
  'include-meta-key'?: string[];
  'exclude-meta-key'?: string[];
  search?: string;
  'search-property'?: 'doc' | 'name';
  'manipulate-vars'?: unknown;
}

// https://github.com/clojure-emacs/cider-nrepl/blob/a740583c3aa8b582f3097611787a276775131d32/src/cider/nrepl/middleware/test.clj#L45-L46
export interface TestResults {
  summary: TestSummary;
  results: {
    [key: string]: {
      [key: string]: TestResult[];
    };
  };
  'testing-ns'?: string;
  'gen-input': unknown;
}

function stripTrailingNewlines(s: string): string {
  return s.replace(/\r?\n$/, '');
}

function resultMessage(resultItem: Readonly<TestResult>): string {
  const msg: string[] = [];
  if (resultItem.context && resultItem.context !== 'false') {
    msg.push(resultItem.context);
  }
  if (resultItem.message) {
    msg.push(resultItem.message);
  }
  return `${
    // We filter on typeof m === 'string' because a case has been seen in which the first element is actually an array instead of a string,
    // which results in a string like ": <some message>".
    msg.length > 0 ? stripTrailingNewlines(msg.filter((m) => typeof m === 'string').join(': ')) : ''
  }`;
}

// Given a summary, return a message suitable for printing in the REPL to show
// the user a quick summary of the test run.
// Examples:
// ; No tests found. 😱, ns: 0, vars: 0
// ; 6 tests finished, all passing 👍, ns: 1, vars: 2
// ; 6 tests finished, problems found. 😭 errors: 0, failures: 1, ns: 1, vars: 2
export function summaryMessage(summary: Readonly<TestSummary>): string {
  const msg: string[] = [];
  if (summary.test > 0) {
    msg.push(summary.test + ' tests finished');

    const hasProblems = summary.error + summary.fail > 0;
    if (!hasProblems) {
      msg.push('all passing 👍');
    } else {
      msg.push('problems found. 😭 errors: ' + summary.error + ', failures: ' + summary.fail);
    }
  } else {
    msg.push('No tests found. 😱');
  }

  msg.push('ns: ' + summary.ns + ', vars: ' + summary.var);
  return msg.join(', ');
}

// Given a list of summaries, sum them to compute the total number of tests,
// errors and vars, etc.
export function totalSummary(summaries: TestSummary[]): TestSummary {
  const result = { test: 0, error: 0, ns: 0, var: 0, fail: 0, pass: 0 };
  for (const summary of summaries) {
    for (const k in result) {
      result[k] = result[k] + summary[k];
    }
  }
  return result;
}

// Returns the file and line number information of an error, if the data is provided.
// If there is no information, the empty string is returned.
// Otherwise, returns a string like:
// ` (line 7)`
// ` (core.clj)`
// ` (core.clj:7)`
// There is a leading space in these messages so that the return value can be
// easily spliced into other messages without having to check deal with padding.
export function lineInformation(result: TestResult): string {
  const hasFile = typeof result.file === 'string';
  const hasLine = typeof result.line === 'number';

  if (!hasFile && !hasLine) {
    return '';
  }

  if (!hasFile) {
    return ` (line ${result.line})`;
  }

  if (!hasLine) {
    return ` (${result.file})`;
  }

  return ` (${result.file}:${result.line})`;
}

function getDiffMessages(result: TestResult): string[] {
  const diffs = result.diffs;
  const messages: string[] = [];

  if (!diffs || !Array.isArray(diffs) || diffs.length === 0) {
    return messages;
  }

  diffs.forEach((diffPair: [string, [string, string]]) => {
    if (Array.isArray(diffPair) && diffPair.length === 2) {
      const [_, [removed, added]] = diffPair;

      if (removed || added) {
        messages.push('; diff:');
        messages.push(removed ? `- ${removed}` : '');
        if (added) {
          messages.push(`+ ${added}`);
        }
      }
    } else {
      console.warn('Invalid diff pair format:', diffPair);
    }
  });

  return messages;
}

// Return a detailed message about why a test failed.
// If the test passed, return the empty string.
// The message contains "comment" lines that are prepended with ;
// and "data" lines that should be printed verbatim into the REPL.
export function detailedMessage(result: TestResult): string | undefined {
  const messages: string[] = [];
  const message = resultMessage(result);
  const location = lineInformation(result);

  if (result.type === 'error') {
    messages.push(`; ERROR in ${result.ns}/${result.var}${location}:`);
    if (message) {
      messages.push(`; ${message}`);
    }
    messages.push(`; error: ${result.error}${location}`);

    if (result.expected) {
      messages.push('; expected:');
      messages.push(result.expected);
    }
  } else if (result.type === 'fail') {
    messages.push(`; FAIL in ${result.ns}/${result.var}${location}:`);
    if (message) {
      messages.push(`; ${message}`);
    }
    if (result.expected) {
      messages.push(`; expected:\n${result.expected}`);
    }
    if (result.actual) {
      messages.push(`; actual:\n${result.actual}`);
    }

    const diffMessages = getDiffMessages(result);
    if (diffMessages.length > 0) {
      messages.push(...diffMessages);
    }
  }
  return messages.length > 0 ? messages.join('\n') : undefined;
}

// Return a short message that can be shown to user as a Diagnostic.
export function diagnosticMessage(result: TestResult): string {
  return `failure in test: ${result.var} context: ${result.context}, expected ${result.expected}, got: ${result.actual}`;
}

export function shortMessage(result: TestResult): string {
  switch (result.type) {
    case 'pass':
      return '';
    case 'error':
      return 'Error running test: ' + result.message + ' ' + result.error;
    case 'fail':
      if (result.message) {
        return 'Expected ' + result.expected + ' actual ' + result.actual;
      } else {
        return result.message + ' expected ' + result.expected + ' actual ' + result.actual;
      }
  }
}

type TestResultWithLineNumber = Omit<TestResult, 'line'> & {
  line: NonNullable<TestResult['line']>;
};

export const hasLineNumber = (
  result: TestResult | TestResultWithLineNumber
): result is TestResultWithLineNumber => {
  return typeof result.line === 'number';
};
