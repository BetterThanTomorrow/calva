import { CompletionItemKind, CompletionItemLabel } from 'vscode';

type CompletionObject = {
  label: string | CompletionItemLabel;
  kind: CompletionItemKind | number;
  [key: string]: any;
};

export function mergeCompletions(a: CompletionObject[], b: CompletionObject[]): CompletionObject[] {
  const mergeMap = new Map<string, CompletionObject>();

  const addToMergeMap = (obj: CompletionObject) => {
    const key = `${obj.label},${obj.kind}`;
    mergeMap.set(key, obj);
  };

  a.forEach(addToMergeMap);
  b.forEach(addToMergeMap);

  return Array.from(mergeMap.values());
}
