/**
 * Validates an selected engine string.
 * @param {unknown} value
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
function validateEngineSelection(value) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return { valid: false, error: 'Engine name is required' };
  }

  if (typeof value !== 'string') {
    return { valid: false, error: 'Engine name must be a string' };
  }

  const trimmed = value.trim();

  // Reject suspicious characters that might be used in command injection
  if (!/^[\w\s().\-/:]+$/.test(trimmed)) {
    return { valid: false, error: 'Engine name contains invalid characters' };
  }

  // Limit length to avoid abuse
  if (trimmed.length > 120) {
    return { valid: false, error: 'Engine name is too long' };
  }

  return { valid: true, value: trimmed };
}

/**
 * Available backend engine names. Keep in sync with the actual engines available
 * on the backend server.
 */
const AVAILABLE_ENGINES = [
  'Stockfish 18',
  'Stockfish 17',
  'Lichess Cloud Engine',
];

module.exports = { validateEngineSelection, AVAILABLE_ENGINES };
