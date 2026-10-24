import * as model from './cursor-doc/model';
import * as cursorContext from './cursor-doc/cursor-context';
import * as indent from './cursor-doc/indent';
import * as rainbowBrackets from './highlight/src/rainbow-brackets';
import type { FormatterConfig } from './formatter-config';

export type Selections = [anchor: number, active: number][];

export type DocumentState = {
  text: string;
  selections: Selections;
  selectionsStack: Selections[];
};

const modelSelections = (selections: Selections) =>
  selections.map(([anchor, active]) => new model.ModelEditSelection(anchor, active));

const plainSelections = (selections: model.ModelEditSelection[]): Selections =>
  selections.map(({ anchor, active }) => [anchor, active]);

export function stringDocument(
  text: string,
  selections: Selections,
  selectionsStack: Selections[] = []
): model.StringDocument {
  const doc = new model.StringDocument(text);
  doc.selections = modelSelections(selections);
  doc.selectionsStack = selectionsStack.map(modelSelections);
  doc.insertString = (s: string) =>
    doc.model.editNow([new model.ModelEdit('insertString', [doc.selections[0].anchor, s])], {
      selections: doc.selections,
    });
  doc.getSelectionText = () => doc.model.getText(doc.selections[0].start, doc.selections[0].end);
  return doc;
}

export function documentState(doc: model.StringDocument): DocumentState {
  return {
    text: doc.model.getText(0, doc.model.maxOffset),
    selections: plainSelections(doc.selections),
    selectionsStack: doc.selectionsStack.map(plainSelections),
  };
}

/** Breaks the line at every selection, indenting the new line the way Calva indents. */
export function newLine(doc: model.StringDocument, config?: FormatterConfig) {
  const breaks = doc.selections
    .map(({ start, end }) => ({
      start,
      end,
      text: '\n' + ' '.repeat(indent.getIndent(doc.model, start, config)),
    }))
    .sort((a, b) => a.start - b.start);
  let shift = 0;
  const cursors = breaks.map(({ start, end, text }) => {
    const cursor = new model.ModelEditSelection(start + shift + text.length);
    shift += text.length - (end - start);
    return cursor;
  });
  doc.model.editNow(
    breaks
      .reverse()
      .map(({ start, end, text }) => new model.ModelEdit('changeRange', [start, end, text])),
    { selections: cursors }
  );
}

/** Applies `changes`, given last first, skipping a change that overlaps the change after it. */
export function applyChanges(
  doc: model.StringDocument,
  changes: { start: number; end: number; text: string }[]
) {
  let lowestStart = Infinity;
  const applicable = changes.filter(({ start, end }) => {
    const applies = end < lowestStart;
    if (applies) {
      lowestStart = start;
    }
    return applies;
  });
  doc.model.editNow(
    applicable.map(
      ({ start, end, text }) => new model.ModelEdit('changeRange', [start, end, text])
    ),
    {}
  );
}

export type Range = [start: number, end: number];

export type Brackets = {
  brackets: [start: number, end: number, colorIndex: number][];
  misplaced: Range[];
  commentForms: Range[];
  ignoredForms: Range[];
  topLevelIgnoredForms: Range[];
  matched: Range[];
};

/** The rainbow brackets of the whole of `doc`, and the brackets matched at its cursors, the way Calva paints them in files. */
export function brackets(
  doc: model.StringDocument,
  options: Omit<rainbowBrackets.RainbowOptions, 'guides'>
): Brackets {
  const rainbow = rainbowBrackets.rainbowBrackets(doc.model, [[0, doc.model.maxOffset]], {
    ...options,
    guides: false,
  });
  const { misplaced, commentForms, ignoredForms, topLevelIgnoredForms } = rainbow;
  return {
    brackets: rainbow.brackets.map(({ range: [start, end], colorIndex }) => [
      start,
      end,
      colorIndex,
    ]),
    misplaced,
    commentForms,
    ignoredForms,
    topLevelIgnoredForms,
    matched: rainbowBrackets.matchedBrackets(
      rainbow,
      doc.selections.map(({ anchor, active }) => [anchor, active])
    ),
  };
}

export function cursorContexts(doc: model.EditableDocument): Record<string, boolean> {
  const contexts = cursorContext.determineContexts(doc);
  return Object.fromEntries(
    cursorContext.allCursorContexts.map((context) => [context, contexts.includes(context)])
  );
}
