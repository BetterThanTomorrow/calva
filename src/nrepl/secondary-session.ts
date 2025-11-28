const promotedCljsTypes: Set<string> = new Set([
  'shadow-cljs',
  'lein-figwheel',
  'Figwheel Main',
  'ClojureScript built-in for browser',
  'ClojureScript built-in for node',
]);

type CljsTypeValue = string | { name?: string | null; dependsOn?: string | null } | null;

interface CljsTypeLike {
  cljsType?: CljsTypeValue;
}

function matchesSecondary(name?: string | null): boolean {
  return !!name && promotedCljsTypes.has(name);
}

export function shouldUseSecondarySession(sequence?: CljsTypeLike): boolean {
  if (!sequence || !sequence.cljsType) {
    return false;
  }
  const cljsType = sequence.cljsType;
  if (typeof cljsType === 'string') {
    return matchesSecondary(cljsType);
  }
  if (matchesSecondary(cljsType.name)) {
    return true;
  }
  if (matchesSecondary(cljsType.dependsOn)) {
    return true;
  }
  return false;
}
