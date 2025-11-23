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

function matchesPromoted(name?: string | null): boolean {
  return !!name && promotedCljsTypes.has(name);
}

export function shouldUsePromotedSession(sequence?: CljsTypeLike): boolean {
  if (!sequence || !sequence.cljsType) {
    return false;
  }
  const cljsType = sequence.cljsType;
  if (typeof cljsType === 'string') {
    return matchesPromoted(cljsType);
  }
  if (matchesPromoted(cljsType.name)) {
    return true;
  }
  if (matchesPromoted(cljsType.dependsOn)) {
    return true;
  }
  return false;
}
