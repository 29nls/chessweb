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
 * @returns {string} Full URL (pathname + query string)
 */
export function generateShareUrl(pgn, result) {
  const query = encodeGameToQuery(pgn, result);
  return `${window.location.origin}/analysis${query}`;
}

/**
 * Decode game data from URL search params.
 * @param {URLSearchParams} params
 * @returns {{ pgn: string|null, result: { winner: string, reason: string }|null }}
 */
export function decodeGameFromParams(params) {
  const pgn = params.get('pgn');
  let result = null;
  const resultStr = params.get('result');
  if (resultStr) {
    try {
      result = JSON.parse(resultStr);
    } catch {
      // Ignore invalid result data
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
  } catch {
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
    } catch {
      return false;
    }
  }
}
