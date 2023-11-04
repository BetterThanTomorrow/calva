import { CompletionItem, CompletionItemKind, CompletionItemLabel } from 'vscode';

type CompletionKey = [string | CompletionItemLabel, CompletionItemKind | number];
type CompletionMap = Map<CompletionKey, CompletionItem>;

type CompletionObject = {
  label: string | CompletionItemLabel;
  kind: CompletionItemKind | number;
  [key: string]: any;
};

const objectToMap = (obj: CompletionObject[]): CompletionMap => {
  return new Map(
    obj.map((item) => {
      const completionKey: CompletionKey = [item.label, item.kind];
      return [completionKey, item];
    })
  );
};

export const _padArray = (arr: CompletionObject[], length: number): CompletionMap[] => {
  const maps = arr.map((obj) => objectToMap([obj])); // Create a new CompletionMap for each CompletionObject
  const padding = Array.from({ length: length - maps.length }, () => new Map());
  return maps.concat(padding);
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
