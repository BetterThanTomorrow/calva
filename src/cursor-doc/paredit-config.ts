/**
 * Configuration for paredit pair forms and threading macros.
 * This module handles custom user configurations that extend the built-in defaults.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface VectorBindingForm {
  type: 'vector-binding';
  name: string;
}

export interface KeywordPairForm {
  type: 'keyword';
  keyword: string;
  validParents?: string[];
}

export interface FlatPairForm {
  type: 'flat';
  name: string;
  offset: number;
  tripleMarker?: string;
}

export type PairFormConfig = VectorBindingForm | KeywordPairForm | FlatPairForm;

export type GroupedPairForms = {
  'vector-binding': VectorBindingForm[];
  keyword: KeywordPairForm[];
  flat: FlatPairForm[];
};

export interface ThreadingMacrosConfig {
  firstArg: string[];
  lastArg: string[];
}

export type AliasMapConfig = { [alias: string]: string };

export interface PareditConfig {
  pairForms: GroupedPairForms;
  threadingMacros: ThreadingMacrosConfig;
  aliasMap: AliasMapConfig;
}

// ============================================================================
// Default Configurations
// ============================================================================

const defaultPairForms: PairFormConfig[] = [
  // Vector Binding forms
  { type: 'vector-binding', name: 'let' },
  { type: 'vector-binding', name: 'for' },
  { type: 'vector-binding', name: 'loop' },
  { type: 'vector-binding', name: 'binding' },
  { type: 'vector-binding', name: 'with-local-vars' },
  { type: 'vector-binding', name: 'doseq' },
  { type: 'vector-binding', name: 'with-redefs' },
  { type: 'vector-binding', name: 'promesa.core/let' },
  { type: 'vector-binding', name: 'reagent.core/with-let' },

  // Keyword-based modifiers
  { type: 'keyword', keyword: ':let', validParents: ['for', 'doseq', 'dotimes'] },

  // flat
  { type: 'flat', name: 'cond', offset: 1 },
  { type: 'flat', name: 'cond->', offset: 2 },
  { type: 'flat', name: 'cond->>', offset: 2 },
  { type: 'flat', name: 'case', offset: 2 },
  { type: 'flat', name: 'condp', offset: 3, tripleMarker: ':>>' },
  { type: 'flat', name: 'assoc', offset: 2 },
];

export const defaultGroupedDefaultPairForms = defaultPairForms.reduce<GroupedPairForms>(
  (acc, form) => {
    switch (form.type) {
      case 'vector-binding':
        acc['vector-binding'].push(form);
        break;
      case 'keyword':
        acc.keyword.push(form);
        break;
      case 'flat':
        acc.flat.push(form);
        break;
    }
    return acc;
  },
  { 'vector-binding': [], keyword: [], flat: [] }
);

export const defaultBindingForms = defaultGroupedDefaultPairForms['vector-binding'].map(
  (f) => f.name
);

export const defaultThreadingMacros: ThreadingMacrosConfig = {
  firstArg: ['->', 'some->', 'cond->'],
  lastArg: ['->>', 'some->>', 'cond->>'],
};

// ============================================================================
// Configuration Functions
// ============================================================================

/**
 * Groups pair forms by type for efficient lookups.
 */
export function groupPairForms(forms: PairFormConfig[]): GroupedPairForms {
  return forms.reduce<GroupedPairForms>(
    (acc, form) => {
      switch (form.type) {
        case 'vector-binding':
          acc['vector-binding'].push(form);
          break;
        case 'keyword':
          acc.keyword.push(form);
          break;
        case 'flat':
          acc.flat.push(form);
          break;
      }
      return acc;
    },
    { 'vector-binding': [], keyword: [], flat: [] }
  );
}

/**
 * Resolves an aliased symbol to its fully qualified form.
 * Example: resolveAliasedSymbol('p/let', {p: 'promesa.core'}) => 'promesa.core/let'
 */
export function resolveAliasedSymbol(symbol: string, aliasMap: AliasMapConfig): string {
  const slashIndex = symbol.indexOf('/');
  if (slashIndex === -1) {
    return symbol;
  }

  const nsAlias = symbol.substring(0, slashIndex);
  const name = symbol.substring(slashIndex + 1);
  const resolvedNs = aliasMap[nsAlias];

  return resolvedNs ? `${resolvedNs}/${name}` : symbol;
}

/**
 * Appends custom pair forms to defaults.
 * Custom forms cannot override built-in defaults - they are added to the end of the array.
 * Duplicate forms (matching type+name/keyword) are filtered out to keep the array clean.
 */
function mergePairForms(defaults: PairFormConfig[], customs: PairFormConfig[]): PairFormConfig[] {
  // Generate unique key for each form based on type and identifier
  const getKey = (f: PairFormConfig) => `${f.type}:${f.type === 'keyword' ? f.keyword : f.name}`;

  // Create a set of default keys for quick lookup
  const defaultKeys = new Set(defaults.map(getKey));

  // Filter out custom forms that duplicate defaults, then append the rest
  const uniqueCustoms = customs.filter((custom) => !defaultKeys.has(getKey(custom)));

  return [...defaults, ...uniqueCustoms];
}

/**
 * Creates a complete paredit configuration by merging custom forms and threading macros
 * with defaults.
 */
export function createPareditConfig(
  customPairForms: PairFormConfig[] = [],
  customThreadingMacros: Partial<ThreadingMacrosConfig> = {},
  aliasMap: AliasMapConfig = {}
): PareditConfig {
  const mergedForms = mergePairForms(defaultPairForms, customPairForms);
  return {
    pairForms: groupPairForms(mergedForms),
    threadingMacros: {
      firstArg: [...defaultThreadingMacros.firstArg, ...(customThreadingMacros.firstArg ?? [])],
      lastArg: [...defaultThreadingMacros.lastArg, ...(customThreadingMacros.lastArg ?? [])],
    },
    aliasMap,
  };
}
