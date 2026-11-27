/**
 * Pure validation and mapping logic for the repl API log() function.
 * Separated from repl-v1.ts to enable unit testing without vscode dependency.
 */

export type ApiOutputCategory =
  | 'evaluationResults'
  | 'evaluatedCode'
  | 'evaluationOutput'
  | 'evaluationErrorOutput'
  | 'otherOutput'
  | 'otherErrorOutput';

export type InternalOutputCategory =
  | 'evalResults'
  | 'evaluatedCode'
  | 'evalOut'
  | 'evalErr'
  | 'otherOut'
  | 'otherErr';

export const apiCategoryToOutputCategory: Record<ApiOutputCategory, InternalOutputCategory> = {
  evaluationResults: 'evalResults',
  evaluatedCode: 'evaluatedCode',
  evaluationOutput: 'evalOut',
  evaluationErrorOutput: 'evalErr',
  otherOutput: 'otherOut',
  otherErrorOutput: 'otherErr',
};

const reservedWhos = ['ui', 'api'];

export function validateLogMessage(message: {
  category: string;
  text: unknown;
  who?: string;
}): InternalOutputCategory {
  if (message.who && reservedWhos.includes(message.who)) {
    throw new Error(`The who value '${message.who}' is reserved for Calva's internal use`);
  }
  if (!message.text || typeof message.text !== 'string') {
    throw new Error('log() requires a non-empty text string');
  }
  const internalCategory = apiCategoryToOutputCategory[message.category as ApiOutputCategory];
  if (!internalCategory) {
    throw new Error(
      `Unknown category '${message.category}'. Must be one of: ${Object.keys(
        apiCategoryToOutputCategory
      ).join(', ')}`
    );
  }
  return internalCategory;
}

// The keys of `calva.outputDestinations`
export type DestinationSetting = 'evalResults' | 'evalOutput' | 'otherOutput';

export const outputCategoryToDestinationSetting: Record<
  InternalOutputCategory,
  DestinationSetting
> = {
  evalResults: 'evalResults',
  evaluatedCode: 'evalResults',
  evalOut: 'evalOutput',
  evalErr: 'evalOutput',
  otherOut: 'otherOutput',
  otherErr: 'otherOutput',
};

// The destinations log() leaves to the caller: the REPL window, whose prompt belongs to Calva's sessions
const callerDestinations = ['repl-window'];

export function splitDestinations(destinations: string[]): {
  printedTo: string[];
  skipped: string[];
} {
  return {
    printedTo: destinations.filter((d) => !callerDestinations.includes(d)),
    skipped: destinations.filter((d) => callerDestinations.includes(d)),
  };
}

export function validateDisplayMessage(message: { who?: string }) {
  if (!message.who) {
    throw new Error('log() with display requires a who');
  }
}

/**
 * Keeps the evaluations that log() gave an id. An evaluation runs until its promise settles, and then
 * `end` is called with its id. Its id stays valid for output and results logged after that.
 */
export function createEvaluationTracker(nextId: () => number, end: (evaluationId: number) => void) {
  const issued = new Set<number>();
  const running = new Set<number>();
  return {
    begin(evaluation: PromiseLike<unknown>): number {
      const evaluationId = nextId();
      issued.add(evaluationId);
      running.add(evaluationId);
      const settle = () => {
        running.delete(evaluationId);
        end(evaluationId);
      };
      Promise.resolve(evaluation)
        .then(settle, settle)
        .catch((e) => console.error('Failed ending a logged evaluation', e));
      return evaluationId;
    },
    // The id `evaluationId` gives a message of `category`, or undefined when it gives none: evaluated
    // code only joins a running evaluation, and other messages any evaluation log() gave an id
    validId(
      evaluationId: number | undefined,
      category: InternalOutputCategory
    ): number | undefined {
      const valid = category === 'evaluatedCode' ? running : issued;
      return valid.has(evaluationId) ? evaluationId : undefined;
    },
  };
}
