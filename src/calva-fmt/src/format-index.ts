import { formatTextAtIdx, formatTextAtIdxOnType, jsify } from '../../../out/cljs-lib/cljs-lib';

/**
 *
 * @param allText Document text
 * @param range Range of document to format
 * @param indexes Offsets into allText where blank-line indentation should be respected or corrected
 * @param eol End-of-line marker or the document
 * @param onType
 * @param config
 * @returns
 */
export function formatIndexes(
  allText: string,
  range: [number, number],
  indexes: number[],
  eol: string,
  onType: boolean = false,
  config = {}
): { 'range-text': string; range: number[] } {
  const d = {
    'all-text': allText,
    idxs: indexes,
    eol,
    range,
    config,
  };
  const result = jsify((onType ? formatTextAtIdxOnType : formatTextAtIdx)(d));
  if (!result['error']) {
    return result;
  } else {
    console.error('Error in `formatIndexes`:', result['error']);
    throw result['error'];
  }
}
