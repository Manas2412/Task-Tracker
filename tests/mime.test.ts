import { describe, expect, it } from 'vitest';

import {
  guessContentType,
  isOfficeDocument,
  officeWebViewerUrl,
} from '@/lib/mime';

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

/**
 * Office documents have no in-browser renderer, so `View` routes them through a
 * hosted Office viewer instead of a direct file URL.
 */
describe('isOfficeDocument', () => {
  it('detects Office files by canonical MIME', () => {
    expect(isOfficeDocument('deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe(true);
    expect(isOfficeDocument('x', 'application/msword')).toBe(true);
  });

  it('detects Office files by extension when the MIME is absent', () => {
    for (const name of ['brief.doc', 'brief.docx', 'sheet.xls', 'sheet.xlsx', 'deck.ppt', 'deck.PPTX']) {
      expect(isOfficeDocument(name)).toBe(true);
    }
  });

  it('is false for PDFs, images and other types', () => {
    expect(isOfficeDocument('report.pdf', 'application/pdf')).toBe(false);
    expect(isOfficeDocument('photo.png', 'image/png')).toBe(false);
    expect(isOfficeDocument('notes.txt', 'text/plain')).toBe(false);
    expect(isOfficeDocument('data.csv', 'text/csv')).toBe(false);
  });
});

describe('officeWebViewerUrl', () => {
  it('URL-encodes the file URL into the src parameter', () => {
    const src = 'https://bucket.s3.ap-south-1.amazonaws.com/tasks/a/deck.pptx?X-Amz-Signature=ab%2Bcd&x=1';
    expect(officeWebViewerUrl(src)).toBe(
      `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(src)}`,
    );
    // The raw query separators must be encoded so they belong to `src`.
    expect(officeWebViewerUrl(src)).not.toContain('&x=1');
  });
});
