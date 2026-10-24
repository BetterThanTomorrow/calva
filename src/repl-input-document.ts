import * as model from './cursor-doc/model';
import * as cursorContext from './cursor-doc/cursor-context';

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

export function cursorContexts(doc: model.EditableDocument): Record<string, boolean> {
  const contexts = cursorContext.determineContexts(doc);
  return Object.fromEntries(
    cursorContext.allCursorContexts.map((context) => [context, contexts.includes(context)])
  );
}
