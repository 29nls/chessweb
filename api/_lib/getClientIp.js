function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (!forwarded) return 'unknown';
  if (Array.isArray(forwarded)) return forwarded[0].trim();
  return String(forwarded).split(',')[0].trim();
}

module.exports = { getClientIp };
