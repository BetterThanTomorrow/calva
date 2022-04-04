import * as expect from 'expect';
import * as getText from '../../../util/cursor-get-text';
import { docFromTextNotation } from '../common/text-notation';

describe('get text', () => {
  describe('getTopLevelFunction', () => {
    it('Finds top level function at top', () => {
      const a = docFromTextNotation('(foo bar)•(deftest a-test•  (baz |gaz))');
      const b = docFromTextNotation('(foo bar)•(deftest |a-test|•  (baz gaz))');
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      expect(getText.currentTopLevelFunction(a, a.selections[0].active)).toEqual([
        range,
        b.model.getText(...range),
      ]);
    });

    it('Finds top level function when nested', () => {
      const a = docFromTextNotation('(foo bar)•(with-test•  (deftest a-test•    (baz |gaz)))');
      const b = docFromTextNotation('(foo bar)•(with-test•  (deftest |a-test|•    (baz gaz)))');
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      expect(getText.currentTopLevelFunction(a, a.selections[0].active)).toEqual([
        range,
        b.model.getText(...range),
      ]);
    });

    it('Finds top level function when namespaced def-macro', () => {
      // https://github.com/BetterThanTomorrow/calva/issues/1086
      const a = docFromTextNotation('(foo bar)•(with-test•  (t/deftest a-test•    (baz |gaz)))');
      const b = docFromTextNotation('(foo bar)•(with-test•  (t/deftest |a-test|•    (baz gaz)))');
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      expect(getText.currentTopLevelFunction(a, a.selections[0].active)).toEqual([
        range,
        b.model.getText(...range),
      ]);
    });

    it('Finds top level function when function has metadata', () => {
      const a = docFromTextNotation('(foo bar)•(deftest ^{:some :thing} a-test•  (baz |gaz))');
      const b = docFromTextNotation('(foo bar)•(deftest ^{:some :thing} |a-test|•  (baz gaz))');
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      expect(getText.currentTopLevelFunction(a, a.selections[0].active)).toEqual([
        range,
        b.model.getText(...range),
      ]);
    });
  });

  describe('getTopLevelForm', () => {
    it('Finds top level form', () => {
      const a = docFromTextNotation('(foo bar)•(deftest a-test•  (baz |gaz))');
      const b = docFromTextNotation('(foo bar)•|(deftest a-test•  (baz gaz))|');
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      expect(getText.currentTopLevelForm(a)).toEqual([range, b.model.getText(...range)]);
    });
  });

  describe('currentEnclosingFormToCursor', () => {
    it('Current enclosing form from start to cursor, then folded', () => {
      const a = docFromTextNotation('(foo bar)•(deftest a-test•  [baz ; f|oo•     gaz])');
      const b = docFromTextNotation('(foo bar)•(deftest a-test•  |[baz| ; foo•     gaz])');
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      const trail = ']';
      expect(getText.currentEnclosingFormToCursor(a)).toEqual([
        range,
        `${b.model.getText(...range)}${trail}`,
      ]);
    });
  });

  describe('topLevelFormToCursor', () => {
    it('Finds top level form from start to cursor', () => {
      const a = docFromTextNotation('(foo bar)•(deftest a-test•  [baz ; f|oo•     gaz])');
      const b = docFromTextNotation('(foo bar)•|(deftest a-test•  [baz| ; foo•     gaz])');
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      const trail = '])';
      expect(getText.currentTopLevelFormToCursor(a)).toEqual([
        range,
        `${b.model.getText(...range)}${trail}`,
      ]);
    });
  });

  describe('startOfFileToCursor', () => {
    it('Builds form from start of file to cursor, when cursor in line comment', () => {
      const a = docFromTextNotation('(foo bar)•(deftest a-test•  [baz ; f|oo•     gaz])•(bar baz)');
      const b = docFromTextNotation(
        '|(foo bar)•(deftest a-test•  [baz| ; foo•     gaz])•(bar baz)'
      );
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      const trail = '])';
      expect(getText.startOfFileToCursor(a)).toEqual([
        range,
        `${b.model.getText(...range)}${trail}`,
      ]);
    });
    it('Builds form from start of file to cursor, when cursor in comment macro', () => {
      const a = docFromTextNotation(
        '(foo bar)(comment• (deftest a-test•  [baz ; f|oo•     gaz])•(bar baz))'
      );
      const b = docFromTextNotation(
        '|(foo bar)(comment• (deftest a-test•  [baz| ; foo•     gaz])•(bar baz))'
      );
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      const trail = ']))';
      expect(getText.startOfFileToCursor(a)).toEqual([
        range,
        `${b.model.getText(...range)}${trail}`,
      ]);
    });
  });
});
