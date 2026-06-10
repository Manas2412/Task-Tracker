/**
 * Tiny CSV parser — handles quoted fields, escaped quotes (""), and both
 * \n / \r\n line endings. Good enough for hand-prepared import templates.
 *
 * Returns an array of rows, each row an array of string fields. Empty
 * rows (all-blank fields) are skipped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuote = false;
  let i = 0;

  const pushField = () => {
    current.push(field);
    field = '';
  };
  const pushRow = () => {
    if (current.length > 0 && current.some((f) => f.length > 0)) {
      rows.push(current);
    }
    current = [];
  };

  while (i < text.length) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (c === '"') {
        inQuote = false;
        i++;
      } else {
        field += c;
        i++;
      }
    } else {
      if (c === '"') {
        inQuote = true;
        i++;
      } else if (c === ',') {
        pushField();
        i++;
      } else if (c === '\n' || c === '\r') {
        pushField();
        pushRow();
        if (c === '\r' && text[i + 1] === '\n') i += 2;
        else i++;
      } else {
        field += c;
        i++;
      }
    }
  }
  // Trailing field / row
  if (field.length > 0 || current.length > 0) {
    pushField();
    pushRow();
  }
  return rows;
}

/**
 * Build a CSV from header + rows. Quotes any field containing a comma,
 * quote, or newline. Escapes embedded quotes by doubling them.
 */
export function buildCsv(header: string[], rows: string[][]): string {
  const lines = [header, ...rows].map((row) => row.map(escape).join(','));
  return lines.join('\n') + '\n';
}

function escape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Map header row + each data row to objects keyed by header.
 * Missing fields default to empty string.
 */
export function rowsToObjects(
  rows: string[][],
): { headers: string[]; data: Record<string, string>[] } {
  if (rows.length === 0) return { headers: [], data: [] };
  const headers = rows[0].map((h) => h.trim());
  const data = rows.slice(1).map((row) => {
    const o: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      o[headers[i]] = (row[i] ?? '').trim();
    }
    return o;
  });
  return { headers, data };
}
