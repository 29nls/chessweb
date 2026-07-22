/**
 * Parse Supabase/Postgres errors into user-friendly messages.
 * Handles RLS violations, network errors, constraint violations, and RPC errors.
 */

const ERROR_PATTERNS = [
  {
    // RLS policy violation
    test: (msg) => /violates row-level security policy/i.test(msg),
    friendly: () => 'Server permission error. The game system is being set up — please try again in a moment.',
    code: 'RLS_VIOLATION',
  },
  {
    // Unique constraint violation (duplicate game code — extremely rare but possible)
    test: (msg) => /duplicate key.*violates.*unique constraint/i.test(msg),
    friendly: () => 'A game with this code already exists. Please try again — a new code will be generated.',
    code: 'DUPLICATE_CODE',
  },
  {
    // Network / connection failure
    test: (msg) => /Failed to fetch|NetworkError|network.*error|ERR_NETWORK|abort/i.test(msg),
    friendly: () => 'Could not reach the server. Please check your internet connection and try again.',
    code: 'NETWORK',
  },
  {
    // Timeout
    test: (msg) => /timeout|timed? ?out/i.test(msg),
    friendly: () => 'The server took too long to respond. Please try again.',
    code: 'TIMEOUT',
  },
  {
    // Supabase channel / realtime error
    test: (msg) => /channel|realtime|subscribe/i.test(msg),
    friendly: () => 'Could not connect to the game channel. Please refresh and try again.',
    code: 'CHANNEL',
  },
  {
    // RPC function not found
    test: (msg) => /function.*not found|does not exist/i.test(msg),
    friendly: () => 'Game server setup issue. Please contact support.',
    code: 'RPC_MISSING',
  },
  {
    // Rate limiting
    test: (msg) => /rate limit|too many requests|429/i.test(msg),
    friendly: () => 'Too many requests. Please wait a moment before trying again.',
    code: 'RATE_LIMIT',
  },
  {
    // Slot already claimed (our custom RPC returns this pattern)
    test: (msg) => /already.*claimed|slot.*taken|already.*taken/i.test(msg),
    friendly: () => 'This slot is already taken. The opponent may have already joined.',
    code: 'SLOT_TAKEN',
  },
];

/**
 * Extract the most useful message from a Supabase error object.
 * Supabase RPC errors can be shaped differently depending on the source:
 * - { message: '...', details: '...', hint: '...' }
 * - { error: '...' }
 * - { code: '...', message: '...' }
 * - A plain string
 */
function extractRawMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  // Supabase RPC error format
  if (error.message) return error.message;
  if (error.error) return typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
  if (error.details) return error.details;
  if (error.description) return error.description;
  // Try to stringify
  try {
    const s = JSON.stringify(error);
    if (s && s !== '{}') return s;
  } catch {
    // ignore
  }
  return '';
}

/**
 * Parse a Supabase error into a user-friendly message.
 * Returns { friendly, code, raw } where:
 *   friendly — message suitable for displaying to the user
 *   code     — error category (for debugging/logging)
 *   raw      — original error text (for console)
 */
export function parseSupabaseError(error) {
  const raw = extractRawMessage(error);

  if (!raw) {
    return {
      friendly: 'An unexpected error occurred. Please try again.',
      code: 'UNKNOWN',
      raw: '',
    };
  }

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(raw)) {
      return {
        friendly: pattern.friendly(raw),
        code: pattern.code,
        raw,
      };
    }
  }

  // Fallback: show truncated raw error if it looks useful, otherwise generic
  const truncated = raw.length > 120 ? raw.slice(0, 120) + '…' : raw;
  const looksUseful = /error|fail|invalid|not found|forbidden|unauthorized|conflict/i.test(truncated);

  return {
    friendly: looksUseful
      ? `Server error: ${truncated}`
      : 'An unexpected error occurred. Please try again.',
    code: 'UNKNOWN',
    raw,
  };
}

/**
 * Log a Supabase error to console with context prefix.
 */
export function logSupabaseError(context, error) {
  const parsed = parseSupabaseError(error);
  console.warn(`[Supabase] ${context} — code=${parsed.code} raw="${parsed.raw}"`);
}
