import * as expectLib from 'expect';
import * as model from '../../../cursor-doc/model';
import * as textNotation from '../common/text-notation';

model.initScanner(20000);

describe('StringDocument', () => {
  it('inserts at the anchor of the first selection, keeping the selections', () => {
    const doc = textNotation.docFromTextNotation('(a |b|)');
    doc.insertString('x ');
    expectLib
      .expect(textNotation.textAndSelection(doc))
      .toEqual(textNotation.textAndSelection(textNotation.docFromTextNotation('(a |x| b)')));
  });

  it('inserts at the start when there is no selection', () => {
    const doc = new model.StringDocument('(a)');
    doc.insertString('b ');
    expectLib.expect(doc.model.getText(0, doc.model.maxOffset)).toBe('b (a)');
  });

  it('gives the text of the first selection', () => {
    expectLib.expect(textNotation.docFromTextNotation('(a |b c|)').getSelectionText()).toBe('b c');
  });

  it('gives no text when there is no selection', () => {
    expectLib.expect(new model.StringDocument('(a)').getSelectionText()).toBe('');
  });
});
