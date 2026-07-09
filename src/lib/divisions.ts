/**
 * Division ordering helpers for the grouped tasks / timeline-files views.
 *
 * "Group by division" sorts regular divisions first, then Media & IT, then
 * the PMUs — so Media & IT is pushed below the other divisions and the PMUs
 * sit at the very bottom.
 */

/** True for the "Media & IT" division, which sorts after every other division. */
export function isMediaAndIt(name: string): boolean {
  const normalised = name
    .trim()
    .toLowerCase()
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s+/g, ' ');
  return normalised === 'media and it';
}
