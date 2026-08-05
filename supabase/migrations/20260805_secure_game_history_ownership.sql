-- Secure saved-game ownership with Supabase Anonymous Auth.
-- Prerequisite: enable Anonymous sign-ins in Supabase Auth before deploying the
-- client that writes owner_id. Existing rows remain owner_id NULL and are
-- intentionally inaccessible under these policies.

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS owner_id UUID;

CREATE INDEX IF NOT EXISTS idx_games_owner_id
  ON games(owner_id);

-- Remove every legacy policy that permits anonymous public access. Policy names
-- are explicit because Supabase combines permissive policies with OR semantics.
DROP POLICY IF EXISTS "Anyone can insert games" ON games;
DROP POLICY IF EXISTS "Anyone can view games" ON games;
DROP POLICY IF EXISTS "Anyone can delete their own games" ON games;
DROP POLICY IF EXISTS "Authenticated owners can insert games" ON games;
DROP POLICY IF EXISTS "Authenticated owners can view games" ON games;
DROP POLICY IF EXISTS "Authenticated owners can delete games" ON games;

CREATE POLICY "Authenticated owners can insert games"
  ON games FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY "Authenticated owners can view games"
  ON games FOR SELECT
  TO authenticated
  USING (owner_id = (select auth.uid()));

CREATE POLICY "Authenticated owners can delete games"
  ON games FOR DELETE
  TO authenticated
  USING (owner_id = (select auth.uid()));

-- The old SECURITY DEFINER function trusts a caller-supplied localStorage ID.
-- Remove its public execution path so deletion is enforced by RLS instead.
DO $$
BEGIN
  IF to_regprocedure('public.delete_chess_game(bigint,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.delete_chess_game(BIGINT, TEXT) FROM anon, authenticated';
    EXECUTE 'DROP FUNCTION public.delete_chess_game(BIGINT, TEXT)';
  END IF;
END
$$;
