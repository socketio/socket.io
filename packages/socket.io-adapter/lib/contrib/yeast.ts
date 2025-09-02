// imported from https://github.com/unshiftio/yeast
"use strict";

const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_".split(
      "",
    ),
  length = 64,
  map: Record<string, number> = {};
let seed = 0,
  i = 0,
  prev: string | undefined;

/**
 * Return a string representing the specified number.
 *
 * @param {Number} num The number to convert.
 * @returns {String} The string representation of the number.
 * @api public
 */
export function encode(num: number): string {
  let encoded = "";

  do {
    encoded = alphabet[num % length] + encoded;
    num = Math.floor(num / length);
  } while (num > 0);

  return encoded;
}

/**
 * Return the integer value specified by the given string.
 *
 * @param {String} str The string to convert.
 * @returns {Number} The integer value represented by the string.
 * @api public
 */
export function decode(str: string): number {
  let decoded = 0;

  for (i = 0; i < str.length; i++) {
    decoded = decoded * length + map[str.charAt(i)];
  }

  return decoded;
}

/**
 * Yeast: A tiny growing id generator.
 * @returns {String} A unique id.
 */
export function yeast(): string {
  const now = encode(+new Date());

  if (now !== prev) return (seed = 0), (prev = now);
  return now + "." + encode(seed++);
}

// Map each character to its index
alphabet.forEach((char, idx) => { map[char] = idx });
