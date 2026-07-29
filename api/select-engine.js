const { checkRateLimit } = require('./_lib/rateLimit');
const { validateEngineSelection, AVAILABLE_ENGINES } = require('./_lib/validation');
const { parseJsonBody } = require('./_lib/bodyParser');
const { setCorsHeaders } = require('./_lib/cors');
const { getClientIp } = require('./_lib/getClientIp');

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 20;

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
