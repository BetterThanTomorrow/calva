import * as output from '../results-output/output';

export type ApiOutputCategory =
  | 'evaluationResults'
  | 'clojureCode'
  | 'evaluationOutput'
  | 'evaluationErrorOutput'
  | 'otherOutput'
  | 'otherErrorOutput';

export interface ApiOutputMessage {
  category: ApiOutputCategory;
  text: string;
}

const outputCategoryToApiCategory: Record<string, ApiOutputCategory> = {
  evalResults: 'evaluationResults',
  clojure: 'clojureCode',
  evalOut: 'evaluationOutput',
  evalErr: 'evaluationErrorOutput',
  otherOut: 'otherOutput',
  otherErr: 'otherErrorOutput',
};

/**
 * Subscribe to live REPL/output messages.
 * Returns an unsubscribe function.
 */
export function onOutput(
  callback: (msg: ApiOutputMessage) => void,
  categories?: ApiOutputCategory[]
): () => void {
  return output.subscribe((m: output.SubscriberOutputMessage) => {
    const cat = outputCategoryToApiCategory[m.category] || 'otherOutput';
    if (!categories || categories.includes(cat)) {
      try {
        callback({ category: cat, text: m.text });
      } catch (error) {
        console.log('API onOutput callback failed', error.message);
      }
    }
  });
}
