import * as clojureLexer from '../cursor-doc/clojure-lexer';
import type { OutputCategory } from './output';

export type EvaluatedCodeMessage = {
  category: 'evaluatedCode';
  text: string;
  who?: string;
  ns?: string;
  replSessionKey?: string;
  shadowBuild?: string;
  shadowRuntimeId?: number;
};

export type VisibleEvaluatedCodeWrite = {
  code: string;
  didLastTerminateLine: boolean;
  outputCategory: OutputCategory;
};

// Returns `code` with up to `columns` of indentation dropped from each line after the first, except
// lines that start inside a string
export function dedent(code: string, columns: number): string {
  if (!(columns > 0)) {
    return code;
  }
  const scanner = new clojureLexer.Scanner(Infinity);
  const indentation = new RegExp(`^[ \\t]{0,${columns}}`);
  return code
    .split('\n')
    .map((line, index) => {
      const inString = scanner.state.inString;
      scanner.processLine(line);
      return index === 0 || inString ? line : line.replace(indentation, '');
    })
    .join('\n');
}

// The Output views that show the code of each running evaluation, by evaluation id
const viewsShowingRunning = new Map<number, Set<string>>();

export function showWhileRunning(evaluationId: number | undefined, view: string) {
  if (evaluationId !== undefined) {
    const views = viewsShowingRunning.get(evaluationId) ?? new Set<string>();
    viewsShowingRunning.set(evaluationId, views.add(view));
  }
}

// Calls `end` for each Output view that shows the code of the evaluation, once, when it ends
export function endEvaluation(
  evaluationId: number | undefined,
  end: (view: string, evaluationId: number) => void
) {
  const views = viewsShowingRunning.get(evaluationId) ?? new Set<string>();
  viewsShowingRunning.delete(evaluationId);
  views.forEach((view) => end(view, evaluationId));
}

export function routeEvaluatedCode(options: {
  code: string;
  didLastTerminateLine: boolean;
  who?: string;
  ns?: string;
  replSessionKey?: string;
  shadowBuild?: string;
  shadowRuntimeId?: number;
  visibleOutputCategory?: OutputCategory;
  emit: (message: EvaluatedCodeMessage) => void;
  writeVisible: (write: VisibleEvaluatedCodeWrite) => void;
}) {
  const {
    code,
    didLastTerminateLine,
    who,
    ns,
    replSessionKey,
    shadowBuild,
    shadowRuntimeId,
    visibleOutputCategory = 'evaluatedCode',
    emit,
    writeVisible,
  } = options;

  emit({
    category: 'evaluatedCode',
    text: `${didLastTerminateLine ? '' : '\n'}${code}`,
    who,
    ns,
    replSessionKey,
    shadowBuild,
    shadowRuntimeId,
  });

  writeVisible({
    code,
    didLastTerminateLine,
    outputCategory: visibleOutputCategory,
  });
}
