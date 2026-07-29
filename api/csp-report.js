const { parseJsonBody } = require('./_lib/bodyParser');
const { checkRateLimit } = require('./_lib/rateLimit');
const { getClientIp } = require('./_lib/getClientIp');

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REPORTS = 60; // generous limit — browsers batch reports

/**
 * CSP Violation Report Endpoint
 *
 * Browsers POST `application/csp-report` (or `application/json`) with a
 * `csp-report` body to `report-uri` whenever the Content-Security-Policy
 * blocks a resource. Vercel captures stdout/stderr in its logs, so we log
 * structured JSON that can be searched in the Vercel dashboard or
 * forwarded to an external monitoring service.
 *
 * Standard CSP report format:
 *   {
 *     "csp-report": {
 *       "document-uri": "https://chessweb.vercel.app/analysis",
 *       "violated-directive": "script-src 'self'",
 *       "blocked-uri": "https://evil.example.com/malicious.js",
 *       ...
 *     }
 *   }
 */
module.exports = async function handler(req, res) {
  // ── CORS: allow browsers to POST reports from any origin ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Rate limit per IP to prevent report-flooding abuse ──
  const clientIp = getClientIp(req);
  const key = `csp-report:${clientIp}`;
  const { allowed } = await checkRateLimit(key, WINDOW_MS, MAX_REPORTS);

  if (!allowed) {
    return res.status(429).json({ error: 'Too many reports' });
  }

  // ── Parse the CSP report body ──
  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const report = body?.['csp-report'] || body;

  if (!report) {
    return res.status(400).json({ error: 'Missing csp-report in body' });
  }

  // ── Log structured violation data ──
  // Vercel captures this in its logs; search for "[CSP Violation]"
  // Entries are structured JSON for easy parsing in log aggregators.
  console.warn('[CSP Violation]', JSON.stringify({
    timestamp: new Date().toISOString(),
    clientIp,
    documentUri: report['document-uri'] || 'unknown',
    referrer: report['referrer'] || '',
    violatedDirective: report['violated-directive'] || report['effective-directive'] || 'unknown',
    blockedUri: report['blocked-uri'] || 'unknown',
    originalPolicy: report['original-policy'] || '',
    statusCode: report['status-code'] ?? null,
    scriptSample: (report['script-sample'] || '').substring(0, 100),
    sourceFile: report['source-file'] || '',
    lineNumber: report['line-number'] ?? null,
    columnNumber: report['column-number'] ?? null,
  }));

  // ── Return 204 No Content (standard for CSP reports) ──
  return res.status(204).end();
};
