import * as _ from 'lodash';

export const replaceAt = <A>(array: A[], index: number, replacement: A): A[] => {
  return array
    .slice(0, index)
    .concat([replacement])
    .concat(array.slice(index + 1));
};

export function doto<T>(x: T, ...fns: ((x: T) => any)[]): T {
  for (const fn of fns) {
    fn?.(x);
  }
  return x;
}

export function isBlank(s: string): boolean {
  return s.trim().length === 0;
}

// like _.property combined with clojure's select-keys;
// returns a new object with only the specified keys (or nested lodash property paths)
export function properties(...keys: string[]) {
  return (obj: any) => _.pick(obj, keys);
}

// like clojure's comp fn
// export function comp(...fns: ((...args: any[]) => any)[]) { return _.flowRight(fns); }
export const comp = _.flowRight;

declare module 'lodash' {
  interface LoDashStatic {
    doto: <T>(x: T, ...fns: ((x: T) => any)[]) => T;
    isBlank: (s: string) => boolean;
    replaceAt: typeof replaceAt;
    properties: typeof properties;
    comp: typeof comp;
  }
  // interface LoDashImplicitWrapper<TValue> {
  // doto(...fns: ((x: TValue) => any)[]): LoDashImplicitWrapper<TValue>;
  // isBlank(): boolean;
  // replaceAt<TValue>(index: number, replacement: TValue): TValue[];
  // }
  interface LoDashImplicitWrapper<TValue> {
    /**
     * @see _.doto
     */
    // doto<T extends TValue>(
    doto(
      this: LoDashImplicitWrapper<TValue | null | undefined>,
      ...fns: ((x: TValue) => any)[]
    ): LoDashImplicitWrapper<TValue>;
    doto<T>(
      this: LoDashImplicitWrapper<List<T> | null | undefined>,
      ...fns: ((x: T) => any)[]
    ): LoDashImplicitWrapper<List<T>>;
    doto<T>(
      this: LoDashImplicitWrapper<Collection<T> | null | undefined>,
      ...fns: ((x: T) => any)[]
    ): LoDashImplicitWrapper<Collection<T>>;
    doto<T>(
      this: LoDashImplicitWrapper<T[] | null | undefined>,
      ...fns: ((x: T) => any)[]
    ): LoDashImplicitWrapper<T[]>;
    isBlank(this: LoDashImplicitWrapper<TValue | null | undefined>): boolean;
    replaceAt(
      this: LoDashImplicitWrapper<TValue | null | undefined>,
      index: number,
      replacement: TValue
    ): TValue[];
  }
  interface LoDashExplicitWrapper<T> {
    /**
     * @see _.doto
     */
    // doto<T>(
    doto(
      this: LoDashExplicitWrapper<T | null | undefined>,
      ...fns: ((x: T) => any)[]
    ): LoDashExplicitWrapper<T>;
    isBlank(this: LoDashImplicitWrapper<T | null | undefined>): boolean;
    replaceAt<T>(
      this: LoDashImplicitWrapper<T | null | undefined>,
      index: number,
      replacement: T
    ): T[];
  }
}

_.mixin({ doto, isBlank, replaceAt }, { chain: true });
_.mixin({ properties, comp }, { chain: false });
