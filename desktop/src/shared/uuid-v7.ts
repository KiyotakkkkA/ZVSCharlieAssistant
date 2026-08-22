let lastTimestamp = 0;
let sequence = 0;

export function newUuidV7(now = Date.now()): string {
  let timestamp = Math.max(now, lastTimestamp);
  if (timestamp === lastTimestamp) {
    sequence += 1;
    if (sequence > 0x0fff) {
      timestamp += 1;
      sequence = 0;
    }
  } else {
    const seed = randomBytes(2);
    sequence = ((seed[0]! << 8) | seed[1]!) & 0x0fff;
  }
  lastTimestamp = timestamp;

  const bytes = randomBytes(16);
  let value = BigInt(timestamp);
  for (let index = 5; index >= 0; index--) {
    bytes[index] = Number(value & 0xffn);
    value >>= 8n;
  }
  bytes[6] = 0x70 | ((sequence >> 8) & 0x0f);
  bytes[7] = sequence & 0xff;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}
