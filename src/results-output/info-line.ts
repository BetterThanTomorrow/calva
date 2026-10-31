import type { AppendClojureOptions } from './output';

type InfoLineContext = Pick<
  AppendClojureOptions,
  'ns' | 'replSessionType' | 'who' | 'shadowBuild' | 'shadowRuntimeId' | 'evaluationId'
>;

const lastContexts = new Map<string, InfoLineContext>();

let lastEvaluationId = 0;

export function nextEvaluationId() {
  return ++lastEvaluationId;
}

export function saveLastContext(destination: string, options: InfoLineContext) {
  const { ns, replSessionType, who, shadowBuild, shadowRuntimeId } = options;
  if (ns) {
    const evaluationId = options.evaluationId ?? lastContexts.get(destination)?.evaluationId;
    lastContexts.set(destination, {
      ns,
      replSessionType,
      who,
      shadowBuild,
      shadowRuntimeId,
      evaluationId,
    });
  }
}

function contextKey(options: InfoLineContext) {
  return `${options.who || ''} ${options.replSessionType} ${options.shadowBuild || ''} ${
    options.shadowRuntimeId ?? ''
  } ${options.ns}`;
}

// An info line starts each evaluation's output, and other output when its context changed
export function isInfoLineDue(destination: string, options: InfoLineContext) {
  const last = lastContexts.get(destination) ?? {};
  const isNewEvaluation =
    options.evaluationId !== undefined && options.evaluationId !== last.evaluationId;
  return isNewEvaluation || contextKey(options) !== contextKey(last);
}
