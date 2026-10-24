import * as expectLib from 'expect';
import * as model from '../../cursor-doc/model';
import { toggleLineComment } from '../../toggle-comment';
import type { OffsetRange, ToggleCommentBehavior } from '../../toggle-comment';
import * as textNotation from './common/text-notation';

const expect = expectLib.expect;

model.initScanner(20000);

async function toggled(notation: string, behavior: ToggleCommentBehavior = 'commentCurrentLine') {
  const doc = textNotation.docFromTextNotation(notation);
  const reformatCalls: OffsetRange[][] = [];
  await toggleLineComment(doc, behavior, (ranges) => {
    reformatCalls.push(ranges);
    return Promise.resolve();
  });
  return { notation: textNotation.textNotationFromDoc(doc), reformatCalls };
}

describe('toggleLineComment', () => {
  describe('with a cursor outside comments', () => {
    it('ignores the parent form with ignoreParentForm', async () => {
      expect(
        (await toggled('(defn foo []•  (when true•    (+ |-5 2)))', 'ignoreParentForm')).notation
      ).toBe('(defn foo []•  (when true•    #_(+ |-5 2)))');
    });

    it('ignores the current form with ignoreCurrentForm', async () => {
      expect(
        (await toggled('(defn foo []•  |(println "test"))', 'ignoreCurrentForm')).notation
      ).toBe('(defn foo []•  #_|(println "test"))');
    });

    it('comments the line with commentCurrentLine, moving the closing bracket to a line of its own', async () => {
      const { notation, reformatCalls } = await toggled('(defn foo []•  |(println "test"))');
      expect(notation).toBe('(defn foo []•  ;; |(println "test")•  )');
      expect(reformatCalls).toEqual([[[0, 38]]]);
    });

    it('comments a line holding only a closing bracket', async () => {
      expect((await toggled('(assoc m•       :key :val•|)')).notation).toBe(
        '(assoc m•       :key :val•;; |•)'
      );
    });
  });

  describe('uncommenting', () => {
    it('uncomments the line at the cursor and reformats its enclosing form', async () => {
      const { notation, reformatCalls } = await toggled('(defn foo []•  ;; |(println "test"))');
      expect(notation).toBe('(defn foo []•  |(println "test"))');
      expect(reformatCalls).toEqual([[[0, 32]]]);
    });

    it('uncomments the line at the cursor whatever the behavior', async () => {
      expect(
        (await toggled('(defn foo []•  ;; |(println "test"))', 'ignoreCurrentForm')).notation
      ).toBe('(defn foo []•  |(println "test"))');
    });

    it('uncomments mixed semicolon prefixes across selected lines and keeps the selection', async () => {
      expect((await toggled('(defn foo []•  |; a•  ;; b|)')).notation).toBe(
        '(defn foo []•  |a•  b|)'
      );
    });

    it('uncomments a partial selection, aligned comments', async () => {
      expect((await toggled('(a |;; (b c•   ;;    d)|•   e)')).notation).toBe(
        '(a |(b c•      d)|•   e)'
      );
    });
  });

  describe('with a selection', () => {
    it('comments a partial multi-line selection at one column and keeps the selection over it', async () => {
      const { notation, reformatCalls } = await toggled('(a |(b c•      d)|•   e)');
      expect(notation).toBe('(a |;; (b c•   ;;    d)|•   e)');
      expect(reformatCalls).toEqual([[]]);
    });

    it('comments selected lines, moving the closing bracket outside the selection to a line of its own', async () => {
      expect((await toggled('(do•  |(prn "a")•  (prn "b")|)')).notation).toBe(
        '(do•  |;; (prn "a")•  ;; (prn "b")|•  )'
      );
    });

    it('selects with the same direction', async () => {
      expect((await toggled('(do•  <0(prn "a")•  (prn "b")<0)')).notation).toBe(
        '(do•  <;; (prn "a")•  ;; (prn "b")<•  )'
      );
    });
  });

  describe('with several cursors', () => {
    it('comments the line at each cursor, keeping the cursors', async () => {
      const { notation, reformatCalls } = await toggled(
        '(defn foo []•  |(println "a")•  |1(println "b"))'
      );
      expect(notation).toBe('(defn foo []•  ;; |(println "a")•  ;; |1(println "b"))');
      expect(reformatCalls).toEqual([[]]);
    });

    it('uncomments the line at each cursor', async () => {
      expect(
        (
          await toggled(
            '(defn foo []•  ;; |(println "a")•  ;; |1(println "b"))',
            'ignoreParentForm'
          )
        ).notation
      ).toBe('(defn foo []•  |(println "a")•  |1(println "b"))');
    });
  });
});
