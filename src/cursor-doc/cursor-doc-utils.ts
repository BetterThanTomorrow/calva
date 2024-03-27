import { first, isNumber, last, ListIterator, range } from 'lodash';
import { isModelEditSelection, isModelRange, ModelEditRange, ModelEditSelection } from './model';
import _ = require('lodash');

type RangeOrSelection = ModelEditRange | ModelEditSelection;
export function mapRangeOrSelectionToOffset1(
  side: 'start' | 'end' | 'anchor' | 'active' = 'start'
) {
  return function inner(
    // support passing either range/sel or [range/sel, original list order]
    t: RangeOrSelection | [rangeOrSel: RangeOrSelection, order: number]
  ): number {
    // const rangeOrSel = isModelEditSelection(t) || isModelRange(t) ? t : first(t);
    const rangeOrSel = isModelEditSelection(t) ? t : isModelRange(t) ? t : t[0];

    if (rangeOrSel instanceof ModelEditSelection) {
      return rangeOrSel[side];
    } else if (isModelRange(rangeOrSel)) {
      // let fn: (...args: number[]) => number;
      switch (side) {
        case 'start':
          // fn = Math.min;
          return Math.min(...rangeOrSel);
        // break;
        case 'end':
          // fn = Math.max;
          return Math.max(...rangeOrSel);
        // break;
        case 'anchor':
          // fn = (...x) => first(x);
          return first(rangeOrSel);
        // break;
        case 'active':
          // fn = (...x) => last(x);
          return last(rangeOrSel);
        // break;
        default:
          // break;
          return range[0];
      }

      // return fn(...rangeOrSel);
      // return fn(...rangeOrSel);
    }
  };
}
export function mapRangeOrSelectionToOffset(side: 'start' | 'end' | 'anchor' | 'active' = 'start') {
  return function inner(
    // support passing either range/sel or [range/sel, original list order]
    t: RangeOrSelection | [rangeOrSel: RangeOrSelection, order: number]
  ): number {
    const rangeOrSel = isModelEditSelection(t) ? t : isModelRange(t) ? t : t[0];

    if (rangeOrSel instanceof ModelEditSelection) {
      return rangeOrSel[side];
    } else if (isModelRange(rangeOrSel)) {
      switch (side) {
        case 'start':
          return Math.min(...rangeOrSel);
        case 'end':
          return Math.max(...rangeOrSel);
        case 'anchor':
          return first(rangeOrSel);
        case 'active':
          return last(rangeOrSel);
        default:
          return range[0];
      }
    }
  };
}

export function repositionSelectionByCumulativeOffsets(
  /**
   * Either a fixed offset to add for each cursor (eg 2 if wrapping by parens),
   * or a 'getter' fn to get the value from each cursor.
   */
  offsetGetter: ListIterator<ModelEditSelection, number> | number
) {
  // if (true) {
  return repositionSelectionWithGetterByCumulativeOffsets<ModelEditSelection>(
    _.identity,
    offsetGetter
  );
}

export function repositionSelectionWithGetterByCumulativeOffsets<T>(
  selectionGetter: ListIterator<T, ModelEditSelection>,
  /**
   * Either a fixed offset to add for each cursor (eg 2 if wrapping by parens),
   * or a 'getter' fn to get the value from each cursor.
   */
  offsetGetter: ListIterator<ModelEditSelection, number> | number
) {
  return (
    t: T,
    index: number,
    // array: ModelEditSelection[]
    array: T[]
  ): ModelEditSelection => {
    const sel = selectionGetter(t, index, array);
    const newSel = sel.clone();

    const getItemOffset = isNumber(offsetGetter) ? () => offsetGetter : offsetGetter;

    const offset = _(array)
      .filter((x, i, a) => {
        const s = selectionGetter(x, i, a);
        return s.start < sel.start;
      })
      .map(getItemOffset)
      .sum();

    newSel.reposition(offset);
    return newSel;
  };
}
