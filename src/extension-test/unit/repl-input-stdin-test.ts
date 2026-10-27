import * as expectLib from 'expect';
import * as replInputStdin from '../../repl-input-stdin';

describe('stdin for evaluations from files', () => {
  it('reads stdin in the Output Sidebar while the setting has its REPL Input on', () => {
    expectLib
      .expect(replInputStdin.stdinViewId({ 'output-view': true, 'output-sidebar': true }, false))
      .toBe('output-sidebar');
    expectLib
      .expect(replInputStdin.stdinViewId({ 'output-sidebar': true }, false))
      .toBe('output-sidebar');
  });

  it('reads stdin in the Output View while the setting has the REPL Input on only there', () => {
    expectLib
      .expect(replInputStdin.stdinViewId({ 'output-view': true, 'output-sidebar': false }, false))
      .toBe('output-view');
  });

  it('leaves stdin to the input box while the setting has the REPL Input off for both views', () => {
    expectLib
      .expect(replInputStdin.stdinViewId({ 'output-view': false, 'output-sidebar': false }, false))
      .toBeUndefined();
    expectLib.expect(replInputStdin.stdinViewId(undefined, false)).toBeUndefined();
  });

  it('leaves stdin to the input box for evaluations from the REPL window', () => {
    expectLib.expect(replInputStdin.stdinViewId({ 'output-sidebar': true }, true)).toBeUndefined();
  });
});
