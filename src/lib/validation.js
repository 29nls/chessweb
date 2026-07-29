import { Chess } from 'chess.js';
import { containsHtmlTags } from './htmlUtil';

export const MAX_CHAT_LENGTH = 200;
export const ALLOWED_REACTIONS = ['👍', '👏', '😂', '🎉', '🤔', '😢', '🔥', '💪'];
export const ALLOWED_REACTION_SET = new Set(ALLOWED_REACTIONS);

/**
 * Sanitize chat text by trimming, capping length, and stripping HTML/script tags
 * and null bytes as a defense-in-depth measure.
 * @param {unknown} text
 * @returns {string|null} sanitized text or null if invalid/empty
 */
export function sanitizeChatText(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/<[^>]*>/g, '').replace(/\0/g, '');
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_CHAT_LENGTH);
}

/**
 * Validate an emoji reaction against the allowed whitelist.
 * @param {unknown} emoji
 * @returns {string|null}
 */
export function sanitizeReaction(emoji) {
  if (typeof emoji !== 'string') return null;
  return ALLOWED_REACTION_SET.has(emoji) ? emoji : null;
}

/**
 * Validates a FEN string.
 * @param {string} fen
 * @returns {{ valid: boolean, error?: string, normalized?: string }}
 */
export function validateFen(fen) {
  if (typeof fen !== 'string') {
    return { valid: false, error: 'FEN must be a string' };
  }
  const trimmed = fen.trim();
  if (!trimmed) {
    return { valid: false, error: 'FEN is empty' };
  }
  try {
    const game = new Chess(trimmed);
    if (!game) {
      return { valid: false, error: 'Invalid FEN' };
    }
    return { valid: true, normalized: game.fen() };
  } catch (err) {
    return { valid: false, error: `Invalid FEN: ${err.message}` };
  }
}

/**
 * Validates a PGN string.
 * Rejects PGN that contains HTML/script tags as a defense-in-depth measure
 * against XSS, even though React escapes by default.
 * @param {string} pgn
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePgn(pgn) {
  if (typeof pgn !== 'string') {
    return { valid: false, error: 'PGN must be a string' };
  }
  const trimmed = pgn.trim();
  if (!trimmed) {
    return { valid: false, error: 'PGN is empty' };
  }
  if (containsHtmlTags(trimmed)) {
    return { valid: false, error: 'PGN contains forbidden HTML/script tags' };
  }
  try {
    const game = new Chess();
    game.loadPgn(trimmed);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Invalid PGN: ${err.message}` };
  }
}

// Engine resource limits
export const ENGINE_LIMITS = {
  MIN_DEPTH: 1,
  MAX_DEPTH: 50,
  MIN_MOVETIME: 100,
  MAX_MOVETIME: 60000,
  MIN_THREADS: 1,
  MAX_THREADS: 8,
  MIN_HASH: 1,
  MAX_HASH: 8192,
  MIN_MULTIPV: 1,
  MAX_MULTIPV: 5,
};

/**
 * Clamp engine analysis settings to safe ranges.
 * @param {Object} settings
 * @returns {{ depth: number, movetime: number, threads: number, hashSize: number, multiPv: number }}
 */
export function clampEngineSettings(settings = {}) {
  const {
    depth,
    movetime,
    threads,
    hashSize,
    multiPv,
  } = settings;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));

  return {
    depth: clamp(depth, ENGINE_LIMITS.MIN_DEPTH, ENGINE_LIMITS.MAX_DEPTH),
    movetime: clamp(movetime, ENGINE_LIMITS.MIN_MOVETIME, ENGINE_LIMITS.MAX_MOVETIME),
    threads: clamp(threads, ENGINE_LIMITS.MIN_THREADS, ENGINE_LIMITS.MAX_THREADS),
    hashSize: clamp(hashSize, ENGINE_LIMITS.MIN_HASH, ENGINE_LIMITS.MAX_HASH),
    multiPv: clamp(multiPv, ENGINE_LIMITS.MIN_MULTIPV, ENGINE_LIMITS.MAX_MULTIPV),
  };
}
