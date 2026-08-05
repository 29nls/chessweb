import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20260805_secure_chess_game_slot_ownership.sql'),
  'utf8'
);
const historicalMigration = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/claim_chess_game_slot.sql'),
  'utf8'
);
const onlineGame = fs.readFileSync(path.join(__dirname, '../hooks/useOnlineGame.js'), 'utf8');

describe('authenticated chess game slot ownership migration', () => {
  test('is a forward migration and leaves the historical migration unchanged', () => {
    expect(migration).toMatch(/ALTER TABLE public\.chess_game_slots[\s\S]*ADD COLUMN IF NOT EXISTS white_owner_id UUID/i);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS black_owner_id UUID/i);
    expect(migration).not.toBe(historicalMigration);
  });

  test('requires an authenticated auth.uid for claims and releases', () => {
    expect(migration).toMatch(/v_owner_id UUID := \(select auth\.uid\(\)\)/i);
    expect(migration).toMatch(/IF v_owner_id IS NULL[\s\S]*RAISE EXCEPTION 'Invalid game slot request'/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_chess_game_slot\(TEXT, TEXT, INTEGER\) TO authenticated/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.release_chess_game_slot\(TEXT\) TO authenticated/i);
    expect(migration).toMatch(/REVOKE EXECUTE ON FUNCTION public\.claim_chess_game_slot\(TEXT, TEXT, INTEGER\) FROM PUBLIC, anon/i);
    expect(migration).toMatch(/REVOKE EXECUTE ON FUNCTION public\.release_chess_game_slot\(TEXT\) FROM PUBLIC, anon/i);
  });

  test('removes the caller-controlled legacy function signatures', () => {
    expect(migration).toMatch(/DROP FUNCTION public\.claim_chess_game_slot\(TEXT, TEXT, TEXT, INTEGER\)/i);
    expect(migration).toMatch(/DROP FUNCTION public\.release_chess_game_slot\(TEXT, TEXT\)/i);
    expect(migration).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_chess_game_slot\(TEXT, TEXT, TEXT, INTEGER\)/i);
    expect(migration).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.release_chess_game_slot\(TEXT, TEXT\)/i);
  });

  test('allows a legitimate claim only for an empty slot owned by auth.uid', () => {
    expect(migration).toMatch(/white_owner_id = v_owner_id/i);
    expect(migration).toMatch(/black_owner_id = v_owner_id/i);
    expect(migration).toMatch(/white_owner_id IS NULL AND white_player_id IS NULL/i);
    expect(migration).toMatch(/black_owner_id IS NULL AND black_player_id IS NULL/i);
    expect(migration).toMatch(/updated_at < NOW\(\) - INTERVAL '30 minutes'[\s\S]*OR[\s\S]*updated_at < NOW\(\) - INTERVAL '30 minutes'/i);
  });

  test('prevents spoofed victim release and wrong-game release', () => {
    expect(migration).toMatch(/WHERE game_code = p_game_code[\s\S]*white_owner_id = v_owner_id OR black_owner_id = v_owner_id/i);
    expect(migration).not.toMatch(/\bp_player_id\s+(?:TEXT|VARCHAR)/i);
    expect(migration).toMatch(/REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public\.chess_game_slots FROM PUBLIC, anon, authenticated/i);
  });
});

describe('online game slot RPC contract', () => {
  test('initializes authenticated ownership before claim/release calls', () => {
    expect(onlineGame).toMatch(/import \{ supabase, historySupabase \} from ['"]\.\.\/supabaseClient['"]/);
    expect(onlineGame).toMatch(/import \{ getHistoryOwnerId \} from ['"]\.\.\/lib\/gameHistoryAuth['"]/);
    expect(onlineGame).toMatch(/const ownerId = await getHistoryOwnerId\(\)/);
    expect(onlineGame).toMatch(/return historySupabase\.rpc\(functionName, params\)/);
  });

  test('does not send the spoofable player ID to slot RPCs', () => {
    expect(onlineGame).toMatch(/callSlotRpc\('claim_chess_game_slot', \{[\s\S]*p_game_code: code[\s\S]*p_color: 'white'/);
    expect(onlineGame).toMatch(/callSlotRpc\('claim_chess_game_slot', \{[\s\S]*p_game_code: normalized[\s\S]*p_color: 'black'/);
    expect(onlineGame).toMatch(/callSlotRpc\('release_chess_game_slot', \{[\s\S]*p_game_code: gameCode/);
    expect(onlineGame).not.toMatch(/callSlotRpc\([\s\S]*p_player_id/);
  });
});
