import {
  TextDocument,
  Position,
  Range,
  CancellationToken,
  SignatureHelp,
  SignatureHelpProvider,
  SignatureInformation,
} from 'vscode';
import * as util from '../utilities';
import * as infoparser from './infoparser';
import { LispTokenCursor } from '../cursor-doc/token-cursor';
import * as docMirror from '../doc-mirror/index';
import * as namespace from '../namespace';
import * as replSession from '../nrepl/repl-session';
import { assertIsDefined } from '../type-checks';

export class CalvaSignatureHelpProvider implements SignatureHelpProvider {
  async provideSignatureHelp(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<SignatureHelp | undefined> {
    return provideSignatureHelp(document, position, token);
  }
}

export async function provideSignatureHelp(
  document: TextDocument,
  position: Position,
  _token: CancellationToken
): Promise<SignatureHelp | undefined> {
  if (util.getConnectedState()) {
    const ns = namespace.getNamespace(document),
      idx = document.offsetAt(position),
      symbol = getSymbol(document, idx);
    if (symbol) {
      const client = replSession.tryToGetSession(util.getFileType(document));
      if (client) {
        await namespace.createNamespaceFromDocumentIfNotExists(document);
        const res = await client.info(ns, symbol),
          signatures = infoparser.getSignatures(res, symbol);
        if (signatures) {
          const help = new SignatureHelp(),
            currentArgsRanges = getCurrentArgsRanges(document, idx);
          assertIsDefined(currentArgsRanges, 'Expected to find the current args ranges!');
          help.signatures = signatures;
          help.activeSignature = getActiveSignatureIdx(signatures, currentArgsRanges.length);
          if (signatures[help.activeSignature].parameters !== undefined) {
            const currentArgIdx = currentArgsRanges.findIndex((range) => range.contains(position)),
              activeSignature = signatures[help.activeSignature];
            assertIsDefined(activeSignature, 'Expected activeSignature to be defined!');
            help.activeParameter =
              activeSignature.label.match(/&/) !== null
                ? Math.min(currentArgIdx, activeSignature.parameters.length - 1)
                : currentArgIdx;
          }
          return help;
        }
      }
    }
  }
  return undefined;
}

function getCurrentArgsRanges(document: TextDocument, idx: number): Range[] | undefined {
  const cursor: LispTokenCursor = docMirror.getDocument(document).getTokenCursor(idx),
    allRanges = cursor.rowColRangesForSexpsInList('(');

  // Are we in a function that gets a threaded first parameter?
  const { previousRangeIndex, previousFunction } = getPreviousRangeIndexAndFunction(document, idx);
  const isInThreadFirst: boolean =
    (previousRangeIndex > 1 && previousFunction && ['->', 'some->'].includes(previousFunction)) ||
    (previousRangeIndex > 1 && previousRangeIndex % 2 !== 0 && previousFunction === 'cond->');

  if (allRanges !== undefined) {
    return allRanges.slice(1 - (isInThreadFirst ? 1 : 0)).map(coordsToRange);
  }
}

function getActiveSignatureIdx(signatures: SignatureInformation[], currentArgsCount): number {
  const activeSignatureIdx = signatures.findIndex(
    (signature) => signature.parameters && signature.parameters.length >= currentArgsCount
  );
  return activeSignatureIdx !== -1 ? activeSignatureIdx : signatures.length - 1;
}

function getSymbol(document: TextDocument, idx: number): string | undefined {
  const cursor: LispTokenCursor = docMirror.getDocument(document).getTokenCursor(idx);
  return cursor.getFunctionName();
}

function coordsToRange(coords: [[number, number], [number, number]]): Range {
  return new Range(new Position(...coords[0]), new Position(...coords[1]));
}

function getPreviousRangeIndexAndFunction(document: TextDocument, idx: number) {
  const peekBehindCursor: LispTokenCursor = docMirror.getDocument(document).getTokenCursor(idx);
  peekBehindCursor.backwardFunction(1);
  const previousFunction = peekBehindCursor.getFunctionName(0),
    previousRanges = peekBehindCursor.rowColRangesForSexpsInList('(').map(coordsToRange),
    previousRangeIndex = previousRanges.findIndex((range) =>
      range.contains(document.positionAt(idx))
    );
  return { previousRangeIndex, previousFunction };
}
