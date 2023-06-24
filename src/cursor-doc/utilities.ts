import * as model from './model';

export function addMissingBrackets(text: string): string {
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
    return `${missingOpens.join('')}${text}`;
  } else {
    stack.reverse();
    const missingCloses = stack
      .map((bracket) => {
        return { '{': '}', '[': ']', '(': ')', '"': '"' }[bracket];
      })
      .join('');
    return `${missingOpens.join('')}${text}${missingCloses}`;
  }
}
