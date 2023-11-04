import { CompletionItemKind, CompletionItemLabel } from 'vscode';

type CompletionObject = {
  label: string | CompletionItemLabel;
  kind: CompletionItemKind | number;
  [key: string]: any;
};

export function mergeCompletions(a: CompletionObject[], b: CompletionObject[]): CompletionObject[] {
  const merge = (map: Map<string, CompletionObject>, obj: CompletionObject) => {
    const key = `${obj.label},${obj.kind}`;
    const existingObj = map.get(key);
    if (!existingObj || obj.score >= existingObj.score) {
      map.set(key, obj);
    }
    return map;
  };

  const mergedMap = [...a, ...b].reduce(merge, new Map<string, CompletionObject>());

  return Array.from(mergedMap.values());
}
