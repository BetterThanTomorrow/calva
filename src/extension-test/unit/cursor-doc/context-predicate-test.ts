import * as expect from 'expect';
import * as context from '../../../cursor-doc/context-predicates';
import { LispTokenCursor } from '../../../cursor-doc/token-cursor';
import * as mock from '../common/mock';

describe('Context Predicate', () => {
    const commentSansWs = ';; a comment\n'; 
    const commentWithLeadingWs = "  ;; a comment\n"
    const commentWithLeadingAndTrailingWs = "  ;; a comment  \n"
    const docText = `${commentSansWs}${commentWithLeadingWs}${commentWithLeadingAndTrailingWs}`;
    let doc: mock.MockDocument;

    beforeEach(() => {
        doc = new mock.MockDocument();
        doc.insertString(docText);
    });

    describe('cursorAtLineStartIncLeadingWhitespace', () => {
        it('should return true at the start of a line', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(0);
            expect(context.cursorAtLineStartIncLeadingWhitespace(cursor, 0)).toBe(true);
            expect(context.cursorAtLineStartIncLeadingWhitespace(cursor, 1)).toBe(false);
            expect(context.cursorAtLineStartIncLeadingWhitespace(cursor, docText.length - 1)).toBe(false);
        })

        it('should return false within and at the end a line', () => {
            const cursor: LispTokenCursor = doc.getTokenCursor(0);
            expect(context.cursorAtLineStartIncLeadingWhitespace(cursor, 1)).toBe(false);
            expect(context.cursorAtLineStartIncLeadingWhitespace(cursor, docText.length - 1)).toBe(false);
        })

        it('should return true at line start with preceding whitespace', () => {
            const cursor = doc.getTokenCursor(commentSansWs.length);
            expect(context.cursorAtLineStartIncLeadingWhitespace(cursor, commentSansWs.length)).toBe(true);
            expect(context.cursorAtLineStartIncLeadingWhitespace(cursor, commentSansWs.length + 2)).toBe(true);
        })

        it('should return false within a line with preceding whitespace', () => {
            const cursor = doc.getTokenCursor(commentSansWs.length + 2);
            expect(context.cursorAtLineStartIncLeadingWhitespace(cursor, commentSansWs.length + 3)).toBe(false);
        })

        it('should return true at line start with preceding & trailing whitespace', () => {
            const line3Offset = commentSansWs.length + commentWithLeadingWs.length;
            const cursor = doc.getTokenCursor(line3Offset + 2);
            expect(context.cursorAtLineStartIncLeadingWhitespace(cursor, line3Offset + 2)).toBe(true);
        })
    });

  

});
