import * as assert from 'assert';
import * as path from 'path';
import type * as csTypes from '../../nrepl/connect-sequence-types';
import {
  decideProjectRoot,
  overridingSequenceRoot,
  RootDecision,
  RootDecisionInput,
} from '../../project-root-decision';

const wsA = path.join('/ws', 'a');
const wsB = path.join('/ws', 'b');
const rootA = path.join(wsA, 'bb-mini');
const rootB = path.join(wsB, 'bb-mini2');

function sequence(
  partial: Partial<csTypes.ReplConnectSequence> & Pick<csTypes.ReplConnectSequence, 'name'>
): csTypes.ReplConnectSequence {
  return {
    projectType: 'deps.edn' as csTypes.ReplConnectSequence['projectType'],
    ...partial,
  };
}

function input(partial: Partial<RootDecisionInput>): RootDecisionInput {
  return {
    connectType: 'jack-in',
    disableAutoSelect: false,
    sequences: [],
    candidateRoots: [rootA, rootB],
    closestRoot: rootB,
    workspaceFolders: [wsA, wsB],
    ...partial,
  };
}

const cases: { name: string; input: RootDecisionInput; expected: RootDecision }[] = [
  {
    name: 'a passed sequence with an absolute root uses that root',
    input: input({
      passedSequence: sequence({ name: 'passed', projectRootPath: [rootB] }),
      sequences: [sequence({ name: 'auto', autoSelectForJackIn: true, projectRootPath: [rootA] })],
    }),
    expected: { root: rootB, sequence: sequence({ name: 'passed', projectRootPath: [rootB] }) },
  },
  {
    name: 'a passed sequence with a relative root resolves against the first workspace folder',
    input: input({
      passedSequence: sequence({ name: 'passed', projectRootPath: ['bb-mini'] }),
      workspaceFolders: [wsA],
    }),
    expected: {
      root: path.join(wsA, 'bb-mini'),
      sequence: sequence({ name: 'passed', projectRootPath: ['bb-mini'] }),
    },
  },
  {
    name: 'a passed sequence without a root asks among the candidates instead of taking an auto-select root',
    input: input({
      passedSequence: sequence({ name: 'passed' }),
      sequences: [
        sequence({ name: 'auto', autoSelectForJackIn: true, projectRootPath: ['bb-mini'] }),
      ],
      closestRoot: rootA,
    }),
    expected: { ask: { candidates: [rootA, rootB], preselect: rootA } },
  },
  {
    name: 'disableAutoSelect with a passed sequence still uses that sequence root',
    input: input({
      disableAutoSelect: true,
      passedSequence: sequence({ name: 'passed', projectRootPath: [rootA] }),
      sequences: [sequence({ name: 'auto', autoSelectForJackIn: true, projectRootPath: [rootB] })],
    }),
    expected: { root: rootA, sequence: sequence({ name: 'passed', projectRootPath: [rootA] }) },
  },
  {
    name: 'disableAutoSelect without a sequence asks among several candidates',
    input: input({
      disableAutoSelect: true,
      sequences: [sequence({ name: 'auto', autoSelectForJackIn: true, projectRootPath: [rootA] })],
    }),
    expected: { ask: { candidates: [rootA, rootB], preselect: rootB } },
  },
  {
    name: 'disableAutoSelect with a passed sequence and no root asks among several candidates',
    input: input({
      disableAutoSelect: true,
      passedSequence: sequence({ name: 'passed' }),
    }),
    expected: { ask: { candidates: [rootA, rootB], preselect: rootB } },
  },
  {
    name: 'one candidate is the root without a menu',
    input: input({
      disableAutoSelect: true,
      candidateRoots: [rootA],
      closestRoot: rootA,
    }),
    expected: { root: rootA },
  },
  {
    name: 'zero candidates and no sequence root has nothing to ask',
    input: input({
      disableAutoSelect: true,
      candidateRoots: [],
      closestRoot: undefined,
    }),
    expected: { noCandidates: true },
  },
  {
    name: 'an active file inside a candidate preselects that candidate',
    input: input({
      disableAutoSelect: true,
      closestRoot: rootA,
    }),
    expected: { ask: { candidates: [rootA, rootB], preselect: rootA } },
  },
  {
    name: 'an active file outside the candidates asks with no preselection',
    input: input({
      disableAutoSelect: true,
      closestRoot: undefined,
    }),
    expected: { ask: { candidates: [rootA, rootB], preselect: undefined } },
  },
  {
    name: 'an auto-select sequence whose root is the closest root wins',
    input: input({
      sequences: [
        sequence({ name: 'first', autoSelectForJackIn: true, projectRootPath: [rootA] }),
        sequence({ name: 'second', autoSelectForJackIn: true, projectRootPath: [rootB] }),
      ],
      closestRoot: rootB,
    }),
    expected: {
      root: rootB,
      sequence: sequence({ name: 'second', autoSelectForJackIn: true, projectRootPath: [rootB] }),
    },
  },
  {
    name: 'in a multi-root workspace, a relative root that resolves to the closest root wins',
    input: input({
      sequences: [
        sequence({
          name: 'project a',
          autoSelectForJackIn: true,
          projectRootPath: ['projects', 'a'],
        }),
        sequence({
          name: 'project b',
          autoSelectForJackIn: true,
          projectRootPath: ['projects', 'b'],
        }),
      ],
      candidateRoots: [path.join('/ws', 'projects', 'a'), path.join('/ws', 'projects', 'b')],
      closestRoot: path.join('/ws', 'projects', 'b'),
      workspaceFolders: ['/ws', path.join('/ws', 'projects', 'b')],
    }),
    expected: {
      root: path.join('/ws', 'projects', 'b'),
      sequence: sequence({
        name: 'project b',
        autoSelectForJackIn: true,
        projectRootPath: ['projects', 'b'],
      }),
    },
  },
  {
    name: 'a relative root that resolves outside the closest root keeps the first auto-select sequence',
    input: input({
      sequences: [
        sequence({ name: 'bb-mini', autoSelectForJackIn: true, projectRootPath: ['bb-mini'] }),
        sequence({ name: 'bb-mini2', autoSelectForJackIn: true, projectRootPath: ['bb-mini2'] }),
      ],
      closestRoot: rootB,
      workspaceFolders: [wsA, wsB],
    }),
    expected: {
      root: path.join(wsA, 'bb-mini'),
      sequence: sequence({
        name: 'bb-mini',
        autoSelectForJackIn: true,
        projectRootPath: ['bb-mini'],
      }),
    },
  },
  {
    name: 'a single workspace folder whose roots match selects that sequence',
    input: input({
      sequences: [
        sequence({ name: 'bb-mini', autoSelectForJackIn: true, projectRootPath: ['bb-mini'] }),
        sequence({ name: 'bb-mini2', autoSelectForJackIn: true, projectRootPath: ['bb-mini2'] }),
      ],
      candidateRoots: [path.join(wsA, 'bb-mini'), path.join(wsA, 'bb-mini2')],
      closestRoot: path.join(wsA, 'bb-mini2'),
      workspaceFolders: [wsA],
    }),
    expected: {
      root: path.join(wsA, 'bb-mini2'),
      sequence: sequence({
        name: 'bb-mini2',
        autoSelectForJackIn: true,
        projectRootPath: ['bb-mini2'],
      }),
    },
  },
  {
    name: 'a root with a trailing separator still matches the closest root',
    input: input({
      sequences: [
        sequence({ name: 'first', autoSelectForJackIn: true, projectRootPath: [rootA] }),
        sequence({
          name: 'second',
          autoSelectForJackIn: true,
          projectRootPath: [rootB + path.sep],
        }),
      ],
      closestRoot: rootB,
    }),
    expected: {
      root: rootB + path.sep,
      sequence: sequence({
        name: 'second',
        autoSelectForJackIn: true,
        projectRootPath: [rootB + path.sep],
      }),
    },
  },
  {
    name: 'an auto-select sequence without a root still skips the project type menu',
    input: input({
      sequences: [sequence({ name: 'typeless', autoSelectForJackIn: true })],
    }),
    expected: {
      ask: { candidates: [rootA, rootB], preselect: rootB },
      sequence: sequence({ name: 'typeless', autoSelectForJackIn: true }),
    },
  },
  {
    name: 'connect auto-select ignores a jack-in-only sequence',
    input: input({
      connectType: 'connect',
      sequences: [
        sequence({ name: 'jack', autoSelectForJackIn: true, projectRootPath: [rootA] }),
        sequence({ name: 'connect', autoSelectForConnect: true, projectRootPath: [rootB] }),
      ],
    }),
    expected: {
      root: rootB,
      sequence: sequence({
        name: 'connect',
        autoSelectForConnect: true,
        projectRootPath: [rootB],
      }),
    },
  },
  {
    name: 'jack-in auto-select ignores a connect-only sequence',
    input: input({
      sequences: [
        sequence({ name: 'connect', autoSelectForConnect: true, projectRootPath: [rootB] }),
      ],
    }),
    expected: { ask: { candidates: [rootA, rootB], preselect: rootB } },
  },
  {
    name: 'a relative auto-select root that does not resolve asks for nothing',
    input: input({
      sequences: [
        sequence({ name: 'rel', autoSelectForJackIn: true, projectRootPath: ['bb-mini'] }),
      ],
      workspaceFolders: [],
    }),
    expected: {
      noCandidates: true,
      sequence: sequence({
        name: 'rel',
        autoSelectForJackIn: true,
        projectRootPath: ['bb-mini'],
      }),
    },
  },
];

describe('decideProjectRoot', () => {
  for (const testCase of cases) {
    it(testCase.name, () => {
      assert.deepStrictEqual(decideProjectRoot(testCase.input), testCase.expected);
    });
  }
});

const overrideCases: {
  name: string;
  projectRootPath?: string[];
  chosenRoot: string;
  expected: string | undefined;
}[] = [
  {
    name: 'an absolute root for another folder overrides the chosen root',
    projectRootPath: [rootB],
    chosenRoot: rootA,
    expected: rootB,
  },
  {
    name: 'an absolute root for the chosen folder leaves the chosen root',
    projectRootPath: [rootA],
    chosenRoot: rootA,
    expected: undefined,
  },
  {
    name: 'a relative root for another folder overrides the chosen root',
    projectRootPath: ['bb-mini2'],
    chosenRoot: rootA,
    expected: path.join(wsA, 'bb-mini2'),
  },
  {
    name: 'a relative root for the chosen folder leaves the chosen root',
    projectRootPath: ['bb-mini'],
    chosenRoot: rootA,
    expected: undefined,
  },
  {
    name: 'a sequence without a root leaves the chosen root',
    chosenRoot: rootA,
    expected: undefined,
  },
];

describe('overridingSequenceRoot', () => {
  for (const testCase of overrideCases) {
    it(testCase.name, () => {
      assert.strictEqual(
        overridingSequenceRoot(
          sequence({ name: 'seq', projectRootPath: testCase.projectRootPath }),
          testCase.chosenRoot,
          [wsA, wsB]
        ),
        testCase.expected
      );
    });
  }
});
