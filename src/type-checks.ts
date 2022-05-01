const isNonEmptyString = (value: any): boolean => typeof value == 'string' && value.length > 0;

const isNullOrUndefined = (object: unknown): object is null | undefined =>
  object === null || object === undefined;

const isDefined = <T>(value: T | undefined | null): value is T => {
  return !isNullOrUndefined(value);
};

// This needs to be a function and not an arrow function
// because assertion types are special.
function assertIsDefined<T>(
  value: T | undefined | null,
  message: string | (() => string)
): asserts value is T {
  if (isNullOrUndefined(value)) {
    console.trace({ value, message });
    throw new Error(typeof message === 'string' ? message : message());
  }
}

export { isNonEmptyString, isNullOrUndefined, isDefined, assertIsDefined };
