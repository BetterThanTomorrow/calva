import { EditableDocument, ModelEditSelection } from './model';

export function selectionToRange(
  selection: ModelEditSelection,
  assumeDirection: 'ltr' | 'rtl' = undefined
) {
  const { anchor, active } = selection;
  switch (assumeDirection) {
    case 'ltr':
      return [anchor, active];
    case 'rtl':
      return [active, anchor];
    case undefined:
    default: {
      const start = 'start' in selection ? selection.start : Math.min(anchor, active);
      const end = 'end' in selection ? selection.end : Math.max(anchor, active);
      return [start, end];
    }
  }
}
