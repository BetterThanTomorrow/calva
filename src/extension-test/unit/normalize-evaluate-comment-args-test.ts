import * as expect from 'expect';
import { normalizeEvaluateAsCommentArgs } from '../../evaluate-utils';

describe('normalizeEvaluateAsCommentArgs', () => {
  it('normalizes command invocation (options first)', () => {
    const documentArg = { some: 'document-context' };
    const normalized = normalizeEvaluateAsCommentArgs(
      { commentStyle: 'ignore' },
      documentArg as any
    );

    expect(normalized.options.commentStyle).toBe('ignore');
    expect(normalized.document).toBe(documentArg);
  });

  it('normalizes context menu invocation (document first)', () => {
    const documentArg = { some: 'document-context' };
    const normalized = normalizeEvaluateAsCommentArgs(documentArg, {
      commentStyle: 'rcf',
    });

    expect(normalized.document).toBe(documentArg);
    expect(normalized.options.commentStyle).toBe('rcf');
  });

  it('defaults comment style to line when context menu invocation omits options', () => {
    const documentArg = { some: 'document-context' };
    const normalized = normalizeEvaluateAsCommentArgs(documentArg);

    expect(normalized.document).toBe(documentArg);
    expect(normalized.options.commentStyle).toBe('line');
  });
});
