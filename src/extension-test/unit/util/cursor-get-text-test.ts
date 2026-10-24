import * as expectLib from 'expect';
import * as textNotation from '../common/text-notation';
import * as getText from '../../../util/cursor-get-text';

describe('get text', () => {
  describe('getTopLevelFunction', () => {
    it('Finds top level function at top', () => {
      const a = textNotation.docFromTextNotation('(foo bar)•(deftest a-test•  (baz |gaz))');
      const b = textNotation.docFromTextNotation('(foo bar)•(deftest |a-test|•  (baz gaz))');
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      expectLib
        .expect(getText.currentTopLevelDefined(a, a.selections[0].active))
        .toEqual([range, b.model.getText(...range)]);
    });

    it('Finds top level function when nested', () => {
      const a = textNotation.docFromTextNotation(
        '(foo bar)•(with-test•  (deftest a-test•    (baz |gaz)))'
      );
      const b = textNotation.docFromTextNotation(
        '(foo bar)•(with-test•  (deftest |a-test|•    (baz gaz)))'
      );
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      expectLib
        .expect(getText.currentTopLevelDefined(a, a.selections[0].active))
        .toEqual([range, b.model.getText(...range)]);
    });

    it('Finds top level function when namespaced def-macro', () => {
      // https://github.com/BetterThanTomorrow/calva/issues/1086
      const a = textNotation.docFromTextNotation(
        '(foo bar)•(with-test•  (t/deftest a-test•    (baz |gaz)))'
      );
      const b = textNotation.docFromTextNotation(
        '(foo bar)•(with-test•  (t/deftest |a-test|•    (baz gaz)))'
      );
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      expectLib
        .expect(getText.currentTopLevelDefined(a, a.selections[0].active))
        .toEqual([range, b.model.getText(...range)]);
    });

    it('Finds top level function when function has metadata', () => {
      const a = textNotation.docFromTextNotation(
        '(foo bar)•(deftest ^{:some :thing} a-test•  (baz |gaz))'
      );
      const b = textNotation.docFromTextNotation(
        '(foo bar)•(deftest ^{:some :thing} |a-test|•  (baz gaz))'
      );
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      expectLib
        .expect(getText.currentTopLevelDefined(a, a.selections[0].active))
        .toEqual([range, b.model.getText(...range)]);
    });
  });

  describe('getTopLevelForm', () => {
    it('Finds top level form', () => {
      const a = textNotation.docFromTextNotation('(foo bar)•(deftest a-test•  (baz |gaz))');
      const b = textNotation.docFromTextNotation('(foo bar)•|(deftest a-test•  (baz gaz))|');
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      expectLib.expect(getText.currentTopLevelForm(a)).toEqual([range, b.model.getText(...range)]);
    });
  });

  describe('currentEnclosingFormToCursor', () => {
    it('Current enclosing form from start to cursor, then folded', () => {
      const a = textNotation.docFromTextNotation(
        '(foo bar)•(deftest a-test•  [baz ; f|oo•     gaz])'
      );
      const b = textNotation.docFromTextNotation(
        '(foo bar)•(deftest a-test•  |[baz| ; foo•     gaz])'
      );
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      const trail = ']';
      expectLib
        .expect(getText.currentEnclosingFormToCursor(a))
        .toEqual([range, `${b.model.getText(...range)}${trail}`]);
    });
  });

  describe('topLevelFormToCursor', () => {
    it('Finds top level form from start to cursor', () => {
      const a = textNotation.docFromTextNotation(
        '(foo bar)•(deftest a-test•  [baz ; f|oo•     gaz])'
      );
      const b = textNotation.docFromTextNotation(
        '(foo bar)•|(deftest a-test•  [baz| ; foo•     gaz])'
      );
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      const trail = '])';
      expectLib
        .expect(getText.currentTopLevelFormToCursor(a))
        .toEqual([range, `${b.model.getText(...range)}${trail}`]);
    });
  });

  describe('startOfFileToCursor', () => {
    it('Builds form from start of file to cursor, when cursor in line comment', () => {
      const a = textNotation.docFromTextNotation(
        '(foo bar)•(deftest a-test•  [baz ; f|oo•     gaz])•(bar baz)'
      );
      const b = textNotation.docFromTextNotation(
        '|(foo bar)•(deftest a-test•  [baz| ; foo•     gaz])•(bar baz)'
      );
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      const trail = '])';
      expectLib
        .expect(getText.startOfFileToCursor(a))
        .toEqual([range, `${b.model.getText(...range)}${trail}`]);
    });
    it('Builds form from start of file to cursor, when cursor in comment macro', () => {
      const a = textNotation.docFromTextNotation(
        '(foo bar)(comment• (deftest a-test•  [baz ; f|oo•     gaz])•(bar baz))'
      );
      const b = textNotation.docFromTextNotation(
        '|(foo bar)(comment• (deftest a-test•  [baz| ; foo•     gaz])•(bar baz))'
      );
      const range: [number, number] = [b.selections[0].anchor, b.selections[0].active];
      const trail = ']))';
      expectLib
        .expect(getText.startOfFileToCursor(a))
        .toEqual([range, `${b.model.getText(...range)}${trail}`]);
    });
  });

  describe('selectionAddingBrackets', () => {
    it('Folds the missing brackets of the selection with brackets from the text behind the selection', () => {
      const doc = textNotation.docFromTextNotation('(a b) |(c {:d [1 2 3|] :e :f} d) [4 5 6]');
      const range: [number, number] = [doc.selections[0].anchor, doc.selections[0].active];
      const trail = ']})';
      expectLib
        .expect(getText.selectionAddingBrackets(doc))
        .toEqual([range, `${doc.model.getText(...range)}${trail}`]);
    });
  });

  const rangeOf = (text: string, part: string): [number, number] => [
    text.indexOf(part),
    text.indexOf(part) + part.length,
  ];

  describe('selectionElseCurrentForm', () => {
    it('Finds the current form at the cursor', () => {
      const doc = textNotation.docFromTextNotation('(a b) (c |(d e) f)');
      const text = doc.model.getText(0, doc.model.maxOffset);
      expectLib
        .expect(getText.selectionElseCurrentForm(doc))
        .toEqual([rangeOf(text, '(d e)'), '(d e)']);
    });

    it('Gives the selection when there is one', () => {
      const doc = textNotation.docFromTextNotation('(a b) (c |(d e) f|)');
      const text = doc.model.getText(0, doc.model.maxOffset);
      expectLib
        .expect(getText.selectionElseCurrentForm(doc))
        .toEqual([rangeOf(text, '(d e) f'), '(d e) f']);
    });
  });

  describe('currentEnclosingForm', () => {
    it('Finds the form enclosing the cursor', () => {
      const doc = textNotation.docFromTextNotation('(a b) (c [d |e] f)');
      const text = doc.model.getText(0, doc.model.maxOffset);
      expectLib
        .expect(getText.currentEnclosingForm(doc))
        .toEqual([rangeOf(text, '[d e]'), '[d e]']);
    });

    it('Finds nothing at the top level', () => {
      const doc = textNotation.docFromTextNotation('(a b) |(c d)');
      expectLib.expect(getText.currentEnclosingForm(doc)).toEqual([undefined, '']);
    });
  });

  describe('enclosingFormOrSelectionToCursor', () => {
    it('Takes the enclosing form to the cursor when nothing is selected', () => {
      const doc = textNotation.docFromTextNotation('(a (b c |d) e)');
      expectLib.expect(getText.enclosingFormOrSelectionToCursor(doc)).toEqual([[3, 7], '(b c)']);
    });

    it('Takes the selection adding brackets when there is one', () => {
      const doc = textNotation.docFromTextNotation('(a |(b c d|) e)');
      expectLib.expect(getText.enclosingFormOrSelectionToCursor(doc)).toEqual([[3, 9], '(b c d)']);
    });
  });

  describe('currentClojureContext', () => {
    it('Finds the forms around the cursor, as custom REPL commands name them', () => {
      const doc = textNotation.docFromTextNotation(
        '(def a 1)•(defn foo [x]•  (let [y (inc x)]•    (bar |y x)))'
      );
      const texts = Object.fromEntries(
        Object.entries(getText.currentClojureContext(doc)).map(([k, [, text]]) => [k, text])
      );
      expectLib.expect(texts).toEqual({
        currentForm: 'y',
        currentPair: '',
        enclosingForm: '(bar y x)',
        topLevelForm: '(defn foo [x]\n  (let [y (inc x)]\n    (bar y x)))',
        currentFn: 'bar',
        topLevelDefinedForm: 'foo',
        topLevelFn: 'defn',
        head: 'bar ',
        tail: 'y x',
      });
    });

    it('Finds the current pair in a binding vector', () => {
      const doc = textNotation.docFromTextNotation('(let [a 1 |b 2] a)');
      expectLib.expect(getText.currentClojureContext(doc).currentPair[1]).toEqual('b 2');
    });
  });
});
