-- Bind multiplayer slot ownership to Supabase Auth instead of a caller-supplied
-- localStorage player ID. Apply this migration before deploying the matching
-- client contract in useOnlineGame.js.
--
-- Anonymous Supabase users receive the authenticated database role and have a
-- stable auth.uid() for the lifetime of their anonymous session. Existing slot
-- rows retain their legacy player IDs, but their owner UUIDs remain NULL and
-- cannot be claimed or released by the new functions. This fails closed rather
-- than guessing ownership for rows created before this migration.

ALTER TABLE public.chess_game_slots
  ADD COLUMN IF NOT EXISTS white_owner_id UUID,
  ADD COLUMN IF NOT EXISTS black_owner_id UUID;

CREATE INDEX IF NOT EXISTS idx_chess_game_slots_white_owner_id
  ON public.chess_game_slots(white_owner_id);

CREATE INDEX IF NOT EXISTS idx_chess_game_slots_black_owner_id
  ON public.chess_game_slots(black_owner_id);

-- Remove the legacy overloads. They accepted a caller-supplied player identity
-- and were callable by anon, so leaving either overload available would preserve
-- the vulnerability.
DO $$
BEGIN
  IF to_regprocedure('public.claim_chess_game_slot(text,text,text,integer)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.claim_chess_game_slot(TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated';
    EXECUTE 'DROP FUNCTION public.claim_chess_game_slot(TEXT, TEXT, TEXT, INTEGER)';
  END IF;

  IF to_regprocedure('public.release_chess_game_slot(text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.release_chess_game_slot(TEXT, TEXT) FROM PUBLIC, anon, authenticated';
    EXECUTE 'DROP FUNCTION public.release_chess_game_slot(TEXT, TEXT)';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.claim_chess_game_slot(
  p_game_code TEXT,
  p_color TEXT,
  p_time_control_ms INTEGER DEFAULT 0
)
RETURNS TABLE(claimed BOOLEAN, time_control_ms INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner_id UUID := (select auth.uid());
  claimed_slot BOOLEAN := FALSE;
  updated_rows INTEGER := 0;
  existing_time_control INTEGER := 0;
BEGIN
  IF v_owner_id IS NULL
     OR p_color NOT IN ('white', 'black')
     OR p_game_code !~ '^[A-Z2-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid game slot request';
  END IF;

  -- Legacy rows cannot be mapped to auth.uid() safely. Expire their old
  -- localStorage ownership after the same 30-minute window used by the client
  -- reconnect state, so the migration does not strand slots forever.
  UPDATE public.chess_game_slots
     SET white_player_id = CASE
           WHEN white_owner_id IS NULL
            AND white_player_id IS NOT NULL
            AND updated_at < NOW() - INTERVAL '30 minutes'
             THEN NULL
           ELSE white_player_id
         END,
         black_player_id = CASE
           WHEN black_owner_id IS NULL
            AND black_player_id IS NOT NULL
            AND updated_at < NOW() - INTERVAL '30 minutes'
             THEN NULL
           ELSE black_player_id
         END,
         updated_at = NOW()
   WHERE game_code = p_game_code
     AND (
       (white_owner_id IS NULL
        AND white_player_id IS NOT NULL
        AND updated_at < NOW() - INTERVAL '30 minutes')
       OR
       (black_owner_id IS NULL
        AND black_player_id IS NOT NULL
        AND updated_at < NOW() - INTERVAL '30 minutes')
     );

  INSERT INTO public.chess_game_slots (game_code, white_owner_id, time_control_ms)
  SELECT p_game_code, v_owner_id, GREATEST(p_time_control_ms, 0)
  WHERE p_color = 'white'
  ON CONFLICT (game_code) DO NOTHING;

  IF p_color = 'white' THEN
    UPDATE public.chess_game_slots
       SET white_owner_id = v_owner_id,
           time_control_ms = GREATEST(p_time_control_ms, 0),
           updated_at = NOW()
     WHERE game_code = p_game_code
       AND (
         (white_owner_id IS NULL AND white_player_id IS NULL)
         OR white_owner_id = v_owner_id
       );
  ELSE
    UPDATE public.chess_game_slots
       SET           black_owner_id = v_owner_id,
           updated_at = NOW()
     WHERE game_code = p_game_code
       AND (white_owner_id IS NOT NULL OR white_player_id IS NOT NULL)
       AND (
         (black_owner_id IS NULL AND black_player_id IS NULL)
         OR black_owner_id = v_owner_id
       );
  END IF;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  claimed_slot := updated_rows > 0;

  SELECT s.time_control_ms
    INTO existing_time_control
    FROM public.chess_game_slots AS s
   WHERE s.game_code = p_game_code;

  RETURN QUERY SELECT claimed_slot, COALESCE(existing_time_control, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_chess_game_slot(p_game_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner_id UUID := (select auth.uid());
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Invalid game slot request';
  END IF;

  UPDATE public.chess_game_slots     SET white_owner_id = CASE WHEN white_owner_id = v_owner_id THEN NULL ELSE white_owner_id END,
         black_owner_id = CASE WHEN black_owner_id = v_owner_id THEN NULL ELSE black_owner_id END,
         white_player_id = CASE WHEN white_owner_id = v_owner_id THEN NULL ELSE white_player_id END,
         black_player_id = CASE WHEN black_owner_id = v_owner_id THEN NULL ELSE black_player_id END,
         updated_at = NOW()
   WHERE game_code = p_game_code
     AND (white_owner_id = v_owner_id OR black_owner_id = v_owner_id);
END;
$$;

-- Slot state is accessed only through the two functions below. Do not expose
-- direct table writes through the Data API.
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.chess_game_slots FROM PUBLIC, anon, authenticated;

-- New functions are private by default for the Data API and explicitly usable
-- only by authenticated Supabase sessions, including anonymous sessions.
REVOKE EXECUTE ON FUNCTION public.claim_chess_game_slot(TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.release_chess_game_slot(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_chess_game_slot(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_chess_game_slot(TEXT) TO authenticated;
