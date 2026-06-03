import * as expectLib from 'expect';
import * as evaluateUtils from '../../evaluate-utils';

describe('normalizeEvaluateAsCommentArgs', () => {
  it('normalizes command invocation (options first)', () => {
    const documentArg = { some: 'document-context' };
    const normalized = evaluateUtils.normalizeEvaluateAsCommentArgs(
      { commentStyle: 'ignore' },
      documentArg as any
    );

    expectLib.expect(normalized.options.commentStyle).toBe('ignore');
    expectLib.expect(normalized.document).toBe(documentArg);
  });

  it('normalizes context menu invocation (document first)', () => {
    const documentArg = { some: 'document-context' };
    const normalized = evaluateUtils.normalizeEvaluateAsCommentArgs(documentArg, {
      commentStyle: 'rcf',
    });

    expectLib.expect(normalized.document).toBe(documentArg);
    expectLib.expect(normalized.options.commentStyle).toBe('rcf');
  });

  it('defaults comment style to line when context menu invocation omits options', () => {
    const documentArg = { some: 'document-context' };
    const normalized = evaluateUtils.normalizeEvaluateAsCommentArgs(documentArg);

    expectLib.expect(normalized.document).toBe(documentArg);
    expectLib.expect(normalized.options.commentStyle).toBe('line');
  });
});
