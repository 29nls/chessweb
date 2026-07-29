/**
 * Detects whether a string contains HTML-like tags.
 * Used as a defense-in-depth check against XSS payloads in user input.
 *
 * @param {string} str
 * @returns {boolean}
 */
export function containsHtmlTags(str) {
  return typeof str === 'string' && /<[^>]*>/.test(str);
}
