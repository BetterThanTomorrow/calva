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
