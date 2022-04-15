import { first, isArray, isNumber, last, ListIteratee, ListIterator } from 'lodash';
import _ = require('lodash');
import { ModelEditSelection } from './model';

export type SimpleRange = [start: number, end: number];
export type SimpleDirectedRange = [anchor: number, active: number];

export const mapRangeOrSelectionToOffset =
  /* <PROP_NAME extends 'start' | 'end' | 'anchor' | 'active' = 'start'> */


    (whichOffset: 'start' | 'end' | 'anchor' | 'active' = 'start') =>
    <T extends SimpleRange | ModelEditSelection>(t: T | [T, number]): number => {
      const rangeOrSel = isModelEditSelection(t) || isSimpleRange(t) ? t : first(t);

      if (rangeOrSel instanceof ModelEditSelection) {
        return rangeOrSel[whichOffset];
      } else if (Array.isArray(rangeOrSel)) {
        let fn;
        switch (whichOffset) {
          case 'start':
            fn = Math.min;
            break;
          case 'end':
            fn = Math.max;
            break;
          case 'anchor':
            fn = (...x) => first(x);
            break;
          case 'active':
            fn = (...x) => last(x);
            break;
          default:
            first;
        }

        return fn(...rangeOrSel);
      }
    };

export function repositionRangeOrSelectionByCumulativeOffsets(
  offsetGetter: ListIterator<ModelEditSelection, number> | number
) {
  return (
    s: ModelEditSelection,
    index: number,
    array: ModelEditSelection[]
  ): ModelEditSelection => {
    const newSel = s.clone();

    const getItemOffset = isNumber(offsetGetter) ? () => offsetGetter : offsetGetter;

    const offset = _(array)
      .filter((x) => x.start < s.start)
      .map(getItemOffset)
      .sum();

    newSel.reposition(offset);
    return newSel;
  };
}

export function isSimpleRange(o: any): o is SimpleRange {
  return isArray(o) && o.length === 2 && isNumber(o[0]) && isNumber(o[1]);
}

export function isModelEditSelection(o: any): o is ModelEditSelection {
  return o instanceof ModelEditSelection;
}
