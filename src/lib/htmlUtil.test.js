import { containsHtmlTags } from './htmlUtil';

describe('containsHtmlTags', () => {
  test('returns true for a string with a script tag', () => {
    expect(containsHtmlTags('<script>alert(1)</script>')).toBe(true);
  });

  test('returns true for a string with an arbitrary HTML tag', () => {
    expect(containsHtmlTags('<img src=x onerror=alert(1)>'))
.toBe(true);
  });

  test('returns false for a string with only an unclosed less-than character', () => {
    expect(containsHtmlTags('1. e4 e5 <foo')).toBe(false);
  });

  test('returns false for a normal PGN string', () => {
    expect(containsHtmlTags('1. e4 e5 2. Nf3 Nc6')).toBe(false);
  });

  test('returns false for non-string inputs', () => {
    expect(containsHtmlTags(null)).toBe(false);
    expect(containsHtmlTags(undefined)).toBe(false);
    expect(containsHtmlTags(123)).toBe(false);
    expect(containsHtmlTags({})).toBe(false);
  });
});
