import * as expect from 'expect';
import * as respacer from '../../../calva-fmt/src/respacer';
import * as model from '../../../cursor-doc/model';
import {
  docFromTextNotation,
  textAndSelection,
  getText,
  textAndSelections,
} from '../common/text-notation';

model.initScanner(20000);

describe('respacer', () => {
  it('Inserts formatting space at the beginning', () => {
    const actual = docFromTextNotation('(def| foo 42)');
    const expected = docFromTextNotation('  (def| foo 42)');
    const spaceEdits = respacer.whitespaceEdits(0, getText(actual), getText(expected));
    actual.model.editNow(
      spaceEdits.map((se) => new model.ModelEdit('changeRange', [se.start, se.end, se.text])),
      { skipFormat: true }
    );
    expect(textAndSelection(actual)).toEqual(textAndSelection(expected));
  });
  it('Inserts formatting space at the middle', () => {
    const actual = docFromTextNotation('(def foo|[42])');
    const expected = docFromTextNotation('  (def foo| [42])');
    const spaceEdits = respacer.whitespaceEdits(0, getText(actual), getText(expected));
    actual.model.editNow(
      spaceEdits.map((se) => new model.ModelEdit('changeRange', [se.start, se.end, se.text])),
      { skipFormat: true }
    );
    expect(textAndSelection(actual)).toEqual(textAndSelection(expected));
  });
  it('Inserts formatting space at the end', () => {
    const actual = docFromTextNotation('(def foo| [42])');
    const expected = docFromTextNotation('(def foo| [42])  ');
    const spaceEdits = respacer.whitespaceEdits(0, getText(actual), getText(expected));
    actual.model.editNow(
      spaceEdits.map((se) => new model.ModelEdit('changeRange', [se.start, se.end, se.text])),
      { skipFormat: true }
    );
    expect(textAndSelection(actual)).toEqual(textAndSelection(expected));
  });
  it('Removes formatting space from the beginning', () => {
    const actual = docFromTextNotation('  (def foo| 42)');
    const expected = docFromTextNotation('(def foo| 42)');
    const spaceEdits = respacer.whitespaceEdits(0, getText(actual), getText(expected));
    actual.model.editNow(
      spaceEdits.map((se) => new model.ModelEdit('changeRange', [se.start, se.end, se.text])),
      { skipFormat: true }
    );
    expect(textAndSelection(actual)).toEqual(textAndSelection(expected));
  });
  it('Removes formatting space from the middle', () => {
    const actual = docFromTextNotation('(def foo|  42)');
    const expected = docFromTextNotation('(def foo| 42)');
    const spaceEdits = respacer.whitespaceEdits(0, getText(actual), getText(expected));
    actual.model.editNow(
      spaceEdits.map((se) => new model.ModelEdit('changeRange', [se.start, se.end, se.text])),
      { skipFormat: true }
    );
    expect(textAndSelection(actual)).toEqual(textAndSelection(expected));
  });
  it('Resizes formatting space in the middle', () => {
    const actual = docFromTextNotation('(def•foo| 42)');
    const expected = docFromTextNotation('(def•  foo| 42)');
    const spaceEdits = respacer.whitespaceEdits(0, getText(actual), getText(expected));
    actual.model.editNow(
      spaceEdits.map((se) => new model.ModelEdit('changeRange', [se.start, se.end, se.text])),
      { skipFormat: true }
    );
    expect(textAndSelection(actual)).toEqual(textAndSelection(expected));
  });
  it('Inserts, deletes, and resizes formatting space throughout', () => {
    const actual = docFromTextNotation('  (def•foo|  42)');
    const expected = docFromTextNotation('(def•  foo| 42)  ');
    const spaceEdits = respacer.whitespaceEdits(0, getText(actual), getText(expected));
    actual.model.editNow(
      spaceEdits.map((se) => new model.ModelEdit('changeRange', [se.start, se.end, se.text])),
      { skipFormat: true }
    );
    expect(textAndSelection(actual)).toEqual(textAndSelection(expected));
  });
  it('Preserves multiple cursors amidst formatting-space alterations', () => {
    const actual = docFromTextNotation('  |(def•f|2oo|3  42)');
    const expected = docFromTextNotation('|(def•  f|2oo|3 42  )');
    const spaceEdits = respacer.whitespaceEdits(0, getText(actual), getText(expected));
    actual.model.editNow(
      spaceEdits.map((se) => new model.ModelEdit('changeRange', [se.start, se.end, se.text])),
      { skipFormat: true }
    );
    expect(textAndSelection(actual)).toEqual(textAndSelection(expected));
  });
});
