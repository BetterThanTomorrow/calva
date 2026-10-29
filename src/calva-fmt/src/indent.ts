import * as cljsLib from '../../../out/cljs-lib/cljs-lib';
import { ModelEdit, ModelEditSelection } from '../../cursor-doc/model';
import type { EditableDocument, ModelEditFunction } from '../../cursor-doc/model';
import { lineStartOffsets, rowColAt } from '../../cursor-doc/utilities';

type InferResult = {
  success: boolean;
  edits?: { start: { line: number }; text: string }[];
  line?: number;
  character?: number;
  'error-msg'?: string;
};

type Spacing = {
  edit: ModelEdit<ModelEditFunction>;
  lineText: string;
  character: number;
  change: { line: number; character: number; 'old-text': string; 'new-text': string };
};

/** Inserting `spacing` at the cursor, or removing a space before it, `undefined` when there is none. */
function spacingAtCursor(
  lineText: string,
  [line, character]: [number, number],
  cursor: number,
  spacing: string,
  forward: boolean
): Spacing | undefined {
  if (forward) {
    return {
      edit: new ModelEdit('insertString', [cursor, spacing]),
      lineText: lineText.slice(0, character) + spacing + lineText.slice(character),
      character: character + spacing.length,
      change: { line, character, 'old-text': '', 'new-text': spacing },
    };
  }
  if (!/ $/.test(lineText.slice(0, character))) {
    return undefined;
  }
  const length = Math.max(spacing.length, 1);
  const spacedCharacter = character - length;
  return {
    edit: new ModelEdit('deleteRange', [cursor - length, length]),
    lineText: lineText.slice(0, spacedCharacter) + lineText.slice(character),
    character: spacedCharacter,
    change: {
      line,
      character: spacedCharacter,
      'old-text': lineText.slice(spacedCharacter, character),
      'new-text': '',
    },
  };
}

function changedLineEdits(lines: string[], newLines: string[], lineStarts: number[]) {
  return lines
    .map((text, i) =>
      newLines[i] === text
        ? undefined
        : new ModelEdit('changeRange', [lineStarts[i], lineStarts[i] + text.length, newLines[i]])
    )
    .filter((edit) => edit !== undefined)
    .reverse();
}

/**
 * Inserts `spacing` at the cursor (`forward`), or removes a space before it,
 * then lets parinfer's smart mode adjust the indents that follow from that.
 * Rejects with the formatter's message, after the spacing edit, when parinfer fails.
 */
export async function indent(doc: EditableDocument, spacing: string, forward = true) {
  const { lineEnding, lineEndingLength } = doc.model;
  const cursor = doc.selections[0].active;
  const lines = doc.model.getText(0, Infinity).split(lineEnding);
  const lineStarts = lineStartOffsets(lines, lineEndingLength);
  const [line, character] = rowColAt(lineStarts, cursor);
  const spaced = spacingAtCursor(lines[line], [line, character], cursor, spacing, forward);
  if (!spaced) {
    return;
  }
  const spacedLines = lines.map((text, i) => (i === line ? spaced.lineText : text));
  const result: InferResult = cljsLib.inferIndents({
    text: spacedLines.join(lineEnding),
    line,
    character: spaced.character,
    'previous-line': line,
    'previous-character': character,
    changes: [spaced.change],
  });
  if (!result.success) {
    await doc.model.edit([spaced.edit], {
      selections: [new ModelEditSelection(lineStarts[line] + spaced.character)],
      skipFormat: true,
      undoStopBefore: false,
    });
    throw new Error(result['error-msg']);
  }
  const inferredLines = [...spacedLines];
  result.edits.forEach(({ start, text }) => {
    inferredLines[start.line] = text;
  });
  const inferredLineStarts = lineStartOffsets(inferredLines, lineEndingLength);
  return doc.model.edit(changedLineEdits(lines, inferredLines, lineStarts), {
    selections: [new ModelEditSelection(inferredLineStarts[result.line] + result.character)],
    skipFormat: true,
    undoStopBefore: false,
  });
}
