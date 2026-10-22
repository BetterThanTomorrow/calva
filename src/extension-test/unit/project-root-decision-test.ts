import * as assert from 'assert';
import * as path from 'path';
import type * as csTypes from '../../nrepl/connect-sequence-types';
import {
  decideProjectRoot,
  RootDecision,
  RootDecisionInput,
  SequenceForRootDecision,
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

function entry(
  partial: Partial<csTypes.ReplConnectSequence> & Pick<csTypes.ReplConnectSequence, 'name'>,
  rootKey?: string
): SequenceForRootDecision {
  return { sequence: sequence(partial), rootKey };
}

function input(partial: Partial<RootDecisionInput>): RootDecisionInput {
  return {
    connectType: 'jack-in',
    disableAutoSelect: false,
    sequences: [],
    candidateRoots: [rootA, rootB],
    closestRoot: rootB,
    closestRootKey: 'b/bb-mini2',
    workspaceFolders: [wsA, wsB],
    ...partial,
  };
}

const cases: { name: string; input: RootDecisionInput; expected: RootDecision }[] = [
  {
    name: 'a passed sequence with an absolute root uses that root',
    input: input({
      passedSequence: entry({ name: 'passed', projectRootPath: [rootB] }, 'ignored'),
      sequences: [
        entry({ name: 'auto', autoSelectForJackIn: true, projectRootPath: [rootA] }, 'a/bb-mini'),
      ],
    }),
    expected: { root: rootB, sequence: sequence({ name: 'passed', projectRootPath: [rootB] }) },
  },
  {
    name: 'a passed sequence with a relative root resolves against the first workspace folder',
    input: input({
      passedSequence: entry({ name: 'passed', projectRootPath: ['bb-mini'] }),
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
      passedSequence: entry({ name: 'passed' }),
      sequences: [
        entry(
          { name: 'auto', autoSelectForJackIn: true, projectRootPath: ['bb-mini'] },
          'a/bb-mini'
        ),
      ],
      closestRootKey: 'a/bb-mini',
    }),
    expected: { ask: { candidates: [rootA, rootB], preselect: rootB } },
  },
  {
    name: 'disableAutoSelect with a passed sequence still uses that sequence root',
    input: input({
      disableAutoSelect: true,
      passedSequence: entry({ name: 'passed', projectRootPath: [rootA] }),
      sequences: [
        entry({ name: 'auto', autoSelectForJackIn: true, projectRootPath: [rootB] }, 'b/bb-mini2'),
      ],
    }),
    expected: { root: rootA, sequence: sequence({ name: 'passed', projectRootPath: [rootA] }) },
  },
  {
    name: 'disableAutoSelect without a sequence asks among several candidates',
    input: input({
      disableAutoSelect: true,
      sequences: [
        entry({ name: 'auto', autoSelectForJackIn: true, projectRootPath: [rootA] }, 'a/bb-mini'),
      ],
    }),
    expected: { ask: { candidates: [rootA, rootB], preselect: rootB } },
  },
  {
    name: 'disableAutoSelect with a passed sequence and no root asks among several candidates',
    input: input({
      disableAutoSelect: true,
      passedSequence: entry({ name: 'passed' }),
    }),
    expected: { ask: { candidates: [rootA, rootB], preselect: rootB } },
  },
  {
    name: 'one candidate is the root without a menu',
    input: input({
      disableAutoSelect: true,
      candidateRoots: [rootA],
      closestRoot: rootA,
      closestRootKey: 'a/bb-mini',
    }),
    expected: { root: rootA },
  },
  {
    name: 'zero candidates and no sequence root has nothing to ask',
    input: input({
      disableAutoSelect: true,
      candidateRoots: [],
      closestRoot: undefined,
      closestRootKey: undefined,
    }),
    expected: { noCandidates: true },
  },
  {
    name: 'an active file inside a candidate preselects that candidate',
    input: input({
      disableAutoSelect: true,
      closestRoot: rootA,
      closestRootKey: 'a/bb-mini',
    }),
    expected: { ask: { candidates: [rootA, rootB], preselect: rootA } },
  },
  {
    name: 'an active file outside the candidates asks with no preselection',
    input: input({
      disableAutoSelect: true,
      closestRoot: undefined,
      closestRootKey: undefined,
    }),
    expected: { ask: { candidates: [rootA, rootB], preselect: undefined } },
  },
  {
    name: 'an auto-select sequence whose key matches the closest root wins',
    input: input({
      sequences: [
        entry({ name: 'first', autoSelectForJackIn: true, projectRootPath: [rootA] }, 'a/bb-mini'),
        entry(
          { name: 'second', autoSelectForJackIn: true, projectRootPath: [rootB] },
          'b/bb-mini2'
        ),
      ],
      closestRootKey: 'b/bb-mini2',
    }),
    expected: {
      root: rootB,
      sequence: sequence({ name: 'second', autoSelectForJackIn: true, projectRootPath: [rootB] }),
    },
  },
  {
    name: 'a relative root key that differs from the closest key keeps the first auto-select sequence',
    input: input({
      sequences: [
        entry(
          { name: 'bb-mini', autoSelectForJackIn: true, projectRootPath: ['bb-mini'] },
          'bb-mini'
        ),
        entry(
          { name: 'bb-mini2', autoSelectForJackIn: true, projectRootPath: ['bb-mini2'] },
          'bb-mini2'
        ),
      ],
      closestRoot: rootB,
      closestRootKey: path.join('b', 'bb-mini2'),
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
    name: 'a single workspace folder whose keys match selects that sequence',
    input: input({
      sequences: [
        entry(
          { name: 'bb-mini', autoSelectForJackIn: true, projectRootPath: ['bb-mini'] },
          'bb-mini'
        ),
        entry(
          { name: 'bb-mini2', autoSelectForJackIn: true, projectRootPath: ['bb-mini2'] },
          'bb-mini2'
        ),
      ],
      candidateRoots: [path.join(wsA, 'bb-mini'), path.join(wsA, 'bb-mini2')],
      closestRoot: path.join(wsA, 'bb-mini2'),
      closestRootKey: 'bb-mini2',
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
    name: 'an auto-select sequence without a root still skips the project type menu',
    input: input({
      sequences: [entry({ name: 'typeless', autoSelectForJackIn: true })],
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
        entry({ name: 'jack', autoSelectForJackIn: true, projectRootPath: [rootA] }, 'a/bb-mini'),
        entry(
          { name: 'connect', autoSelectForConnect: true, projectRootPath: [rootB] },
          'b/bb-mini2'
        ),
      ],
      closestRootKey: 'b/bb-mini2',
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
        entry(
          { name: 'connect', autoSelectForConnect: true, projectRootPath: [rootB] },
          'b/bb-mini2'
        ),
      ],
      closestRootKey: 'b/bb-mini2',
    }),
    expected: { ask: { candidates: [rootA, rootB], preselect: rootB } },
  },
  {
    name: 'a relative auto-select root that does not resolve asks for nothing',
    input: input({
      sequences: [
        entry({ name: 'rel', autoSelectForJackIn: true, projectRootPath: ['bb-mini'] }, 'bb-mini'),
      ],
      closestRootKey: 'bb-mini',
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
