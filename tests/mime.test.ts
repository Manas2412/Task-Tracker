import { describe, expect, it } from 'vitest';

import {
  guessContentType,
  isBrowserPrintable,
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

/**
 * Only files the browser can safely render inline may be auto-printed via a
 * same-origin blob iframe. SVG is excluded as a security boundary (a scripted
 * SVG rendered same-origin would execute — see the print route); TIFF/HEIC are
 * excluded because no cross-browser decoder exists (they would print blank).
 */
describe('isBrowserPrintable', () => {
  it('is true for PDFs and common raster images', () => {
    expect(isBrowserPrintable('report.pdf', 'application/pdf')).toBe(true);
    expect(isBrowserPrintable('photo.png', 'image/png')).toBe(true);
    expect(isBrowserPrintable('photo.jpg', 'image/jpeg')).toBe(true);
    expect(isBrowserPrintable('anim.gif', 'image/gif')).toBe(true);
    expect(isBrowserPrintable('pic.webp', 'image/webp')).toBe(true);
    expect(isBrowserPrintable('pic.bmp', 'image/bmp')).toBe(true);
  });

  it('classifies by extension when the MIME is absent or non-canonical', () => {
    expect(isBrowserPrintable('report.pdf', null)).toBe(true);
    expect(isBrowserPrintable('photo.PNG', undefined)).toBe(true);
    expect(isBrowserPrintable('report.pdf', 'application/octet-stream')).toBe(true);
  });

  it('is false for SVG by MIME and by extension (XSS boundary)', () => {
    expect(isBrowserPrintable('logo.svg', 'image/svg+xml')).toBe(false);
    expect(isBrowserPrintable('logo.svg', null)).toBe(false);
    // A spoofed .svg name with an image MIME must still not be printable.
    expect(isBrowserPrintable('logo.svg', 'image/png')).toBe(false);
  });

  it('is false for TIFF and HEIC (no cross-browser decoder)', () => {
    expect(isBrowserPrintable('scan.tiff', 'image/tiff')).toBe(false);
    expect(isBrowserPrintable('scan.tif', 'image/tiff')).toBe(false);
    expect(isBrowserPrintable('shot.heic', 'image/heic')).toBe(false);
  });

  it('is false for Office docs, archives and unknown types', () => {
    expect(isBrowserPrintable('deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe(false);
    expect(isBrowserPrintable('brief.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(false);
    expect(isBrowserPrintable('bundle.zip', 'application/zip')).toBe(false);
    expect(isBrowserPrintable('page.html', 'text/html')).toBe(false);
    expect(isBrowserPrintable('mystery', null)).toBe(false);
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
