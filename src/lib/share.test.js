import { decodeGameFromParams, encodeGameToQuery, generateShareUrl } from './share';

describe('decodeGameFromParams', () => {
  test('returns pgn and result for valid params', () => {
    const params = new URLSearchParams('pgn=1.%20e4%20e5&result=' + encodeURIComponent(JSON.stringify({ winner: 'white', reason: 'Checkmate' })));
    const { pgn, result } = decodeGameFromParams(params);
    expect(pgn).toBe('1. e4 e5');
    expect(result).toEqual({ winner: 'white', reason: 'Checkmate' });
  });

  test('returns null result when result param is missing', () => {
    const params = new URLSearchParams('pgn=1.%20e4%20e5');
    const { pgn, result } = decodeGameFromParams(params);
    expect(pgn).toBe('1. e4 e5');
    expect(result).toBeNull();
  });

  test('rejects pgn containing HTML/script tags', () => {
    const params = new URLSearchParams('pgn=' + encodeURIComponent('[Event "<script>alert(1)</script>"]\n\n1. e4 e5'));
    const { pgn, result } = decodeGameFromParams(params);
    expect(pgn).toBeNull();
    expect(result).toBeNull();
  });

  test('returns null result for invalid JSON', () => {
    const params = new URLSearchParams('pgn=1.%20e4%20e5&result=not-json');
    const { result } = decodeGameFromParams(params);
    expect(result).toBeNull();
  });

  test('rejects result with disallowed winner value', () => {
    const params = new URLSearchParams('result=' + encodeURIComponent(JSON.stringify({ winner: 'hacker', reason: 'x' })));
    const { result } = decodeGameFromParams(params);
    expect(result).toBeNull();
  });

  test('rejects result containing HTML/script tags in reason', () => {
    const params = new URLSearchParams('result=' + encodeURIComponent(JSON.stringify({ winner: 'white', reason: '<script>alert(1)</script>' })));
    const { result } = decodeGameFromParams(params);
    expect(result).toBeNull();
  });

  test('rejects non-object result', () => {
    const params = new URLSearchParams('result=' + encodeURIComponent(JSON.stringify(['white'])));
    const { result } = decodeGameFromParams(params);
    expect(result).toBeNull();
  });

  test('normalizes null/undefined reason to empty string', () => {
    const params = new URLSearchParams('result=' + encodeURIComponent(JSON.stringify({ winner: 'draw' })));
    const { result } = decodeGameFromParams(params);
    expect(result).toEqual({ winner: 'draw', reason: '' });
  });
});

describe('encodeGameToQuery', () => {
  test('encodes pgn and result safely', () => {
    const query = encodeGameToQuery('1. e4 e5', { winner: 'white', reason: 'Checkmate' });
    expect(query).toContain('pgn=');
    expect(query).toContain('result=');
    expect(query).not.toContain('<script>');
  });

  test('omits result when there is no winner', () => {
    const query = encodeGameToQuery('1. e4 e5', null);
    expect(query).toContain('pgn=');
    expect(query).not.toContain('result=');
  });
});

describe('generateShareUrl', () => {
  test('generates a URL with encoded params', () => {
    const url = generateShareUrl('1. e4 e5', { winner: 'white', reason: 'Checkmate' }, 'https://chessweb.example');
    expect(url).toMatch(/^https:\/\/chessweb.example\/analysis\?/);
    expect(url).toContain('pgn=');
    expect(url).toContain('result=');
  });

  test('defaults to window.location.origin when origin is not provided', () => {
    const url = generateShareUrl('1. e4 e5', { winner: 'white', reason: 'Checkmate' });
    expect(url).toMatch(new RegExp(`^${window.location.origin}/analysis\\?`));
    expect(url).toContain('pgn=');
    expect(url).toContain('result=');
  });
});
