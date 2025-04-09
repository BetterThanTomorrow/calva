import { getFirstEol, LineInputModel } from './model';
import { Token, validPair } from './clojure-lexer';

function tokenIsWhiteSpace(token: Token) {
  return token.type === 'eol' || token.type == 'ws';
}

/**
 * A mutable cursor into the token stream.
 */
export class TokenCursor {
  constructor(public doc: LineInputModel, public line: number, public token: number) {}

  /** Create a copy of this cursor. */
  clone() {
    return new TokenCursor(this.doc, this.line, this.token);
  }

  /**
   * Sets this TokenCursor state to the same as another.
   * @param cursor the cursor to copy state from.
   */
  set(cursor: TokenCursor) {
    this.doc = cursor.doc;
    this.line = cursor.line;
    this.token = cursor.token;
  }

  /** Return the position */
  get rowCol() {
    return [this.line, this.getToken().offset];
  }

  /** Return the offset at the start of the token */
  get offsetStart() {
    return this.doc.getOffsetForLine(this.line) + this.getToken().offset;
  }

  /** Return the offset at the end of the token */
  get offsetEnd() {
    return Math.min(
      this.doc.maxOffset,
      this.doc.getOffsetForLine(this.line) + this.getToken().offset + this.getToken().raw.length
    );
  }

  /** True if we are at the start of the document */
  atStart() {
    return this.token == 0 && this.line == 0;
  }

  /** True if we are at the end of the document */
  atEnd() {
    return (
      this.line == this.doc.lines.length - 1 &&
      this.token == this.doc.lines[this.line].tokens.length - 1
    );
  }

  /** Move this cursor backwards one token */
  previous() {
    if (this.token > 0) {
      this.token--;
    } else {
      if (this.line == 0) {
        return;
      }
      this.line--;
      this.token = this.doc.lines[this.line].tokens.length - 1;
    }
    return this;
  }

  /** Move this cursor forwards one token */
  next() {
    if (this.token < this.doc.lines[this.line].tokens.length - 1) {
      this.token++;
    } else {
      if (this.line == this.doc.lines.length - 1) {
        return;
      }
      this.line++;
      this.token = 0;
    }
    return this;
  }

  /**
   * Return the token immediately preceding this cursor. At the start of the file, a token of type "eol" is returned.
   */
  getPrevToken(): Token {
    if (this.line == 0 && this.token == 0) {
      return { type: 'eol', raw: '\n', offset: 0, state: null };
    }
    const cursor = this.clone();
    cursor.previous();
    return cursor.getToken();
  }

  /**
   * Returns the token at this cursor position.
   */
  getToken() {
    return this.doc.lines[this.line].tokens[this.token];
  }

  equals(cursor: TokenCursor) {
    return this.line == cursor.line && this.token == cursor.token && this.doc == cursor.doc;
  }
}

/**
 * Implementation for cursor.rangesForSexpsInList and
 * cursor.rowColRangesForSexpsInList
 * Returns the ranges for all forms in the current list.
 * Returns undefined if the current cursor is not within a list.
 * If you are particular about which list type that should be considered, supply an `openingBracket`.
 */

function _rangesForSexpsInList(
  cursor: LispTokenCursor,
  useRowCol = false,
  openingBracket?: string
): [number, number][] | [[number, number], [number, number]][] {
  if (openingBracket !== undefined) {
    if (!cursor.backwardListOfType(openingBracket)) {
      return undefined;
    }
  } else {
    if (!cursor.backwardList()) {
      return undefined;
    }
  }
  const ranges = [];
  // TODO: Figure out how to do this ignore skipping more generally in forward/backward this or that.
  let ignoreCounter = 0;
  while (true) {
    cursor.forwardWhitespace();
    const start = useRowCol ? cursor.rowCol : cursor.offsetStart;
    if (cursor.getToken().type === 'ignore') {
      ignoreCounter++;
      cursor.forwardSexp();
      continue;
    }
    if (cursor.forwardSexp()) {
      if (ignoreCounter === 0) {
        const end = useRowCol ? cursor.rowCol : cursor.offsetStart;
        ranges.push([start, end]);
      } else {
        ignoreCounter--;
      }
    } else {
      break;
    }
  }
  return ranges;
}

export class LispTokenCursor extends TokenCursor {
  constructor(public doc: LineInputModel, public line: number, public token: number) {
    super(doc, line, token);
  }

  /** Create a copy of this cursor. */
  clone() {
    return new LispTokenCursor(this.doc, this.line, this.token);
  }

  tokenBeginsMetadata(): boolean {
    return this.getToken().raw.startsWith('^');
  }

  prevTokenBeginsMetadata(): boolean {
    return this.getPrevToken().raw.startsWith('^');
  }
  /**
   * Moves this token past any whitespace or comment.
   */
  forwardWhitespace(includeComments = true) {
    while (!this.atEnd()) {
      switch (this.getToken().type) {
        case 'comment':
        case 'prompt':
          if (!includeComments) {
            return;
          }
        // eslint-disable-next-line no-fallthrough
        case 'eol':
        case 'ws':
          this.next();
          if (['comment', 'prompt'].includes(this.getToken().type) && !includeComments) {
            return;
          }
          continue;
        default:
          return;
      }
    }
  }

  /**
   * Moves this token back past any whitespace or comment.
   */
  backwardWhitespace(includeComments = true) {
    while (!this.atStart()) {
      switch (this.getPrevToken().type) {
        case 'comment':
        case 'prompt':
          if (!includeComments) {
            return;
          }
        // eslint-disable-next-line no-fallthrough
        case 'eol':
        case 'ws':
          this.previous();
          if (['comment', 'prompt'].includes(this.getPrevToken().type) && !includeComments) {
            return;
          }
          continue;
        default:
          return;
      }
    }
  }

  // Lisp navigation commands begin here.

  // TODO: When f/b sexp, use the stack knowledge to ”flag” unbalance

  /**
   * Moves this token forward one s-expression at this level.
   * If the next non whitespace token is an open paren, skips past it's matching
   * close paren.
   *
   * If the next token is a form of closing paren, does not move.
   *
   * @returns true if the cursor was moved, false otherwise.
   */
  forwardSexp(skipComments = true, skipMetadata = false, skipIgnoredForms = false): boolean {
    // TODO: Consider using a proper bracket stack
    const stack = [];
    let isMetadata = false;
    this.forwardWhitespace(skipComments);
    if (this.getToken().type === 'close') {
      return false;
    }
    isMetadata = this.tokenBeginsMetadata();
    while (!this.atEnd()) {
      this.forwardWhitespace(skipComments);
      const token = this.getToken();
      switch (token.type) {
        case 'comment':
          this.next();
          this.next();
          break;
        case 'prompt':
          this.next();
          this.next();
          break;
        case 'ignore':
          if (skipIgnoredForms) {
            this.next();
            this.forwardSexp(skipComments, skipMetadata, skipIgnoredForms);
            break;
          }
        // eslint-disable-next-line no-fallthrough
        case 'id':
        case 'lit':
        case 'kw':
        case 'junk':
        case 'str-inside':
          if (skipMetadata && this.getToken().raw.startsWith('^')) {
            this.next();
          } else {
            this.next();
            if (stack.length <= 0) {
              return true;
            }
          }
          break;
        case 'close': {
          const close = token.raw;
          let open: string;
          while ((open = stack.pop())) {
            if (validPair(open, close)) {
              this.next();
              break;
            }
          }
          if (skipMetadata && isMetadata) {
            this.forwardSexp(skipComments, skipMetadata);
          }
          if (stack.length <= 0) {
            return true;
          }
          break;
        }
        case 'open':
          stack.push(token.raw);
          isMetadata = this.tokenBeginsMetadata();
          this.next();
          break;
        default:
          this.next();
          break;
      }
    }
  }

  /**
   * Moves this token backward one s-expression at this level.
   * If the previous non whitespace token is a close paren, skips past it's matching
   * open paren.
   *
   * If the previous token is a form of open paren, does not move.
   *
   * @returns true if the cursor was moved, false otherwise.
   */
  backwardSexp(skipComments = true, skipMetadata = false, skipReaders = true) {
    const stack = [];
    this.backwardWhitespace(skipComments);
    if (this.getPrevToken().type === 'open') {
      return false;
    }
    while (!this.atStart()) {
      this.backwardWhitespace(skipComments);
      const tk = this.getPrevToken();
      switch (tk.type) {
        case 'id':
        case 'lit':
        case 'kw':
        case 'ignore':
        case 'junk':
        case 'comment':
        case 'prompt':
        case 'str-inside': {
          this.previous();
          if (skipReaders) {
            this.backwardThroughAnyReader();
          }
          if (skipMetadata) {
            const metaCursor = this.clone();
            metaCursor.backwardSexp(true, false, false);
            if (metaCursor.tokenBeginsMetadata()) {
              this.backwardSexp(skipComments, skipMetadata, skipReaders);
            }
          }
          if (skipReaders) {
            this.backwardThroughAnyReader();
          }
          if (stack.length <= 0) {
            return true;
          }
          break;
        }
        case 'close':
          stack.push(tk.raw);
          this.previous();
          break;
        case 'open': {
          const open = tk.raw;
          let close: string;
          while ((close = stack.pop())) {
            if (validPair(open, close)) {
              break;
            }
          }
          this.previous();
          if (skipReaders) {
            this.backwardThroughAnyReader();
          }
          if (skipMetadata) {
            const metaCursor = this.clone();
            metaCursor.backwardSexp(true, false, false);
            if (metaCursor.tokenBeginsMetadata()) {
              this.backwardSexp(skipComments, skipMetadata, skipReaders);
            }
          }
          if (skipReaders) {
            this.backwardThroughAnyReader();
          }
          if (stack.length <= 0) {
            return true;
          }
          break;
        }
        default:
          this.previous();
          break;
      }
    }
  }

  /**
   * Moves this cursor past the previous non-ws token, if it is a `reader` token.
   * Otherwise, this cursor is left unaffected.
   */
  backwardThroughAnyReader() {
    const cursor = this.clone();
    let hasReader = false;
    while (true) {
      cursor.backwardWhitespace();
      if (cursor.getPrevToken().type === 'reader') {
        cursor.previous();
        this.set(cursor);
        hasReader = true;
      } else {
        break;
      }
    }
    return hasReader;
  }

  /**
   * Moves this cursor past the next non-ws token, if it is a `reader` token.
   * Otherwise, this cursor is left unaffected.
   */
  forwardThroughAnyReader() {
    const cursor = this.clone();
    let hasReader = false;
    while (true) {
      cursor.forwardWhitespace();
      if (cursor.getToken().type === 'reader') {
        cursor.next();
        this.set(cursor);
        hasReader = true;
      } else {
        break;
      }
    }
    return hasReader;
  }

  /**
   * Moves this cursor to the close paren of the containing sexpr, or until the end of the document.
   */
  forwardList(): boolean {
    const cursor = this.clone();
    while (cursor.forwardSexp()) {
      // move forward until the cursor cannot move forward anymore
    }
    if (cursor.getToken().type === 'close') {
      const backCursor = cursor.clone();
      if (backCursor.backwardList()) {
        this.set(cursor);
        return true;
      }
    }
    return false;
  }

  /**
   * Moves this cursor forwards to the `closingBracket` of the containing sexpr, or until the end of the document.
   */
  forwardListOfType(closingBracket: string): boolean {
    const cursor = this.clone();
    while (cursor.forwardList()) {
      if (cursor.getToken().raw === closingBracket) {
        this.set(cursor);
        return true;
      }
      if (!cursor.upList()) {
        return false;
      }
    }
    return false;
  }

  /**
   * Moves this cursor backwards to the open paren of the containing sexpr, or until the start of the document.
   */
  backwardList(): boolean {
    const cursor = this.clone();
    while (cursor.backwardSexp()) {
      // move backward until the cursor cannot move backward anymore
    }
    if (cursor.getPrevToken().type === 'open') {
      const checkCursor = cursor.clone();
      if (checkCursor.backwardUpList() && checkCursor.forwardSexp()) {
        this.set(cursor);
        return true;
      }
    }
    return false;
  }

  /**
   * Moves this cursor backwards to the `openingBracket` of the containing sexpr, or until the start of the document.
   */
  backwardListOfType(openingBracket: string): boolean {
    const cursor = this.clone();
    while (cursor.backwardList()) {
      if (cursor.getPrevToken().raw.endsWith(openingBracket)) {
        this.set(cursor);
        return true;
      }
      if (!cursor.backwardUpList()) {
        return false;
      }
    }
    return false;
  }

  /**
   * Finds the range of the current list up to `depth`.
   * If you are particular about which type of list, supply the `openingBracket`.
   * @param openingBracket
   */
  rangeForList(depth: number, openingBracket?: string): [number, number] {
    const cursor = this.clone();
    let range: [number, number] = undefined;
    for (let i = 0; i < depth; i++) {
      if (openingBracket === undefined) {
        if (!(cursor.backwardList() && cursor.backwardUpList())) {
          return range;
        }
      } else {
        if (!(cursor.backwardListOfType(openingBracket) && cursor.backwardUpList())) {
          return range;
        }
      }
      const start = cursor.offsetStart;
      if (!cursor.forwardSexp()) {
        return range;
      }
      const end = cursor.offsetStart;
      range = [start, end];
    }
    return range;
  }

  /**
   * If possible, moves this cursor forwards past any readers and whitespace,
   * and then past the immediately following open-paren and returns true.
   * If the source does not match this, returns false and does not move the cursor.
   */
  downList(): boolean {
    const cursor = this.clone();
    cursor.forwardThroughAnyReader();
    cursor.forwardWhitespace();
    if (cursor.getToken().type === 'open') {
      cursor.next();
      this.set(cursor);
      return true;
    }
    return false;
  }

  /**
   * If possible, moves this cursor forwards past any readers, whitespace, and metadata,
   * and then past the immediately following open-paren and returns true.
   * If the source does not match this, returns false and does not move the cursor.
   */
  downListSkippingMeta(): boolean {
    const cursor = this.clone();
    do {
      cursor.forwardThroughAnyReader();
      cursor.forwardWhitespace();
      if (cursor.getToken().type === 'open' && !cursor.tokenBeginsMetadata()) {
        break;
      }
    } while (cursor.forwardSexp());
    if (cursor.downList()) {
      this.set(cursor);
      return true;
    }
    return false;
  }

  /**
   * If possible, moves this cursor forwards past any whitespace, and then past the immediately following close-paren and returns true.
   * If the source does not match this, returns false and does not move the cursor.
   */
  upList(): boolean {
    const cursor = this.clone();
    cursor.forwardWhitespace();
    if (cursor.getToken().type == 'close') {
      cursor.next();
      this.set(cursor);
      return true;
    }
    return false;
  }

  /**
   * If possible, moves this cursor backwards past any whitespace, and then backwards past the immediately following open-paren and returns true.
   * If the source does not match this, returns false and does not move the cursor.
   */
  backwardUpList(): boolean {
    const cursor = this.clone();
    cursor.backwardThroughAnyReader();
    cursor.backwardWhitespace();
    if (cursor.getPrevToken().type == 'open') {
      cursor.previous();
      this.set(cursor);
      return true;
    }
    return false;
  }

  /**
   * If possible, moves this cursor backwards past any whitespace, and then backwards past the immediately following close-paren and returns true.
   * If the source does not match this, returns false and does not move the cursor.
   */
  backwardDownList(): boolean {
    const cursor = this.clone();
    cursor.backwardWhitespace();
    if (cursor.getPrevToken().type == 'close') {
      cursor.previous();
      this.set(cursor);
      return true;
    }
    return false;
  }

  /**
   * Figures out the `range` for the current form according to this priority:
   * 0. If `offset` is within a symbol, literal or keyword
   * 1. Else, if `offset` is adjacent after form
   * 2. Else, if `offset` is adjacent before a form
   * 3. Else, if the previous form is on the same line
   * 4. Else, if the next form is on the same line
   * 5. Else, the previous form, if any
   * 6. Else, the next form, if any
   * 7. Else, the current enclosing form, if any
   * 8. Else, return `undefined`.
   * @param offset the current cursor (caret) offset in the document
   */
  rangeForCurrentForm(offset: number): [number, number] {
    let afterCurrentFormOffset: number;
    // console.log(-1, offset);

    // 0. If `offset` is within or before, a symbol, literal or keyword
    if (
      ['id', 'kw', 'lit', 'str-inside'].includes(this.getToken().type) &&
      !this.tokenBeginsMetadata()
    ) {
      afterCurrentFormOffset = this.offsetEnd;
    }
    // console.log(0, afterCurrentFormOffset);

    // 1. Else, if `offset` is adjacent after form
    if (afterCurrentFormOffset === undefined) {
      const cursor = this.clone();
      cursor.backwardWhitespace(true);
      if (
        cursor.offsetStart == offset &&
        cursor.getToken().type !== 'reader' &&
        !cursor.tokenBeginsMetadata() &&
        cursor.getPrevToken().type !== 'reader' &&
        !cursor.prevTokenBeginsMetadata()
      ) {
        if (cursor.backwardSexp() && !cursor.tokenBeginsMetadata()) {
          afterCurrentFormOffset = offset;
        }
      }
    }
    // console.log(1, afterCurrentFormOffset);

    // 2. Else, if `offset` is adjacent before a form
    if (afterCurrentFormOffset === undefined) {
      const tk = this.getToken();
      const pTk = this.getPrevToken();
      let isAdjacentBefore =
        tk.type === 'reader' ||
        this.tokenBeginsMetadata() ||
        pTk.type === 'reader' ||
        this.prevTokenBeginsMetadata() ||
        tk.type === 'open';
      // console.log(2.1, isAdjacentBefore);
      if (!isAdjacentBefore) {
        const cursor = this.clone();
        cursor.backwardWhitespace();
        isAdjacentBefore =
          cursor.prevTokenBeginsMetadata() || cursor.getPrevToken().type === 'reader';
      }
      // console.log(2.2, isAdjacentBefore);
      if (!isAdjacentBefore) {
        const cursor = this.clone();
        cursor.forwardWhitespace();
        if (cursor.rowCol[0] === this.rowCol[0]) {
          isAdjacentBefore = cursor.tokenBeginsMetadata() || cursor.getToken().type === 'reader';
        }
      }
      // console.log(2.3, isAdjacentBefore);
      if (isAdjacentBefore) {
        const cursor = this.clone();
        cursor.forwardWhitespace();
        if (cursor.forwardSexp(true, true)) {
          afterCurrentFormOffset = cursor.offsetStart;
        }
      }
    }
    // console.log(2, afterCurrentFormOffset);

    // 3. Else, if the previous form is on the same line
    if (afterCurrentFormOffset === undefined) {
      const cursor = this.clone();
      cursor.backwardWhitespace(true);
      const afterOffset = cursor.offsetStart;
      if (cursor.rowCol[0] === this.rowCol[0]) {
        if (cursor.backwardSexp()) {
          afterCurrentFormOffset = afterOffset;
        }
      }
    }
    // console.log(3, afterCurrentFormOffset);

    // 4. Else, if the next form is on the same line
    if (afterCurrentFormOffset === undefined) {
      const cursor = this.clone();
      cursor.forwardWhitespace(true);
      if (cursor.rowCol[0] === this.rowCol[0]) {
        if (cursor.forwardSexp()) {
          afterCurrentFormOffset = cursor.offsetStart;
        }
      }
    }
    // console.log(4, afterCurrentFormOffset);

    // 5. Else, the previous form, if any
    if (afterCurrentFormOffset === undefined) {
      const cursor = this.clone();
      cursor.backwardWhitespace(true);
      const afterOffset = cursor.offsetStart;
      if (cursor.backwardSexp()) {
        afterCurrentFormOffset = afterOffset;
      }
    }
    // console.log(5, afterCurrentFormOffset);

    // 6. Else, the next form, if any
    if (afterCurrentFormOffset === undefined) {
      const cursor = this.clone();
      cursor.forwardWhitespace();
      if (cursor.forwardSexp()) {
        afterCurrentFormOffset = cursor.offsetStart;
      }
    }
    // console.log(6, afterCurrentFormOffset);

    // 7. Else, the current enclosing form, if any
    if (afterCurrentFormOffset === undefined) {
      const cursor = this.clone();
      if (cursor.backwardUpList()) {
        if (cursor.forwardSexp()) {
          afterCurrentFormOffset = cursor.offsetStart;
        }
      }
    }
    // console.log(7, afterCurrentFormOffset);

    // 8. Else, ¯\_(ツ)_/¯
    if (afterCurrentFormOffset === undefined) {
      return undefined; // 8.
    }

    const currentFormCursor = this.doc.getTokenCursor(afterCurrentFormOffset);
    currentFormCursor.backwardSexp(true, true);
    return [currentFormCursor.offsetStart, afterCurrentFormOffset];
  }

  rangeForDefun(p: number, commentCreatesTopLevel = true): [number, number] {
    const cursor = this.doc.getTokenCursor(p);
    const getFunctionPositionText = (cursor: LispTokenCursor) => {
      // NB: This is probably a general need, so might with ino the token cursor.
      //     However, it seems more semantically close to cursor.getFunctionName()
      //     than it is so I hesitate to place it there. This is the only current
      //     consumer of this version of the semantics anyway.
      const functionCursor = cursor.clone();
      functionCursor.backwardList();
      functionCursor.forwardWhitespace();
      return functionCursor.getToken().raw;
    };
    let lastCandidateRange: [number, number] = cursor.rangeForCurrentForm(p);
    while (cursor.forwardList() && cursor.upList()) {
      const commentCursor = cursor.clone();
      commentCursor.backwardDownList();
      if (commentCreatesTopLevel && getFunctionPositionText(commentCursor) === 'comment') {
        if (commentCursor.getToken().raw !== ')') {
          commentCursor.upList();
          return commentCursor.rangeForCurrentForm(commentCursor.offsetStart);
        } else {
          return lastCandidateRange;
        }
      } else {
        lastCandidateRange = cursor.rangeForCurrentForm(cursor.offsetStart);
      }
    }
    return lastCandidateRange;
  }

  rangesForTopLevelForms(): [number, number][] {
    const cursor = new LispTokenCursor(this.doc, 0, 0);
    const ranges: [number, number][] = [];
    while (cursor.forwardSexp()) {
      const end = cursor.offsetStart;
      cursor.backwardSexp();
      ranges.push([cursor.offsetStart, end]);
      cursor.forwardSexp();
    }
    return ranges;
  }

  rangesForCommentForms(offset: number): [number, number][] {
    const cursor = this.doc.getTokenCursor(offset);
    const ranges: [number, number][] = [];
    while (cursor.forwardSexp()) {
      const end = cursor.offsetStart;
      cursor.backwardSexp();
      ranges.push([cursor.offsetStart, end]);
      cursor.forwardSexp();
    }
    return ranges;
  }

  isWhiteSpace(): boolean {
    return tokenIsWhiteSpace(this.getToken());
  }

  isOnlyWhitespaceLeftOfCursor(offset: number): boolean {
    const token = this.getToken();
    if (token.type === 'ws') {
      return token.offset === 0;
    } else if (offset > this.offsetStart) {
      return false;
    }
    const prevToken = this.getPrevToken();

    return prevToken.type === 'ws' && prevToken.offset === 0;
  }

  previousIsWhiteSpace(): boolean {
    return tokenIsWhiteSpace(this.getPrevToken());
  }

  withinWhiteSpace(): boolean {
    return this.isWhiteSpace() && this.previousIsWhiteSpace();
  }

  /**
   * Indicates if the current token is inside a string
   */
  withinString() {
    const cursor = this.clone();
    cursor.backwardList();
    if (cursor.getPrevToken().type === 'open' && cursor.getPrevToken().raw.endsWith('"')) {
      return true;
    }
    return false;
  }

  /**
   * Indicates if the current token is in a comment line
   */
  withinComment() {
    const cursor = this.clone();
    let isComment =
      cursor.getToken().type === 'comment' || cursor.getPrevToken().type === 'comment';
    if (!isComment && this.withinWhiteSpace()) {
      cursor.forwardWhitespace(false);
      isComment = cursor.getToken().type === 'comment';
      if (!isComment) {
        cursor.backwardWhitespace(false);
        isComment = cursor.getPrevToken().type === 'comment' && cursor.getToken().type !== 'eol';
      }
    }
    return isComment;
  }

  /**
   * Tells if the cursor is inside a properly closed list.
   */
  withinValidList(): boolean {
    const cursor = this.clone();
    while (cursor.forwardSexp()) {
      // move forward until the cursor cannot move forward anymore
    }
    return cursor.getToken().type == 'close';
  }

  /**
   * Returns the rowCol ranges for all forms in the current list.
   * Returns undefined if the current cursor is not within a list.
   * If you are particular about which list type that should be considered, supply an `openingBracket`.
   */
  rowColRangesForSexpsInList(openingBracket?: string): [[number, number], [number, number]][] {
    const cursor = this.clone();
    return _rangesForSexpsInList(cursor, true, openingBracket) as [
      [number, number],
      [number, number]
    ][];
  }

  /**
   * Returns the rowCol ranges for all forms in the current list.
   * Returns undefined if the current cursor is not within a list.
   * If you are particular about which list type that should be considered, supply an `openingBracket`.
   */
  rangesForSexpsInList(openingBracket?: string): [number, number][] {
    const cursor = this.clone();
    return _rangesForSexpsInList(cursor, false, openingBracket) as [number, number][];
  }

  /**
   * Tries to move this cursor backwards to the open paren of the function, `level` functions up.
   * If there aren't that many functions behind the cursor, the cursor is not moved at all.
   * NB: The `levels` semantics is about nested functions. So it will find `|b` in `(a (b [c|]))`
   *     if `levels` is 0.
   * @param levels how many functions up to go before placing the cursor at the start of it.
   * @returns `true` if the cursor was moved, otherwise `false`
   */
  backwardFunction(levels: number = 0): boolean {
    const cursor = this.clone();
    if (!cursor.backwardListOfType('(')) {
      return false;
    }
    for (let i = 0; i < levels; i++) {
      if (!cursor.backwardUpList()) {
        return false;
      }
      if (!cursor.backwardListOfType('(')) {
        return false;
      }
    }
    this.set(cursor);
    return true;
  }

  /**
   * Get the name of the current function, optionally digging `levels` functions up.
   * NB: See `backwardFunction()` for semantics of `levels`.
   * @param levels how many levels of functions to dig up.
   * @returns the function name, or undefined if there is no function there.
   */
  getFunctionName(levels: number = 0): string {
    const cursor = this.clone();
    if (cursor.backwardFunction(levels)) {
      cursor.forwardWhitespace();
      const symbol = cursor.getToken();
      if (symbol.type === 'id') {
        return symbol.raw;
      }
    }
  }

  /**
   * Get the range of the sexp that is in function position of the current list, optionally digging `levels` functions up.
   * @param levels how many levels of functions to dig up.
   * @returns the range of the function sexp/form, or undefined if there is no function there.
   */
  getFunctionSexpRange(levels: number = 0): [number, number] {
    const cursor = this.clone();
    if (cursor.backwardFunction(levels)) {
      cursor.forwardWhitespace();
      const start = cursor.offsetStart;
      cursor.forwardSexp(true, true, true);
      const end = cursor.offsetStart;
      return [start, end];
    }
    return [undefined, undefined];
  }

  /** Return true if cursor is at top level */
  atTopLevel(commentCreatesTopLevel: boolean = false): boolean {
    const tlCursor = this.clone();
    if (tlCursor.forwardList() && tlCursor.upList()) {
      if (commentCreatesTopLevel && this.getFunctionName() === 'comment') {
        return true;
      }
      return false;
    }
    return true;
  }

  docIsBalanced(): boolean {
    const cursor = this.clone();
    cursor.set(new TokenCursor(this.doc, 0, 0));
    while (cursor.forwardSexp(true, true, true)) {
      // move forward until the cursor cannot move forward anymore
    }
    cursor.forwardWhitespace(true);
    return cursor.atEnd();
  }
}

/**
 * Creates a `LispTokenCursor` for walking and manipulating the string `s`.
 */
export function createStringCursor(s: string): LispTokenCursor {
  const eol = getFirstEol(s);
  const model = new LineInputModel(eol ? eol.length : 1);
  model.insertString(0, s);
  return model.getTokenCursor(0);
}
