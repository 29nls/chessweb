-- Create games table for permanent game history
-- Run this in your Supabase SQL editor (https://supabase.com/dashboard/project/_/sql/new)

CREATE TABLE IF NOT EXISTS games (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  player_id TEXT NOT NULL,       -- anonymous player ID from localStorage
  player_white TEXT NOT NULL DEFAULT 'White',
  player_black TEXT NOT NULL DEFAULT 'Black',
  result JSONB,                  -- { winner: 'white'|'black'|'draw', reason: string }
  pgn TEXT,                      -- full PGN with NAG annotations
  fen TEXT,                      -- final position FEN
  time_control_ms INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'analysis',  -- 'online' | 'analysis'
  game_code TEXT,                -- online game invite code (if applicable)
  moves JSONB,                   -- array of SAN move strings
  move_count INTEGER NOT NULL DEFAULT 0
);

-- Index for fast querying by player
CREATE INDEX IF NOT EXISTS idx_games_player_id ON games(player_id);

-- Index for sorting by date (most recent first)
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at DESC);

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Access policies are intentionally created by the subsequent
-- 20260805_secure_game_history_ownership.sql migration. Do not add public
-- policies here: rerunning this schema script must never reopen game history.
