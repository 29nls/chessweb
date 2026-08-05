import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20260805_secure_game_history_ownership.sql'),
  'utf8'
);
const createMigration = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/create_games_table.sql'),
  'utf8'
);
const legacyDeleteMigration = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/delete_chess_game.sql'),
  'utf8'
);

test('secure history migration scopes access to auth.uid and removes legacy authorization', () => {
  expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS owner_id UUID/i);
  expect(migration).toMatch(/DROP POLICY IF EXISTS "Anyone can insert games" ON games/i);
  expect(migration).toMatch(/DROP POLICY IF EXISTS "Anyone can view games" ON games/i);
  expect(migration).toMatch(/CREATE POLICY "Authenticated owners can insert games"[\s\S]*TO authenticated[\s\S]*WITH CHECK \(owner_id = \(select auth\.uid\(\)\)\)/i);
  expect(migration).toMatch(/CREATE POLICY "Authenticated owners can view games"[\s\S]*TO authenticated[\s\S]*USING \(owner_id = \(select auth\.uid\(\)\)\)/i);
  expect(migration).toMatch(/CREATE POLICY "Authenticated owners can delete games"[\s\S]*TO authenticated[\s\S]*USING \(owner_id = \(select auth\.uid\(\)\)\)/i);
  expect(migration).toMatch(/DO \$\$[\s\S]*to_regprocedure\('public\.delete_chess_game\(bigint,text\)'\)[\s\S]*REVOKE EXECUTE[\s\S]*DROP FUNCTION/i);
  expect(migration).not.toMatch(/CREATE POLICY[\s\S]*TO anon[\s\S]*(?:USING|WITH CHECK) \(true\)/i);
  expect(migration).not.toMatch(/GRANT EXECUTE ON FUNCTION delete_chess_game/i);
});

test('base schema migration does not recreate permissive public policies', () => {
  expect(createMigration).not.toMatch(/CREATE POLICY[\s\S]*TO anon[\s\S]*(?:USING|WITH CHECK) \(true\)/i);
});

test('legacy delete migration is cleanup-only and cannot recreate the RPC', () => {
  expect(legacyDeleteMigration).not.toMatch(/CREATE(?: OR REPLACE)? FUNCTION\s+delete_chess_game/i);
  expect(legacyDeleteMigration).not.toMatch(/GRANT EXECUTE ON FUNCTION\s+delete_chess_game/i);
  expect(legacyDeleteMigration).toMatch(/DROP FUNCTION public\.delete_chess_game/i);
});
