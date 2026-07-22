-- Atomically reserve a player's colour slot before they join a Realtime channel.
-- Apply after create_games_table.sql in the Supabase SQL editor.
CREATE TABLE IF NOT EXISTS chess_game_slots (
  game_code TEXT PRIMARY KEY CHECK (game_code ~ '^[A-Z2-9]{6}$'),
  white_player_id TEXT,
  black_player_id TEXT,
  time_control_ms INTEGER NOT NULL DEFAULT 0 CHECK (time_control_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chess_game_slots ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION claim_chess_game_slot(
  p_game_code TEXT,
  p_player_id TEXT,
  p_color TEXT,
  p_time_control_ms INTEGER DEFAULT 0
)
RETURNS TABLE(claimed BOOLEAN, time_control_ms INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_slot BOOLEAN := FALSE;
  updated_rows INTEGER := 0;
  existing_time_control INTEGER := 0;
BEGIN
  IF p_color NOT IN ('white', 'black') OR p_game_code !~ '^[A-Z2-9]{6}$' OR p_player_id = '' THEN
    RAISE EXCEPTION 'Invalid game slot request';
  END IF;

  INSERT INTO chess_game_slots (game_code, white_player_id, time_control_ms)
  SELECT p_game_code, p_player_id, GREATEST(p_time_control_ms, 0)
  WHERE p_color = 'white'
  ON CONFLICT (game_code) DO NOTHING;

  IF p_color = 'white' THEN
    UPDATE chess_game_slots
       SET white_player_id = p_player_id, time_control_ms = GREATEST(p_time_control_ms, 0), updated_at = NOW()
     WHERE game_code = p_game_code AND (white_player_id IS NULL OR white_player_id = p_player_id);
  ELSE
    UPDATE chess_game_slots
       SET black_player_id = p_player_id, updated_at = NOW()
     WHERE game_code = p_game_code
       AND white_player_id IS NOT NULL
       AND (black_player_id IS NULL OR black_player_id = p_player_id);
  END IF;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  claimed_slot := updated_rows > 0;
  SELECT s.time_control_ms INTO existing_time_control
    FROM chess_game_slots s WHERE s.game_code = p_game_code;

  RETURN QUERY SELECT claimed_slot, COALESCE(existing_time_control, 0);
END;
$$;

CREATE OR REPLACE FUNCTION release_chess_game_slot(p_game_code TEXT, p_player_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE chess_game_slots
     SET white_player_id = CASE WHEN white_player_id = p_player_id THEN NULL ELSE white_player_id END,
         black_player_id = CASE WHEN black_player_id = p_player_id THEN NULL ELSE black_player_id END,
         updated_at = NOW()
   WHERE game_code = p_game_code;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_chess_game_slot(TEXT, TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION release_chess_game_slot(TEXT, TEXT) TO anon;
