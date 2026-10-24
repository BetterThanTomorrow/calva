import * as expectLib from 'expect';
import * as replInputStdin from '../../repl-input-stdin';

describe('stdin for evaluations from files', () => {
  const readInSidebar = () => Promise.resolve('a line');

  it('reads stdin in the Output Sidebar while the setting has the REPL Input on for a view', () => {
    expectLib
      .expect(
        replInputStdin.editorStdin(
          { 'output-view': true, 'output-sidebar': false },
          false,
          readInSidebar
        )
      )
      .toBe(readInSidebar);
  });

  it('leaves stdin to the input box while the setting has the REPL Input off for both views', () => {
    expectLib
      .expect(
        replInputStdin.editorStdin(
          { 'output-view': false, 'output-sidebar': false },
          false,
          readInSidebar
        )
      )
      .toBeUndefined();
    expectLib.expect(replInputStdin.editorStdin(undefined, false, readInSidebar)).toBeUndefined();
  });

  it('leaves stdin to the input box for evaluations from the REPL window', () => {
    expectLib
      .expect(replInputStdin.editorStdin({ 'output-sidebar': true }, true, readInSidebar))
      .toBeUndefined();
  });
});
