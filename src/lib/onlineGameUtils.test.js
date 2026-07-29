import {
  generateCode,
  getPlayerId,
  saveGameState,
  clearGameState,
  getSavedGameState,
  TIME_CONTROL_PRESETS,
} from './onlineGameUtils';

// ── Helpers ───────────────────────────────────────────

/** Mock localStorage to throw on every access (simulates private browsing / storage full). */
function disableLocalStorage() {
  const original = window.localStorage;
  const thrower = () => { throw new Error('Storage unavailable'); };
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: thrower,
      setItem: thrower,
      removeItem: thrower,
      clear: thrower,
      key: thrower,
      get length() { throw new Error('Storage unavailable'); },
    },
    writable: true,
    configurable: true,
  });
  return () => {
    Object.defineProperty(window, 'localStorage', { value: original, writable: true, configurable: true });
  };
}

/** Freeze Date.now so we can test TTL deterministically. Returns a restore function. */
function freezeTime(ms) {
  const realNow = Date.now.bind(Date);
  Date.now = jest.fn(() => ms);
  return () => { Date.now = realNow; };
}

// ── Tests ─────────────────────────────────────────────

describe('generateCode', () => {
  test('returns a 6-character uppercase string', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode();
      expect(typeof code).toBe('string');
      expect(code).toHaveLength(6);
      expect(code).toBe(code.toUpperCase());
    }
  });

  test('only contains allowed characters (no confusing 0/O/1/I)', () => {
    const allowed = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      for (const ch of code) {
        expect(allowed).toContain(ch);
      }
    }
  });

  test('never includes 0, O, 1, or I', () => {
    const forbidden = ['0', 'O', '1', 'I'];
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      for (const ch of code) {
        expect(forbidden).not.toContain(ch);
      }
    }
  });

  test('generates unique codes across many calls (probabilistic)', () => {
    const codes = new Set();
    for (let i = 0; i < 500; i++) {
      codes.add(generateCode());
    }
    // With 30 chars ^ 6 = 729M possibilities, 500 calls should have zero collisions
    expect(codes.size).toBe(500);
  });

  test('returns a string every time (no exceptions)', () => {
    for (let i = 0; i < 100; i++) {
      expect(() => generateCode()).not.toThrow();
      expect(typeof generateCode()).toBe('string');
    }
  });
});

describe('getPlayerId', () => {
  beforeEach(() => {
    localStorage.removeItem('chessweb_player_id');
  });

  test('creates a new player ID when none exists', () => {
    const id = getPlayerId();
    expect(id).toMatch(/^player_[a-z0-9]+$/);
  });

  test('persists the ID in localStorage', () => {
    const id = getPlayerId();
    expect(localStorage.getItem('chessweb_player_id')).toBe(id);
  });

  test('returns the same ID on subsequent calls', () => {
    const id1 = getPlayerId();
    const id2 = getPlayerId();
    const id3 = getPlayerId();
    expect(id1).toBe(id2);
    expect(id2).toBe(id3);
  });

  test('reads from localStorage across simulated sessions', () => {
    const id1 = getPlayerId();
    // Simulate a later session: the ID should be read from localStorage
    const id2 = getPlayerId();
    expect(id1).toBe(id2);
  });

  test('handles localStorage unavailability gracefully', () => {
    const restore = disableLocalStorage();
    const id = getPlayerId();
    restore();

    expect(id).toMatch(/^player_[a-z0-9]+$/);
    expect(id.length).toBeGreaterThan('player_'.length);
  });

  test('returns a different fallback ID each time when localStorage is down', () => {
    const restore = disableLocalStorage();
    const id1 = getPlayerId();
    const id2 = getPlayerId();
    restore();

    // Without persistence, each call generates a fresh random ID
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^player_[a-z0-9]+$/);
    expect(id2).toMatch(/^player_[a-z0-9]+$/);
  });

  test('does not throw when localStorage.getItem throws mid-read', () => {
    const realGetItem = localStorage.getItem.bind(localStorage);
    localStorage.getItem = () => { throw new Error('quota exceeded'); };

    const id = getPlayerId();
    localStorage.getItem = realGetItem;

    expect(id).toMatch(/^player_[a-z0-9]+$/);
  });
});

describe('saveGameState', () => {
  beforeEach(() => {
    localStorage.removeItem('chessweb_active_game');
  });

  test('stores the game state as JSON with the correct shape', () => {
    saveGameState('ABC123', 'white', 'playing');
    const raw = localStorage.getItem('chessweb_active_game');
    const parsed = JSON.parse(raw);

    expect(parsed.code).toBe('ABC123');
    expect(parsed.color).toBe('white');
    expect(parsed.status).toBe('playing');
    expect(typeof parsed.timestamp).toBe('number');
  });

  test('records a timestamp close to now', () => {
    const before = Date.now();
    saveGameState('XYZ789', 'black', 'waiting');
    const after = Date.now();
    const parsed = JSON.parse(localStorage.getItem('chessweb_active_game'));

    expect(parsed.timestamp).toBeGreaterThanOrEqual(before);
    expect(parsed.timestamp).toBeLessThanOrEqual(after);
  });

  test('overwrites any previous saved state', () => {
    saveGameState('FIRST', 'white', 'waiting');
    saveGameState('SECOND', 'black', 'playing');
    const parsed = JSON.parse(localStorage.getItem('chessweb_active_game'));

    expect(parsed.code).toBe('SECOND');
    expect(parsed.color).toBe('black');
    expect(parsed.status).toBe('playing');
  });

  test('handles localStorage unavailability without throwing', () => {
    const restore = disableLocalStorage();
    expect(() => saveGameState('TEST', 'white', 'waiting')).not.toThrow();
    restore();
  });

  test('accepts spectator color', () => {
    saveGameState('SPEC01', 'spectator', 'playing');
    const parsed = JSON.parse(localStorage.getItem('chessweb_active_game'));
    expect(parsed.color).toBe('spectator');
  });

  test('accepts finished status', () => {
    saveGameState('DONE42', 'white', 'finished');
    const parsed = JSON.parse(localStorage.getItem('chessweb_active_game'));
    expect(parsed.status).toBe('finished');
  });
});

describe('clearGameState', () => {
  beforeEach(() => {
    localStorage.removeItem('chessweb_active_game');
  });

  test('removes the active game key from localStorage', () => {
    saveGameState('TEST', 'white', 'playing');
    expect(localStorage.getItem('chessweb_active_game')).not.toBeNull();

    clearGameState();
    expect(localStorage.getItem('chessweb_active_game')).toBeNull();
  });

  test('is idempotent — calling with nothing saved does not throw', () => {
    expect(() => clearGameState()).not.toThrow();
    expect(() => clearGameState()).not.toThrow();
  });

  test('handles localStorage unavailability without throwing', () => {
    saveGameState('TEST', 'white', 'playing');

    const restore = disableLocalStorage();
    expect(() => clearGameState()).not.toThrow();
    restore();

    // State should still be there since the remove failed silently
    expect(localStorage.getItem('chessweb_active_game')).not.toBeNull();
  });

  test('only removes its own key, not other localStorage data', () => {
    localStorage.setItem('other_key', 'keep-me');
    saveGameState('TEST', 'white', 'playing');

    clearGameState();

    expect(localStorage.getItem('chessweb_active_game')).toBeNull();
    expect(localStorage.getItem('other_key')).toBe('keep-me');
  });
});

describe('getSavedGameState', () => {
  beforeEach(() => {
    localStorage.removeItem('chessweb_active_game');
  });

  test('returns null when no state is saved', () => {
    expect(getSavedGameState()).toBeNull();
  });

  test('returns the parsed state when valid', () => {
    saveGameState('CODE42', 'black', 'playing');
    const state = getSavedGameState();

    expect(state).not.toBeNull();
    expect(state.code).toBe('CODE42');
    expect(state.color).toBe('black');
    expect(state.status).toBe('playing');
    expect(typeof state.timestamp).toBe('number');
  });

  test('returns null when JSON is corrupt', () => {
    localStorage.setItem('chessweb_active_game', 'not-valid-json{{{');
    expect(getSavedGameState()).toBeNull();
  });

  test('does not throw when stored JSON is not an object', () => {
    localStorage.setItem('chessweb_active_game', '"just a string"');
    // Implementation returns the parsed value (a string), not null —
    // but it must not throw.
    const state = getSavedGameState();
    expect(() => getSavedGameState()).not.toThrow();
    expect(state).toBe('just a string');
  });

  test('does not throw when JSON.parse returns null', () => {
    localStorage.setItem('chessweb_active_game', 'null');
    const state = getSavedGameState();
    expect(state).toBeNull();
  });

  // ── TTL Expiry ────────────────────────────────────

  test('returns state when within TTL (29 minutes)', () => {
    const now = 1700000000000;
    const restore = freezeTime(now);

    saveGameState('TTL1', 'white', 'playing');
    // Advance 29 minutes
    restore();
    const restore2 = freezeTime(now + 29 * 60 * 1000);

    const state = getSavedGameState();
    restore2();

    expect(state).not.toBeNull();
    expect(state.code).toBe('TTL1');
  });

  test('returns null and clears state when TTL is exceeded (31 minutes)', () => {
    const now = 1700000000000;
    const restore = freezeTime(now);

    saveGameState('TTL2', 'white', 'playing');
    restore();

    const restore2 = freezeTime(now + 31 * 60 * 1000);

    const state = getSavedGameState();
    restore2();

    expect(state).toBeNull();
    // Should also clear the expired data from localStorage
    expect(localStorage.getItem('chessweb_active_game')).toBeNull();
  });

  test('state is still valid exactly at 30 minutes (strict > boundary)', () => {
    const now = 1700000000000;
    const restore = freezeTime(now);

    saveGameState('TTL3', 'black', 'finished');
    restore();

    // 30 * 60 * 1000 = 1,800,000 ms
    const restore2 = freezeTime(now + 30 * 60 * 1000);

    const state = getSavedGameState();
    restore2();

    // The check is `Date.now() - state.timestamp > 30 * 60 * 1000`
    // which is strictly greater than, so exactly at 30min it should still be valid.
    expect(state).not.toBeNull();
    expect(state.code).toBe('TTL3');
  });

  test('returns null at 30 minutes + 1 ms (exceeds boundary)', () => {
    const now = 1700000000000;
    const restore = freezeTime(now);

    saveGameState('TTL4', 'black', 'finished');
    restore();

    const restore2 = freezeTime(now + 30 * 60 * 1000 + 1);

    const state = getSavedGameState();
    restore2();

    expect(state).toBeNull();
  });

  test('handles localStorage unavailability gracefully', () => {
    saveGameState('TEST', 'white', 'playing');

    const restore = disableLocalStorage();
    const state = getSavedGameState();
    restore();

    expect(state).toBeNull();
  });

  test('handles corrupted timestamp (NaN)', () => {
    localStorage.setItem('chessweb_active_game', JSON.stringify({
      code: 'NAN', color: 'white', status: 'playing', timestamp: 'not-a-number',
    }));
    // Date.now() - NaN = NaN, and NaN > anything is false,
    // so it should not trigger the TTL expiry and just return the state.
    const state = getSavedGameState();
    expect(state).not.toBeNull();
    expect(state.code).toBe('NAN');
  });
});

describe('TIME_CONTROL_PRESETS', () => {
  test('is an array with the expected entries', () => {
    expect(Array.isArray(TIME_CONTROL_PRESETS)).toBe(true);
    expect(TIME_CONTROL_PRESETS).toHaveLength(6);
  });

  test('each entry has label and initialMs', () => {
    for (const preset of TIME_CONTROL_PRESETS) {
      expect(preset).toHaveProperty('label');
      expect(preset).toHaveProperty('initialMs');
      expect(typeof preset.label).toBe('string');
      expect(typeof preset.initialMs).toBe('number');
    }
  });

  test('minutes values are correctly converted to ms', () => {
    expect(TIME_CONTROL_PRESETS[0]).toEqual({ label: '1 min', initialMs: 1 * 60 * 1000 });
    expect(TIME_CONTROL_PRESETS[1]).toEqual({ label: '3 min', initialMs: 3 * 60 * 1000 });
    expect(TIME_CONTROL_PRESETS[2]).toEqual({ label: '5 min', initialMs: 5 * 60 * 1000 });
    expect(TIME_CONTROL_PRESETS[3]).toEqual({ label: '10 min', initialMs: 10 * 60 * 1000 });
    expect(TIME_CONTROL_PRESETS[4]).toEqual({ label: '30 min', initialMs: 30 * 60 * 1000 });
  });

  test('last entry is Untimed with 0 ms', () => {
    const untimed = TIME_CONTROL_PRESETS[TIME_CONTROL_PRESETS.length - 1];
    expect(untimed).toEqual({ label: 'Untimed', initialMs: 0 });
  });
});
