// polyfill for Node.js < 12
// reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries
export const objectFromEntries =
  Object.fromEntries ||
  function fromEntries<T = unknown>(
    entries: Iterable<readonly [PropertyKey, T]>,
  ): Record<PropertyKey, T> {
    const obj: Record<PropertyKey, T> = {};

    for (const [key, value] of entries) {
      obj[key] = value;
    }

    return obj;
  };
