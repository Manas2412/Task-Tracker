import { describe, expect, it } from 'vitest';

import { guessContentType } from '@/lib/mime';

/**
 * Uploads presign against an allow-list that rejects `application/octet-stream`,
 * so a file whose browser MIME is empty (common on Windows for Office docs)
 * must resolve to a canonical, allowed type from its extension — otherwise the
 * upload fails with "File type not allowed".
 */
describe('guessContentType', () => {
  it('maps a known extension to its canonical MIME when the browser reports nothing', () => {
    expect(guessContentType('brief.docx', '')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(guessContentType('sheet.xlsx', undefined)).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(guessContentType('letter.pdf', '')).toBe('application/pdf');
  });

  it('is case-insensitive on the extension', () => {
    expect(guessContentType('SCAN.PDF', '')).toBe('application/pdf');
    expect(guessContentType('photo.PNG', '')).toBe('image/png');
  });

  it('normalises a non-canonical browser MIME for a known extension', () => {
    // Chrome on Windows reports this for .zip; it is not on the allow-list.
    expect(guessContentType('docs.zip', 'application/x-zip-compressed')).toBe('application/zip');
  });

  it('prefers a known extension over an octet-stream browser type', () => {
    expect(guessContentType('notes.txt', 'application/octet-stream')).toBe('text/plain');
  });

  it('falls back to a usable browser type for an unknown extension', () => {
    expect(guessContentType('data.unknownext', 'text/plain')).toBe('text/plain');
  });

  it('falls back to octet-stream when nothing is known', () => {
    expect(guessContentType('mystery', '')).toBe('application/octet-stream');
    expect(guessContentType('mystery.weird', '')).toBe('application/octet-stream');
    expect(guessContentType('mystery.weird', 'application/octet-stream')).toBe(
      'application/octet-stream',
    );
  });
});
