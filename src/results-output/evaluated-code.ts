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
