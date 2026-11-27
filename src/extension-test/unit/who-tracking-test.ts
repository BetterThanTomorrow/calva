import * as expectLib from 'expect';
import * as whoTracking from '../../api/who-tracking';

describe('who-tracking nreplWho', () => {
  it('puts the evaluator’s who on the nREPL message', () => {
    expectLib.expect(whoTracking.nreplWho('joyride-tester')).toEqual({ who: 'joyride-tester' });
  });

  it('leaves Calva’s own whos off the message', () => {
    expectLib.expect(whoTracking.nreplWho('ui')).toEqual({});
    expectLib.expect(whoTracking.nreplWho('api')).toEqual({});
    expectLib.expect(whoTracking.nreplWho(undefined)).toEqual({});
  });
});
