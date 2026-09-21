import { LIMITS } from '../../config';

export type InputError = 'TITLE_REQUIRED' | 'BODY_REQUIRED' | 'BODY_TOO_LARGE';

/** Size of a string once encoded as UTF-8 (Hermes has no reliable TextEncoder everywhere). */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4; // surrogate pair encodes one 4-byte code point
      i++;
    } else bytes += 3;
  }
  return bytes;
}

export function validateInput(input: { title: string; body: string }): InputError[] {
  const errors: InputError[] = [];
  if (!input.title.trim()) errors.push('TITLE_REQUIRED');
  if (!input.body.trim()) errors.push('BODY_REQUIRED');
  else if (utf8Bytes(input.body) > LIMITS.maxBodyBytes) errors.push('BODY_TOO_LARGE');
  return errors;
}

/** Guesses a title from the first non-empty line of a text. */
export function guessTitle(body: string): string {
  const first = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!first) return '';
  return first.length > 60 ? `${first.slice(0, 57)}...` : first;
}
