import { LineInputModel, ModelEditDirectedRange, ModelEditRange } from '../../cursor-doc/model';
import * as clojureLexer from '../../cursor-doc/clojure-lexer';
import * as pareditConfig from '../../cursor-doc/paredit-config';
import { LispTokenCursor } from '../../cursor-doc/token-cursor';

export type RainbowOptions = {
  colorCount: number;
  cycleBracketColors: boolean;
  guides: boolean;
  commentFormConfig?: pareditConfig.CommentFormConfig;
};

export type ColoredRange = { range: ModelEditRange; colorIndex: number };

export type BracketPair = { open: ModelEditRange; close: ModelEditRange };

export type RainbowBrackets = {
  brackets: ColoredRange[];
  misplaced: ModelEditRange[];
  commentForms: ModelEditRange[];
  ignoredForms: ModelEditRange[];
  topLevelIgnoredForms: ModelEditRange[];
  guides: ColoredRange[];
  /** Color index of the guides placed for a form, by the offset of its opening bracket */
  guideColors: Map<number, number>;
  /** Bracket pairs by the offset of the closing bracket */
  pairsBack: Map<number, BracketPair>;
  /** Bracket pairs by each offset of the opening bracket, reader tags included */
  pairsForward: Map<number, BracketPair>;
};

type StackItem = {
  char: string;
  start: number;
  end: number;
  pairIdx: number;
  opensCommentForm?: boolean;
};

type Painting = {
  model: LineInputModel;
  options: RainbowOptions;
  colorIndex: (depth: number) => number;
  lineStarts: number[];
  stack: StackItem[];
  depth: number;
  inCommentForm: boolean;
  rainbow: RainbowBrackets;
};

function lineStarts(model: LineInputModel): number[] {
  const starts: number[] = [];
  let offset = 0;
  for (const line of model.lines) {
    starts.push(offset);
    offset += line.text.length + model.lineEndingLength;
  }
  return starts;
}

function rowCol(starts: number[], offset: number): [row: number, col: number] {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid] <= offset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return [low, offset - starts[low]];
}

/**
 * The guides of the form opening at `openOffset` and closing at `closeOffset`:
 * one on each line below the opening bracket indented at least to its column.
 */
function formGuides(
  model: LineInputModel,
  starts: number[],
  openOffset: number,
  closeOffset: number
): number[] {
  const [openRow, openCol] = rowCol(starts, openOffset);
  const [closeRow] = rowCol(starts, closeOffset);
  const guides: number[] = [];
  for (let row = openRow + 1; row <= closeRow; row++) {
    if (model.getLineText(row).match(/^ */)[0].length >= openCol) {
      guides.push(starts[row] + openCol);
    }
  }
  return guides;
}

/** Where to start and stop painting to cover the `range`: whole top level forms. */
function paintingRange(model: LineInputModel, [startOffset, endOffset]: ModelEditRange) {
  const startRange = model.getTokenCursor(0).rangeForDefun(startOffset, false);
  const endRange = model.getTokenCursor(endOffset).rangeForDefun(endOffset, false);
  const rangeStart = startRange ? startRange[0] : startOffset;
  const rangeEnd = endRange ? endRange[1] : endOffset;
  const topLevelSentinelCursor = model.getTokenCursor(rangeStart);
  let startPaintingFrom = rangeStart;
  for (let i = 0; i < 25 && topLevelSentinelCursor.backwardSexp(); i++) {
    if (topLevelSentinelCursor.getToken().type === 'ignore') {
      do {
        topLevelSentinelCursor.backwardSexp();
      } while (
        !topLevelSentinelCursor.atStart() &&
        topLevelSentinelCursor.getToken().type === 'ignore'
      );
      startPaintingFrom = topLevelSentinelCursor.offsetStart;
      break;
    }
  }
  return [startPaintingFrom, rangeEnd];
}

function paintIgnoredForm({ rainbow }: Painting, cursor: LispTokenCursor) {
  const ignoreCursor = cursor.clone();
  const start = ignoreCursor.offsetStart;
  let ignoreCount = 0;
  while (ignoreCursor.getToken().type === 'ignore') {
    ignoreCount++;
    ignoreCursor.next();
    ignoreCursor.forwardWhitespace();
  }
  for (let i = 0; i < ignoreCount; i++) {
    ignoreCursor.forwardSexp(true, true, true);
  }
  const range: ModelEditRange = [start, ignoreCursor.offsetStart];
  if (cursor.atTopLevel()) {
    rainbow.topLevelIgnoredForms.push(range);
  } else {
    rainbow.ignoredForms.push(range);
  }
}

function markCommentForm(painting: Painting, cursor: LispTokenCursor) {
  const peekCursor = cursor.clone();
  peekCursor.backwardWhitespace();
  if (peekCursor.getPrevToken().raw === '(') {
    painting.inCommentForm = true;
    painting.stack[painting.stack.length - 1].opensCommentForm = true;
  }
}

function paintOpen(painting: Painting, cursor: LispTokenCursor) {
  const readerCursor = cursor.clone();
  readerCursor.backwardThroughAnyReader();
  const start = readerCursor.offsetStart;
  const end = cursor.offsetEnd;
  painting.rainbow.brackets.push({
    range: [start, end],
    colorIndex: painting.colorIndex(painting.depth),
  });
  painting.depth++;
  painting.stack.push({
    char: cursor.getToken().raw,
    start,
    end,
    pairIdx: undefined,
    opensCommentForm: false,
  });
}

function openingIndex(stack: StackItem[]) {
  let pairIdx = stack.length - 1;
  while (pairIdx >= 0 && stack[pairIdx].pairIdx !== undefined) {
    pairIdx = stack[pairIdx].pairIdx - 1;
  }
  return pairIdx;
}

function paintGuides(painting: Painting, openOffset: number, closeOffset: number) {
  const { model, lineStarts, rainbow } = painting;
  const colorIndex = painting.colorIndex(painting.depth);
  const guides = formGuides(model, lineStarts, openOffset, closeOffset);
  guides.forEach((offset) => rainbow.guides.push({ range: [offset, offset], colorIndex }));
  if (guides.length > 0) {
    rainbow.guideColors.set(openOffset, colorIndex);
  }
}

function paintClose(painting: Painting, cursor: LispTokenCursor) {
  const { stack, rainbow } = painting;
  const char = cursor.getToken().raw;
  const pos = cursor.offsetStart;
  const pairIdx = openingIndex(stack);
  const isPaired = pairIdx >= 0 && clojureLexer.validPair(stack[pairIdx].char, char);
  if (!isPaired) {
    rainbow.misplaced.push([pos, pos + 1]);
    return;
  }
  const pair = stack[pairIdx];
  const bracketPair: BracketPair = {
    open: [pair.end - 1, pair.end],
    close: [pos, pos + char.length],
  };
  if (painting.inCommentForm && pair.opensCommentForm) {
    rainbow.commentForms.push([pair.start, pos + char.length]);
    painting.inCommentForm = false;
  }
  stack.push({ char, start: pos, end: pos + char.length, pairIdx });
  rainbow.pairsBack.set(pos, bracketPair);
  for (let offset = pair.start; offset < pair.end; offset++) {
    rainbow.pairsForward.set(offset, bracketPair);
  }
  painting.depth--;
  rainbow.brackets.push({ range: [pos, pos + 1], colorIndex: painting.colorIndex(painting.depth) });
  if (painting.options.guides) {
    paintGuides(painting, pair.end - 1, pos + 1);
  }
}

function isStringOrLiteral(token: clojureLexer.Token) {
  return ['str-inside', 'lit'].includes(token.type) || token.raw.includes('"');
}

function paintToken(painting: Painting, cursor: LispTokenCursor) {
  const token = cursor.getToken();
  if (isStringOrLiteral(token)) {
    return;
  }
  if (token.type === 'ignore') {
    paintIgnoredForm(painting, cursor);
  }
  const { inCommentForm, options } = painting;
  if (!inCommentForm && pareditConfig.isCommentFormHead(token.raw, options.commentFormConfig)) {
    markCommentForm(painting, cursor);
  }
  if (token.type === 'open') {
    paintOpen(painting, cursor);
  } else if (token.type === 'close') {
    paintClose(painting, cursor);
  }
}

/**
 * The rainbow brackets of the top level forms that cover the `ranges` (offsets) of `model`:
 * bracket colors, misplaced brackets, comment and ignored forms, guides, and bracket pairs.
 */
export function rainbowBrackets(
  model: LineInputModel,
  ranges: ModelEditRange[],
  options: RainbowOptions
): RainbowBrackets {
  const { colorCount, cycleBracketColors } = options;
  const painting: Painting = {
    model,
    options,
    colorIndex: cycleBracketColors
      ? (depth) => depth % colorCount
      : (depth) => Math.min(depth, colorCount - 1),
    lineStarts: options.guides ? lineStarts(model) : [],
    stack: [],
    depth: 0,
    inCommentForm: false,
    rainbow: {
      brackets: [],
      misplaced: [],
      commentForms: [],
      ignoredForms: [],
      topLevelIgnoredForms: [],
      guides: [],
      guideColors: new Map(),
      pairsBack: new Map(),
      pairsForward: new Map(),
    },
  };
  ranges.forEach((range) => {
    const [from, to] = paintingRange(model, range);
    const cursor = model.getTokenCursor(from);
    do {
      cursor.forwardWhitespace();
      paintToken(painting, cursor);
    } while (cursor.offsetStart < to && cursor.next());
  });
  return painting.rainbow;
}

/** The bracket pairs to highlight for the `selections` ([anchor, active] offsets). */
export function matchedBrackets(
  { pairsBack, pairsForward }: RainbowBrackets,
  selections: ModelEditDirectedRange[]
): ModelEditRange[] {
  return selections.flatMap(([anchor, active]) => {
    const before = active <= anchor ? pairsBack.get(active - 1) : undefined;
    const after = active >= anchor ? pairsForward.get(active) : undefined;
    return [before, after].flatMap((pair) => (pair ? [pair.open, pair.close] : []));
  });
}

/** The innermost form around `offset` that has guides, from its opening bracket to its end. */
function innermostGuidedForm(
  model: LineInputModel,
  guideColors: Map<number, number>,
  offset: number
): ColoredRange | undefined {
  const cursor = model.getTokenCursor(offset);
  const visitedEnds = [offset];
  while (cursor.forwardList() && cursor.upList()) {
    const end = cursor.offsetStart;
    if (visitedEnds.includes(end)) {
      return;
    }
    visitedEnds.push(end);
    cursor.backwardSexp();
    const downCursor = cursor.clone();
    if (!downCursor.downList()) {
      return;
    }
    const start = downCursor.offsetStart - 1;
    const colorIndex = guideColors.get(start);
    if (colorIndex !== undefined) {
      return { range: [start, end], colorIndex };
    }
  }
}

/**
 * For each of the `selections` ([start, end] offsets), the guides of the innermost
 * form around it that has guides. Guides shared by several selections come once.
 */
export function activeGuides(
  model: LineInputModel,
  { guideColors }: RainbowBrackets,
  selections: ModelEditRange[]
): ColoredRange[] {
  const starts = lineStarts(model);
  const guides = new Map<string, ColoredRange>();
  const visitedForms = new Set<string>();
  selections.forEach(([selectionStart, selectionEnd]) => {
    const form = innermostGuidedForm(model, guideColors, selectionStart);
    if (!form) {
      return;
    }
    const {
      range: [start, end],
      colorIndex,
    } = form;
    const formKey = `${colorIndex}:${start}`;
    const containsSelection = start <= selectionStart && selectionEnd <= end;
    if (containsSelection && !visitedForms.has(formKey)) {
      visitedForms.add(formKey);
      formGuides(model, starts, start, end).forEach((offset) =>
        guides.set(`${colorIndex}:${offset}`, { range: [offset, offset], colorIndex })
      );
    }
  });
  return [...guides.values()];
}
