import * as vscode from 'vscode';
import * as util from '../utilities';
import * as infoparser from './infoparser';
import * as tokenCursor from '../cursor-doc/token-cursor';
import * as docMirror from '../doc-mirror/index';
import * as namespace from '../namespace';
import * as replSession from '../nrepl/repl-session';

export class CalvaSignatureHelpProvider implements vscode.SignatureHelpProvider {
  async provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.SignatureHelp | undefined> {
    return provideSignatureHelp(document, position, token);
  }
}

export async function provideSignatureHelp(
  document: vscode.TextDocument,
  position: vscode.Position,
  _token: vscode.CancellationToken
): Promise<vscode.SignatureHelp | undefined> {
  if (util.getConnectedState()) {
    const [ns, _] = namespace.getNamespace(document, position),
      idx = document.offsetAt(position),
      symbol = getSymbol(document, idx);
    if (symbol) {
      const client = replSession.getSession();
      if (client) {
        await namespace.createNamespaceFromDocumentIfNotExists(document);
        const res = await client.info(ns, symbol),
          signatures = infoparser.getSignatures(res, symbol);
        if (signatures) {
          const help = new vscode.SignatureHelp(),
            currentArgsRanges = getCurrentArgsRanges(document, idx);
          help.signatures = signatures;
          help.activeSignature = getActiveSignatureIdx(signatures, currentArgsRanges.length);
          if (signatures[help.activeSignature].parameters !== undefined) {
            const currentArgIdx = currentArgsRanges.findIndex((range) => range.contains(position)),
              activeSignature = signatures[help.activeSignature];
            util.assertIsDefined(activeSignature, 'Expected activeSignature to be defined!');
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

function getCurrentArgsRanges(
  document: vscode.TextDocument,
  idx: number
): vscode.Range[] | undefined {
  const cursor: tokenCursor.LispTokenCursor = docMirror.getDocument(document).getTokenCursor(idx),
    allRanges = cursor.rowColRangesForSexpsInList('(');

  // Are we in a function that gets a threaded first parameter?
  const { previousRangeIndex, previousFunction } = getPreviousRangeIndexAndFunction(document, idx);
  const isInThreadFirst: boolean =
    (previousRangeIndex > 1 && ['->', 'some->'].includes(previousFunction)) ||
    (previousRangeIndex > 1 && previousRangeIndex % 2 !== 0 && previousFunction === 'cond->');

  if (allRanges !== undefined) {
    return allRanges.slice(1 - (isInThreadFirst ? 1 : 0)).map(coordsToRange);
  }
}

function getActiveSignatureIdx(
  signatures: vscode.SignatureInformation[],
  currentArgsCount
): number {
  const activeSignatureIdx = signatures.findIndex(
    (signature) => signature.parameters && signature.parameters.length >= currentArgsCount
  );
  return activeSignatureIdx !== -1 ? activeSignatureIdx : signatures.length - 1;
}

function getSymbol(document: vscode.TextDocument, idx: number): string {
  const cursor: tokenCursor.LispTokenCursor = docMirror.getDocument(document).getTokenCursor(idx);
  return cursor.getFunctionName();
}

function coordsToRange(coords: [[number, number], [number, number]]): vscode.Range {
  return new vscode.Range(new vscode.Position(...coords[0]), new vscode.Position(...coords[1]));
}

function getPreviousRangeIndexAndFunction(document: vscode.TextDocument, idx: number) {
  const peekBehindCursor: tokenCursor.LispTokenCursor = docMirror
    .getDocument(document)
    .getTokenCursor(idx);
  peekBehindCursor.backwardFunction(1);
  const previousFunction = peekBehindCursor.getFunctionName(0),
    previousRanges = peekBehindCursor.rowColRangesForSexpsInList('(').map(coordsToRange),
    previousRangeIndex = previousRanges.findIndex((range) =>
      range.contains(document.positionAt(idx))
    );
  return { previousRangeIndex, previousFunction };
}
