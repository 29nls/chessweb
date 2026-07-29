import { containsHtmlTags } from './htmlUtil';

/**
 * Share/Replay Link helpers
 *
 * Encodes game data (PGN + result) into a URL-friendly format
 * that can be shared and then decoded on the analysis page.
 *
 * URL format:
 *   /analysis?pgn=<encoded PGN>&result=<encoded result>
 *
 * The PGN is URL-encoded (btoa/atob safe). The result is
 * a JSON string encoded as base64url.
 */

/**
 * Encode game data into a query string for shareable URLs.
 * @param {string} pgn - The PGN string of the game
 * @param {{ winner: string|null, reason: string }|null} result - Game result
 * @returns {string} Query string (e.g., "?pgn=...&result=...")
 */
export function encodeGameToQuery(pgn, result) {
  const params = new URLSearchParams();

  // Compress PGN: remove excessive newlines and whitespace
  const compressedPgn = pgn
    .replace(/\n+/g, '\n')
    .replace(/\[[^\]]+\]\n/g, (m) => m.trim() + '\n')
    .trim();
  params.set('pgn', compressedPgn);

  // Encode result if present
  if (result && result.winner) {
    params.set('result', JSON.stringify({ winner: result.winner, reason: result.reason || '' }));
  }

  return '?' + params.toString();
}

/**
 * Generate a full shareable URL for a game.
 * @param {string} pgn - The PGN string
 * @param {{ winner: string|null, reason: string }|null} result - Game result
 * @param {string} [origin] - Optional origin override (defaults to window.location.origin)
 * @returns {string} Full URL (pathname + query string)
 */
export function generateShareUrl(pgn, result, origin) {
  const baseOrigin = typeof origin === 'string' ? origin : window.location.origin;
  const query = encodeGameToQuery(pgn, result);
  return `${baseOrigin}/analysis${query}`;
}

/**
 * Decode game data from URL search params.
 * @param {URLSearchParams} params
 * @returns {{ pgn: string|null, result: { winner: string, reason: string }|null }}
 */
export function decodeGameFromParams(params) {
  let pgn = params.get('pgn');
  if (pgn && containsHtmlTags(pgn)) {
    console.warn('share: PGN parameter contains forbidden HTML/script tags');
    pgn = null;
  }
  let result = null;
  const resultStr = params.get('result');
  if (resultStr) {
    try {
      const parsed = JSON.parse(resultStr);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        (parsed.winner === 'white' ||
          parsed.winner === 'black' ||
          parsed.winner === 'draw' ||
          parsed.winner === null ||
          parsed.winner === undefined) &&
        (parsed.reason === undefined ||
          parsed.reason === null ||
          (typeof parsed.reason === 'string' && !containsHtmlTags(parsed.reason)))
      ) {
        result = {
          winner: parsed.winner || null,
          reason: typeof parsed.reason === 'string' ? parsed.reason : '',
        };
      } else {
        console.warn('share: Invalid result schema in URL params');
      }
    } catch (err) {
      console.warn('share: Failed to decode result from params:', err);
    }
  }
  return { pgn, result };
}

/**
 * Copy a shareable link to the clipboard.
 * @param {string} pgn - The PGN string
 * @param {{ winner: string|null, reason: string }|null} result - Game result
 * @returns {Promise<boolean>} Whether the copy succeeded
 */
export async function copyShareLink(pgn, result) {
  const url = generateShareUrl(pgn, result);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch (clipErr) {
    console.warn('share: Clipboard API failed, trying execCommand fallback:', clipErr);
    // Fallback for older browsers or insecure contexts
    try {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (fallbackErr) {
      console.warn('share: execCommand clipboard fallback also failed:', fallbackErr);
      return false;
    }
  }
}
