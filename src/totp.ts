import { createHmac } from 'crypto';

/**
 * Generates a 6-digit TOTP code from a Base32-encoded secret seed.
 *
 * Implements TOTP as defined by RFC 6238 using SHA-1 and a 30-second time step.
 *
 * @param secret Base32-encoded TOTP secret.
 * @param timestamp Unix timestamp in milliseconds. Defaults to the current time.
 * @returns The current 6-digit TOTP code.
 *
 * @see https://www.rfc-editor.org/info/rfc6238/
 */
export function generateTotp(secret: string, timestamp = Date.now()): string {
  const key = decodeBase32(secret);

  const counter = Math.floor(timestamp / 30_000);

  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));

  const hash = createHmac('sha1', key).update(counterBytes).digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const code = hash.readUInt32BE(offset) & 0x7fffffff;

  return String(code % 1_000_000).padStart(6, '0');
}

/**
 * Decodes an RFC 4648 Base32-encoded string into a byte buffer.
 *
 * Whitespace and RFC 4648 padding characters are ignored. Invalid
 * Base32 characters cause an error.
 *
 * @param value Base32-encoded string using the RFC 4648 alphabet.
 * @returns The decoded bytes.
 * @throws Error if the input contains an invalid Base32 character.
 *
 * @see https://www.rfc-editor.org/info/rfc4648/#section-6
 */
function decodeBase32(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of value.toUpperCase().replace(/[\s=]/g, '')) {
    const value = alphabet.indexOf(char);

    if (value < 0) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }

    buffer = (buffer << 5) | value;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return Buffer.from(bytes);
}
