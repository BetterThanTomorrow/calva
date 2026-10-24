import * as expectLib from 'expect';
import * as model from '../../../cursor-doc/model';
import { indent } from '../../../calva-fmt/src/indent';
import * as textNotation from '../common/text-notation';

const expect = expectLib.expect;

model.initScanner(20000);

async function indented(notation: string, forward: boolean) {
  const doc = textNotation.docFromTextNotation(notation);
  await indent(doc, ' ', forward);
  return textNotation.textNotationFromDoc(doc);
}

describe('indent', () => {
  describe('backward (calva-fmt.tabDedent)', () => {
    it('removes a space before the cursor', async () => {
      expect(await indented('(defn foo []•    |(bar))', false)).toBe('(defn foo []•   |(bar))');
      expect(await indented('(let [a 1•       |b 2])', false)).toBe('(let [a 1•      |b 2])');
    });

    it('removes a space before the cursor in the middle of a line', async () => {
      expect(await indented('(foo   |bar)', false)).toBe('(foo  |bar)');
    });

    it('moves the lines of the form with it', async () => {
      expect(await indented('(defn f []•   |(let [x 1]•     x))', false)).toBe(
        '(defn f []•  |(let [x 1]•    x))'
      );
    });

    it('does nothing without a space before the cursor', async () => {
      expect(await indented('(foo|)', false)).toBe('(foo|)');
      expect(await indented('(defn f []•   |(let [x 1]|•     x))', false)).toBe(
        '(defn f []•   |(let [x 1]|•     x))'
      );
    });

    it('keeps CRLF line endings', async () => {
      const doc = new model.StringDocument('(defn f []\r\n   (let [x 1]\r\n     x))');
      doc.selections = [new model.ModelEditSelection(15)];
      await indent(doc, ' ', false);
      expect(doc.model.getText(0, Infinity)).toBe('(defn f []\r\n  (let [x 1]\r\n    x))');
      expect(doc.selections[0].active).toBe(14);
    });
  });

  describe('forward (calva-fmt.tabIndent)', () => {
    it('inserts the spacing at the cursor and moves the lines of the form with it', async () => {
      expect(await indented('(defn foo []•  |(bar))', true)).toBe('(defn foo []•   |(bar))');
      expect(await indented('(defn f []•  |(let [x 1]•    x))', true)).toBe(
        '(defn f []•   |(let [x 1]•     x))'
      );
    });

    it('inserts the spacing in the middle of a line', async () => {
      expect(await indented('(foo |bar)', true)).toBe('(foo  |bar)');
    });
  });
});
