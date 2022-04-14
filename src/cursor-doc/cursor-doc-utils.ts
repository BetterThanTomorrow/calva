import { first, last } from 'lodash';
import { ModelEditSelection } from './model';

export type SimpleRange = [start: number, end: number];
export type SimpleDirectedRange = [anchor: number, active: number];

export const rangeOrSelProp =
  <PROP_NAME extends 'start' | 'end' | 'anchor' | 'active'>(property: PROP_NAME) =>
  <T extends SimpleRange | ModelEditSelection>(o: T): number => {
    if (o instanceof ModelEditSelection) {
      return o[property];
    } else if (Array.isArray(o)) {
      let fn;
      switch (property) {
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

      return fn(...o);
    }
  };
