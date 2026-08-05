import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not configured. Online multiplayer and saved game history will not work.\n' +
    'Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// History auth is intentionally isolated from the multiplayer client. Calling
// signInAnonymously() changes the JWT on a Supabase client; keeping a separate
// storage key prevents history initialization from changing multiplayer auth,
// channels, or RPC behavior.
export const historySupabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey: 'chessweb-history-auth',
      },
    })
  : null;
