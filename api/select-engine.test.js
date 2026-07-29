const { EventEmitter } = require('events');
const handler = require('./select-engine');
const { resetRateLimit } = require('./_lib/rateLimit');

beforeEach(() => {
  resetRateLimit();
});

function createReadableStream(body) {
  const stream = new EventEmitter();
  process.nextTick(() => {
    stream.emit('data', Buffer.from(JSON.stringify(body)));
    stream.emit('end');
  });
  return stream;
}

function createMocks({ method = 'POST', headers = {}, body = {} } = {}) {
  const stream = createReadableStream(body);
  const defaultHeaders = method === 'OPTIONS' ? {} : { 'content-type': 'application/json' };
  const mergedHeaders = { ...defaultHeaders, ...headers };
  const req = Object.create(stream);
  req.method = method;
  req.headers = mergedHeaders;
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

describe('/api/select-engine', () => {
  test('selects a valid engine', async () => {
    const { req, res } = createMocks({ body: { engine: 'Stockfish 18' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.jsonData).toEqual({
      message: 'Engine selected: Stockfish 18',
      engine: 'Stockfish 18',
    });
  });

  test('rejects missing engine name', async () => {
    const { req, res } = createMocks({ body: {} });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.jsonData.error).toMatch(/required/i);
  });

  test('rejects unknown engine', async () => {
    const { req, res } = createMocks({ body: { engine: 'Unknown Engine' } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.jsonData.error).toMatch(/not available/i);
  });

  test('rejects invalid characters in engine name', async () => {
    const { req, res } = createMocks({ body: { engine: 'Stockfish; rm -rf /' } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.jsonData.error).toMatch(/invalid characters/i);
  });

  test('rejects non-POST methods', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  test('handles OPTIONS preflight', async () => {
    const { req, res } = createMocks({ method: 'OPTIONS' });
    await handler(req, res);
    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  test('returns 429 after exceeding rate limit', async () => {
    const ip = '5.6.7.8';
    let lastRes;
    for (let i = 0; i < 25; i++) {
      const { req, res } = createMocks({
        headers: { 'x-forwarded-for': ip },
        body: { engine: 'Stockfish 18' },
      });
      await handler(req, res);
      lastRes = res;
    }
    expect(lastRes.statusCode).toBe(429);
    expect(lastRes.jsonData.error).toMatch(/Too many requests/i);
  });

  test('handles array-style x-forwarded-for header', async () => {
    const { req, res } = createMocks({
      headers: { 'x-forwarded-for': ['1.2.3.4', '5.6.7.8'] },
      body: { engine: 'Stockfish 18' },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('rejects non-JSON content type', async () => {
    const { req, res } = createMocks({
      headers: { 'content-type': 'text/plain' },
      body: { engine: 'Stockfish 18' },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(415);
  });

  test('rejects invalid JSON body', async () => {
    const stream = new EventEmitter();
    process.nextTick(() => {
      stream.emit('data', Buffer.from('not-json'));
      stream.emit('end');
    });
    const req = Object.create(stream);
    req.method = 'POST';
    req.headers = { 'content-type': 'application/json' };
    const res = {
      statusCode: null,
      jsonData: null,
      headers: {},
      setHeader(key, value) { this.headers[key] = value; return this; },
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; },
      end() { return this; },
    };
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.jsonData.error).toMatch(/Invalid JSON/i);
  });
});
