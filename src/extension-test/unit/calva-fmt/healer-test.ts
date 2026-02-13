import * as expect from 'expect';
import * as healer from '../../../calva-fmt/src/healer';
import * as model from '../../../cursor-doc/model';

model.initScanner(20000);

describe('calva-fmt', () => {
  it('Heals unopened list', () => {
    const originalDoc = '(def a[:x :y :z ])';
    //                         \----------/
    const originalFrag = originalDoc.substring(6);
    const healing = healer.bandage(originalFrag, 6, '\n');
    expect(healing.healedText).toEqual('([:x :y :z ])');
    const formattedHealed = '([:x :y :z])';
    const replacement = healer.unbandage(healing, formattedHealed);
    expect(replacement).toEqual('[:x :y :z])');
  });
  it('Heals unclosed vector', () => {
    const originalDoc = '(def a[:x :y :z ]) ';
    //                         \--------/
    const originalFrag = originalDoc.substring(6, 16);
    const healing = healer.bandage(originalFrag, 6, '\n');
    expect(healing.healedText).toEqual('[:x :y :z]');
    const formattedHealed = '[:x :y :z]';
    const replacement = healer.unbandage(healing, formattedHealed);
    expect(replacement).toEqual('[:x :y :z ');
  });
  it('Indents subsequent lines relative to first-line indent', () => {
    const originalFrag = '(def a\n42)';
    const healing = healer.bandage(originalFrag, 4, '\n');
    expect(healing.healedText).toEqual('(def a\n42)');
    const formattedHealed = '(def a\n  42)';
    const replacement = healer.unbandage(healing, formattedHealed);
    expect(replacement).toEqual('(def a\n      42)');
  });
});
