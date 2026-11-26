import * as expectLib from 'expect';
import * as cljsErrorCauses from '../../../nrepl/cljs-error-causes';

const marker = 'calva-cljs-error-causes ';

describe('cljs error causes', () => {
  it('reads the causes the code printed, outermost first, without frames', () => {
    const printed = [
      { class: 'cljs.core/ExceptionInfo', message: 'outer', data: '{:outer 1}' },
      { class: 'Error', message: 'inner', data: null },
    ];
    const stdout = `some output\n${marker}${JSON.stringify(printed)}\n`;
    expectLib.expect(cljsErrorCauses.parseCauses(stdout)).toEqual([
      {
        class: 'cljs.core/ExceptionInfo',
        message: 'outer',
        phase: [],
        stacktrace: [],
        data: '{:outer 1}',
      },
      { class: 'Error', message: 'inner', phase: [], stacktrace: [] },
    ]);
  });

  it('gives a cause without a message the empty list bencode sends for nil', () => {
    const stdout = `${marker}${JSON.stringify([{ class: '', message: null, data: null }])}`;
    expectLib
      .expect(cljsErrorCauses.parseCauses(stdout))
      .toEqual([{ class: '', message: [], phase: [], stacktrace: [] }]);
  });

  it('has no causes when nothing was printed, *e was nil, or the line is broken', () => {
    expectLib.expect(cljsErrorCauses.parseCauses('nil\n')).toBeUndefined();
    expectLib.expect(cljsErrorCauses.parseCauses(`${marker}[]`)).toBeUndefined();
    expectLib.expect(cljsErrorCauses.parseCauses(`${marker}[{`)).toBeUndefined();
  });

  it('prints with the marker it reads', () => {
    expectLib.expect(cljsErrorCauses.causesCode).toContain(`"${marker}"`);
  });
});
