-- Deprecated legacy migration.
-- Game-history deletion is now enforced by the owner_id/auth.uid() RLS policy in
-- 20260805_secure_game_history_ownership.sql. Keep this cleanup file safe to
-- apply on installations that may have the old function, without recreating it.

DO $$
BEGIN
  IF to_regprocedure('public.delete_chess_game(bigint,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.delete_chess_game(BIGINT, TEXT) FROM PUBLIC, anon, authenticated';
    EXECUTE 'DROP FUNCTION public.delete_chess_game(BIGINT, TEXT)';
  END IF;
END
$$;
