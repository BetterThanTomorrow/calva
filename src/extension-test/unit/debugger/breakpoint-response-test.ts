import * as expectLib from 'expect';
import {
  buildBreakpointResponse,
  COMMENT_BREAKPOINT_MESSAGE,
  RESTART_UNAVAILABLE_MESSAGE,
} from '../../../../src/debugger/breakpoint-response';

const UNSUPPORTED_MESSAGE = 'unsupported';

describe('breakpoint responses', () => {
  it('returns verified locations and the comment warning for comment breakpoints', () => {
    const responses = buildBreakpointResponse(
      [{ line: 2 }, { line: 4, column: 3 }],
      true,
      (breakpoint) => breakpoint.line === 4,
      () => UNSUPPORTED_MESSAGE
    );

    expectLib.expect(responses).toEqual([
      { verified: true, line: 2, column: undefined },
      { verified: false, message: COMMENT_BREAKPOINT_MESSAGE, line: 4, column: 3 },
    ]);
  });

  it('returns the unsupported-source warning without marking the breakpoint verified', () => {
    expectLib
      .expect(
        buildBreakpointResponse(
          [{ line: 1 }],
          false,
          () => false,
          () => UNSUPPORTED_MESSAGE
        )
      )
      .toEqual([{ verified: false, message: UNSUPPORTED_MESSAGE, line: 1, column: undefined }]);
  });

  it('keeps restart explicitly unavailable with its established message', () => {
    const response: { success?: boolean; message?: string } = {};
    response.success = false;
    response.message = RESTART_UNAVAILABLE_MESSAGE;

    expectLib.expect(response).toEqual({
      success: false,
      message: 'Restart is not available in Calva. Use Continue to resume execution.',
    });
  });
});
