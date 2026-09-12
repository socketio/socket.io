import { describe, it, expect } from 'vitest';

/**
 * Isolated unit tests for Socket.IO packet payload buffer size bounds validation.
 */

function validatePacketPayloadSize(sizeInBytes: number, maxPayloadBytes: number = 1e6): boolean {
  if (typeof sizeInBytes !== 'number' || isNaN(sizeInBytes)) return false;
  if (sizeInBytes < 0) return false;
  return sizeInBytes <= maxPayloadBytes;
}

describe('Packet Payload Size Bounds Validator', () => {
  it('should accept valid payload sizes within default limit', () => {
    expect(validatePacketPayloadSize(1024)).toBe(true);
    expect(validatePacketPayloadSize(1e6)).toBe(true);
    expect(validatePacketPayloadSize(0)).toBe(true);
  });

  it('should reject payloads exceeding maximum byte limit', () => {
    expect(validatePacketPayloadSize(1e6 + 1)).toBe(false);
    expect(validatePacketPayloadSize(5e6, 1e6)).toBe(false);
  });

  it('should reject negative sizes or non-numeric inputs', () => {
    expect(validatePacketPayloadSize(-1)).toBe(false);
    expect(validatePacketPayloadSize(NaN)).toBe(false);
  });
});
