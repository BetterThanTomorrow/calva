import { formatTextAtIdx, formatTextAtIdxOnType, jsify } from '../../../out/cljs-lib/cljs-lib';

export function formatIndex(
  allText: string,
  range: [number, number],
  index: number,
  eol: string,
  onType: boolean = false,
  config = {}
): { 'range-text': string; range: number[]; 'new-index': number; idx: number } {
  const d = {
    'all-text': allText,
    idx: index,
    eol,
    range,
    config,
  };
  const result = jsify((onType ? formatTextAtIdxOnType : formatTextAtIdx)(d));
  if (!result['error']) {
    return result;
  } else {
    console.error('Error in `formatIndex`:', result['error']);
    throw result['error'];
  }
}
