import * as model from './model';

export type MissingTexts = {
  append: string;
  prepend: string;
};

export function getMissingBrackets(text: string): MissingTexts {
  const doc = new model.StringDocument(text);
  const cursor = doc.getTokenCursor(0);
  const stack: string[] = [];
  const missingOpens = [];
  do {
    const token = cursor.getToken();
    if (token.type === 'open') {
      stack.push(token.raw[token.raw.length - 1]);
    } else if (token.type === 'close') {
      if (stack.length === 0) {
        missingOpens.unshift({ ')': '(', ']': '[', '}': '{', '"': '"' }[token.raw]);
      } else {
        stack.pop();
      }
    }
    cursor.next();
  } while (!cursor.atEnd());
  if (stack.length === 0) {
    return { append: '', prepend: missingOpens.join('') };
  } else {
    stack.reverse();
    const missingCloses = stack.map((bracket) => {
      return { '{': '}', '[': ']', '(': ')', '"': '"' }[bracket];
    });
    return { prepend: missingOpens.join(''), append: missingCloses.join('') };
  }
}
