/*! https://mths.be/utf8js v2.1.2 by @mathias */

var stringFromCharCode = String.fromCharCode;

// Taken from https://mths.be/punycode
function ucs2decode(string) {
  var output = [];
  var counter = 0;
  var length = string.length;
  var value;
  var extra;
  while (counter < length) {
    value = string.charCodeAt(counter++);
    if (value >= 0xd800 && value <= 0xdbff && counter < length) {
      // high surrogate, and there is a next character
      extra = string.charCodeAt(counter++);
      if ((extra & 0xfc00) == 0xdc00) {
        // low surrogate
        output.push(((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000);
      } else {
        // unmatched surrogate; only append this code unit, in case the next
        // code unit is the high surrogate of a surrogate pair
        output.push(value);
        counter--;
      }
    } else {
      output.push(value);
    }
  }
  return output;
}

// Taken from https://mths.be/punycode
function ucs2encode(array) {
  var length = array.length;
  var index = -1;
  var value;
  var output = "";
  while (++index < length) {
    value = array[index];
    if (value > 0xffff) {
      value -= 0x10000;
      output += stringFromCharCode(((value >>> 10) & 0x3ff) | 0xd800);
      value = 0xdc00 | (value & 0x3ff);
    }
    output += stringFromCharCode(value);
  }
  return output;
}

function checkScalarValue(codePoint, strict) {
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
    if (strict) {
      throw Error(
        "Lone surrogate U+" +
          codePoint.toString(16).toUpperCase() +
          " is not a scalar value"
      );
    }
    return false;
  }
  return true;
}
/*--------------------------------------------------------------------------*/

function createByte(codePoint, shift) {
  return stringFromCharCode(((codePoint >> shift) & 0x3f) | 0x80);
}

function encodeCodePoint(codePoint, strict) {
  if ((codePoint & 0xffffff80) == 0) {
    // 1-byte sequence
    return stringFromCharCode(codePoint);
  }
  var symbol = "";
  if ((codePoint & 0xfffff800) == 0) {
    // 2-byte sequence
    symbol = stringFromCharCode(((codePoint >> 6) & 0x1f) | 0xc0);
  } else if ((codePoint & 0xffff0000) == 0) {
    // 3-byte sequence
    if (!checkScalarValue(codePoint, strict)) {
      codePoint = 0xfffd;
    }
    symbol = stringFromCharCode(((codePoint >> 12) & 0x0f) | 0xe0);
    symbol += createByte(codePoint, 6);
  } else if ((codePoint & 0xffe00000) == 0) {
    // 4-byte sequence
    symbol = stringFromCharCode(((codePoint >> 18) & 0x07) | 0xf0);
    symbol += createByte(codePoint, 12);
    symbol += createByte(codePoint, 6);
  }
  symbol += stringFromCharCode((codePoint & 0x3f) | 0x80);
  return symbol;
}

function utf8encode(string, opts) {
  opts = opts || {};
  var strict = false !== opts.strict;

  var codePoints = ucs2decode(string);
  var length = codePoints.length;
  var index = -1;
  var codePoint;
  var byteString = "";
  while (++index < length) {
    codePoint = codePoints[index];
    byteString += encodeCodePoint(codePoint, strict);
  }
  return byteString;
}

/*--------------------------------------------------------------------------*/

function readContinuationByte() {
  if (byteIndex >= byteCount) {
    throw Error("Invalid byte index");
  }

  var continuationByte = byteArray[byteIndex] & 0xff;
  byteIndex++;

  if ((continuationByte & 0xc0) == 0x80) {
    return continuationByte & 0x3f;
  }

  // If we end up here, it’s not a continuation byte
  throw Error("Invalid continuation byte");
}

function decodeSymbol(strict) {
  var byte1;
  var byte2;
  var byte3;
  var byte4;
  var codePoint;

  if (byteIndex > byteCount) {
    throw Error("Invalid byte index");
  }

  if (byteIndex == byteCount) {
    return false;
  }

  // Read first byte
  byte1 = byteArray[byteIndex] & 0xff;
  byteIndex++;

  // 1-byte sequence (no continuation bytes)
  if ((byte1 & 0x80) == 0) {
    return byte1;
  }

  // 2-byte sequence
  if ((byte1 & 0xe0) == 0xc0) {
    byte2 = readContinuationByte();
    codePoint = ((byte1 & 0x1f) << 6) | byte2;
    if (codePoint >= 0x80) {
      return codePoint;
    } else {
      throw Error("Invalid continuation byte");
    }
  }

  // 3-byte sequence (may include unpaired surrogates)
  if ((byte1 & 0xf0) == 0xe0) {
    byte2 = readContinuationByte();
    byte3 = readContinuationByte();
    codePoint = ((byte1 & 0x0f) << 12) | (byte2 << 6) | byte3;
    if (codePoint >= 0x0800) {
      return checkScalarValue(codePoint, strict) ? codePoint : 0xfffd;
    } else {
      throw Error("Invalid continuation byte");
    }
  }

  // 4-byte sequence
  if ((byte1 & 0xf8) == 0xf0) {
    byte2 = readContinuationByte();
    byte3 = readContinuationByte();
    byte4 = readContinuationByte();
    codePoint =
      ((byte1 & 0x07) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;
    if (codePoint >= 0x010000 && codePoint <= 0x10ffff) {
      return codePoint;
    }
  }

  throw Error("Invalid UTF-8 detected");
}

var byteArray;
var byteCount;
var byteIndex;
function utf8decode(byteString, opts) {
  opts = opts || {};
  var strict = false !== opts.strict;

  byteArray = ucs2decode(byteString);
  byteCount = byteArray.length;
  byteIndex = 0;
  var codePoints = [];
  var tmp;
  while ((tmp = decodeSymbol(strict)) !== false) {
    codePoints.push(tmp);
  }
  return ucs2encode(codePoints);
}

module.exports = {
  version: "2.1.2",
  encode: utf8encode,
  decode: utf8decode
};
