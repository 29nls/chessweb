import { validateFen, validatePgn, clampEngineSettings, ENGINE_LIMITS } from './validation';

describe('validateFen', () => {
  test('accepts a valid starting position', () => {
    const result = validateFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });

  test('rejects empty string', () => {
    const result = validateFen('');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  test('rejects non-string values', () => {
    const result = validateFen(null);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/string/i);
  });

  test('rejects an invalid FEN', () => {
    const result = validateFen('not-a-fen');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid FEN/i);
  });

  test('trims whitespace around FEN', () => {
    const result = validateFen('  rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1  ');
    expect(result.valid).toBe(true);
  });
});

describe('validatePgn', () => {
  test('accepts a minimal valid PGN', () => {
    const result = validatePgn('1. e4 e5 2. Nf3 Nc6');
    expect(result.valid).toBe(true);
  });

  test('accepts a PGN with headers', () => {
    const result = validatePgn(`[Event "Test Game"]
[Site "Internet"]
[Date "2026.07.29"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 *`);
    expect(result.valid).toBe(true);
  });

  test('rejects empty string', () => {
    const result = validatePgn('');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  test('rejects non-string values', () => {
    const result = validatePgn(123);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/string/i);
  });

  test('rejects an invalid PGN', () => {
    const result = validatePgn('1. e4 Z9');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid PGN/i);
  });

  test('rejects a PGN containing HTML/script tags', () => {
    const result = validatePgn('[Event "<script>alert(1)</script>"]\n\n1. e4 e5 *');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/forbidden HTML/i);
  });

  test('rejects a PGN containing arbitrary HTML-like tags', () => {
    const result = validatePgn('[Event "<img src=x onerror=alert(1)>"]\n\n1. e4 e5 *');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/forbidden HTML/i);
  });
});

describe('clampEngineSettings', () => {
  test('clamps values within limits', () => {
    const result = clampEngineSettings({
      depth: 30,
      movetime: 3000,
      threads: 2,
      hashSize: 128,
      multiPv: 2,
    });
    expect(result.depth).toBe(30);
    expect(result.movetime).toBe(3000);
    expect(result.threads).toBe(2);
    expect(result.hashSize).toBe(128);
    expect(result.multiPv).toBe(2);
  });

  test('clamps values below minimum', () => {
    const result = clampEngineSettings({
      depth: 0,
      movetime: 0,
      threads: 0,
      hashSize: 0,
      multiPv: 0,
    });
    expect(result.depth).toBe(ENGINE_LIMITS.MIN_DEPTH);
    expect(result.movetime).toBe(ENGINE_LIMITS.MIN_MOVETIME);
    expect(result.threads).toBe(ENGINE_LIMITS.MIN_THREADS);
    expect(result.hashSize).toBe(ENGINE_LIMITS.MIN_HASH);
    expect(result.multiPv).toBe(ENGINE_LIMITS.MIN_MULTIPV);
  });

  test('clamps values above maximum', () => {
    const result = clampEngineSettings({
      depth: 100,
      movetime: 999999,
      threads: 64,
      hashSize: 999999,
      multiPv: 99,
    });
    expect(result.depth).toBe(ENGINE_LIMITS.MAX_DEPTH);
    expect(result.movetime).toBe(ENGINE_LIMITS.MAX_MOVETIME);
    expect(result.threads).toBe(ENGINE_LIMITS.MAX_THREADS);
    expect(result.hashSize).toBe(ENGINE_LIMITS.MAX_HASH);
    expect(result.multiPv).toBe(ENGINE_LIMITS.MAX_MULTIPV);
  });

  test('handles missing values with defaults', () => {
    const result = clampEngineSettings({});
    expect(result.depth).toBe(ENGINE_LIMITS.MIN_DEPTH);
    expect(result.movetime).toBe(ENGINE_LIMITS.MIN_MOVETIME);
    expect(result.threads).toBe(ENGINE_LIMITS.MIN_THREADS);
    expect(result.hashSize).toBe(ENGINE_LIMITS.MIN_HASH);
    expect(result.multiPv).toBe(ENGINE_LIMITS.MIN_MULTIPV);
  });

  test('handles NaN values by falling back to minimum', () => {
    const result = clampEngineSettings({
      depth: NaN,
      movetime: NaN,
      threads: NaN,
      hashSize: NaN,
      multiPv: NaN,
    });
    expect(result.depth).toBe(ENGINE_LIMITS.MIN_DEPTH);
    expect(result.movetime).toBe(ENGINE_LIMITS.MIN_MOVETIME);
    expect(result.threads).toBe(ENGINE_LIMITS.MIN_THREADS);
    expect(result.hashSize).toBe(ENGINE_LIMITS.MIN_HASH);
    expect(result.multiPv).toBe(ENGINE_LIMITS.MIN_MULTIPV);
  });
});
