-- SECURITY DEFINER function for deleting games.
-- Replaces the broad "Anyone can delete their own games" policy which had USING (true).
-- The caller must provide both p_game_id and p_player_id; the function verifies
-- ownership before deleting the row. Apply after create_games_table.sql.
CREATE OR REPLACE FUNCTION delete_chess_game(
  p_game_id BIGINT,
  p_player_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  DELETE FROM games
   WHERE id = p_game_id
     AND player_id = p_player_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

-- Revoke direct DELETE access from anon — only the RPC can delete now
DROP POLICY IF EXISTS "Anyone can delete their own games" ON games;

GRANT EXECUTE ON FUNCTION delete_chess_game(BIGINT, TEXT) TO anon;
