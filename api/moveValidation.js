const { parseJsonBody } = require('./_lib/bodyParser');
const { setCorsHeaders } = require('./_lib/cors');

/**
 * PUT /api/moveValidation
 * Validates a chess move server-side using chess.js.
 *
 * Request body: { fen, from, to }
 * Response: { legal: boolean, san?: string, error?: string }
 *
 * This provides authoritative move validation so clients can verify moves
 * before broadcasting, and detect invalid moves early.
 */

module.exports = async function handler(req, res) {
  setCorsHeaders(res, 'PUT, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { fen, from, to } = body || {};

  // Validate required fields
  if (typeof fen !== 'string' || !from || !to) {
    return res.status(400).json({ error: 'Missing required fields: fen, from, to' });
  }

  if (from.length !== 2 || to.length !== 2) {
    return res.status(400).json({ error: 'Invalid square format. Expected 2-character square like "e2".' });
  }

  // Validate squares are within board bounds
  const validFiles = 'abcdefgh';
  const validRanks = '12345678';
  if (!validFiles.includes(from[0]) || !validRanks.includes(from[1]) ||
      !validFiles.includes(to[0]) || !validRanks.includes(to[1])) {
    return res.status(400).json({ error: 'Invalid square. Must be a valid chess square (e.g., "e4").' });
  }

  const { Chess } = require('chess.js');

  try {
    const game = new Chess(fen);
    const move = game.move({ from, to });

    if (!move) {
      return res.status(200).json({ legal: false, error: 'Illegal move in current position' });
    }

    return res.status(200).json({
      legal: true,
      san: move.san,
    });
  } catch (err) {
    return res.status(400).json({ error: `Invalid FEN or move error: ${err.message}` });
  }
};
