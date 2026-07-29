const { checkRateLimit } = require('./_lib/rateLimit');
const { validateEngineSelection, AVAILABLE_ENGINES } = require('./_lib/validation');
const { parseJsonBody } = require('./_lib/bodyParser');
const { setCorsHeaders } = require('./_lib/cors');
const { getClientIp } = require('./_lib/getClientIp');

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10; // Stricter: engine selection is expensive / abuse-prone

// Require a shared secret for engine selection when deployed. This endpoint
// selects which engine runs on the backend, so it should not be open to the
// public even with rate limiting.
//
// IMPORTANT: if INTERNAL_API_KEY is set, every caller (including the SPA)
// must send the same value in the `X-Internal-API-Key` header. Leave this env
// var empty/unset if the frontend does not yet send that header, otherwise
// legitimate requests will be rejected with 401.
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

module.exports = async function handler(req, res) {
  setCorsHeaders(res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }

  const clientIp = getClientIp(req);
  const key = `select-engine:${clientIp}`;

  // Authentication: if an internal API key is configured, require it.
  if (INTERNAL_API_KEY) {
    const providedKey = req.headers['x-internal-api-key'];
    if (!providedKey || providedKey !== INTERNAL_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { allowed, remaining, resetAt } = await checkRateLimit(key, WINDOW_MS, MAX_REQUESTS);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(resetAt));

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many requests. Please slow down.',
      retryAfter,
    });
  }

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { engine } = body || {};
  const validation = validateEngineSelection(engine);

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  if (!AVAILABLE_ENGINES.includes(validation.value)) {
    return res.status(400).json({ error: 'Selected engine is not available' });
  }

  return res.status(200).json({
    message: `Engine selected: ${validation.value}`,
    engine: validation.value,
  });
};
