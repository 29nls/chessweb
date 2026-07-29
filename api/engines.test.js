const handler = require('./engines');
const { resetRateLimit } = require('./_lib/rateLimit');

beforeEach(() => {
  resetRateLimit();
});

function createMocks({ method = 'GET', headers = {} } = {}) {
  const req = { method, headers };
  const res = {
    statusCode: null,
    jsonData: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    end() {
      return this;
    },
  };
  return { req, res };
}

describe('/api/engines', () => {
  test('returns list of engines on GET', async () => {
    const { req, res } = createMocks();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual(['Stockfish 18', 'Stockfish 17', 'Lichess Cloud Engine']);
    expect(res.headers['X-RateLimit-Limit']).toBe('30');
    expect(Number(res.headers['X-RateLimit-Remaining'])).toBeGreaterThanOrEqual(0);
  });

  test('rejects non-GET methods', async () => {
    const { req, res } = createMocks({ method: 'POST' });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.jsonData).toEqual({ error: 'Method not allowed' });
  });

  test('handles OPTIONS preflight', async () => {
    const { req, res } = createMocks({ method: 'OPTIONS' });
    await handler(req, res);
    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  test('returns 429 after exceeding rate limit', async () => {
    const ip = '1.2.3.4';
    let lastRes;
    for (let i = 0; i < 35; i++) {
      const { req, res } = createMocks({ headers: { 'x-forwarded-for': ip } });
      await handler(req, res);
      lastRes = res;
    }
    expect(lastRes.statusCode).toBe(429);
    expect(lastRes.jsonData.error).toMatch(/Too many requests/i);
    expect(lastRes.headers['Retry-After']).toBeDefined();
  });

  test('uses first IP from x-forwarded-for list', async () => {
    const { req, res } = createMocks({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });
});
