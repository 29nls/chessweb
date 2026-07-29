const { checkRateLimit } = require('./_lib/rateLimit');
const { AVAILABLE_ENGINES } = require('./_lib/validation');
const { setCorsHeaders } = require('./_lib/cors');
const { getClientIp } = require('./_lib/getClientIp');

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30;

module.exports = async function handler(req, res) {
  setCorsHeaders(res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = getClientIp(req);
  const key = `engines:${clientIp}`;
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

  return res.status(200).json(AVAILABLE_ENGINES);
};
