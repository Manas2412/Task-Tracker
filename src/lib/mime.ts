/**
 * Client-safe content-type helper for browser uploads.
 *
 * Browsers sometimes report an empty `File.type` — common on Windows for
 * Office documents — which the upload presign route rejects, because
 * `application/octet-stream` is not on its allow-list. They also occasionally
 * report a non-canonical type (e.g. Chrome sends `application/x-zip-compressed`
 * for `.zip`, which is likewise not on the list). So for known document and
 * image extensions we use the canonical MIME type; otherwise we fall back to
 * the browser's value, then to `application/octet-stream`.
 *
 * The same value must be used for the presign request, the direct PUT header,
 * and the register step, so the presigned signature and the PUT content-type
 * always agree.
 */
const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
};

/**
 * Best content-type for an upload: the canonical type for a known extension,
 * else a usable browser-reported type, else `application/octet-stream`.
 */
export function guessContentType(fileName: string, browserType?: string | null): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  const byExt = EXT_TO_MIME[ext];
  if (byExt) return byExt;
  const reported = (browserType ?? '').trim().toLowerCase();
  if (reported && reported !== 'application/octet-stream') return reported;
  return 'application/octet-stream';
}

function extensionOf(fileName: string): string {
  return fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
}

const OFFICE_MIMES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const OFFICE_EXTS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);

/**
 * A Microsoft Office document (Word / Excel / PowerPoint). Browsers cannot
 * render these inline, so `View` routes them through a hosted Office viewer
 * (see `officeWebViewerUrl`) rather than a direct file URL. Client- and
 * server-safe (pure).
 */
export function isOfficeDocument(fileName: string, mimeType?: string | null): boolean {
  if (mimeType && OFFICE_MIMES.has(mimeType)) return true;
  return OFFICE_EXTS.has(extensionOf(fileName));
}

// Raster image types every mainstream browser can decode and therefore print
// in an iframe. Deliberately EXCLUDES:
//   - image/svg+xml — an SVG is an active document that can carry inline
//     scripts; rendering it from a same-origin blob would execute them (XSS).
//     It must always take the cross-origin hosted-viewer fallback instead.
//   - image/tiff, image/heic — no cross-browser decoder, so they would open the
//     print dialog on a blank page rather than the intended fallback.
const PRINTABLE_IMAGE_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp',
]);

const PRINTABLE_IMAGE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp',
]);

/**
 * Whether the browser can safely render — and therefore print — this file
 * directly in an iframe (a PDF or a common raster image). These types can be
 * auto-printed from the client. Everything else — Office docs, SVGs, archives,
 * exotic image formats — has no safe in-browser renderer here and is opened in
 * its hosted viewer / a new tab instead. The exclusion of SVG is a security
 * boundary (see the print route), not just a rendering nicety. Client- and
 * server-safe (pure).
 */
export function isBrowserPrintable(fileName: string, mimeType?: string | null): boolean {
  const ext = extensionOf(fileName);
  // Never auto-print an SVG, however it is labelled — the extension or the MIME
  // being SVG is enough to force the safe cross-origin fallback. This is the
  // security boundary; the checks below are correctness/rendering.
  if (ext === 'svg' || mimeType === 'image/svg+xml') return false;
  if (mimeType === 'application/pdf') return true;
  if (mimeType && PRINTABLE_IMAGE_MIMES.has(mimeType)) return true;
  // Fall back to the extension only when the stored MIME is absent or
  // non-canonical; the extension set is the same safe allow-list, so a
  // `.tiff`/`.heic` name still returns false.
  return ext === 'pdf' || PRINTABLE_IMAGE_EXTS.has(ext);
}

/**
 * The Microsoft Office Online viewer URL for a publicly-fetchable file URL
 * (e.g. a short-lived presigned S3 link). Opens the document directly in a
 * single, fully-featured viewer tab — print, download, zoom and page
 * navigation — with no intermediate preview/pop-out hops. `fileUrl` is
 * URL-encoded into the `src` parameter.
 */
export function officeWebViewerUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
}
