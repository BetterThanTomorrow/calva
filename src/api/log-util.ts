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
