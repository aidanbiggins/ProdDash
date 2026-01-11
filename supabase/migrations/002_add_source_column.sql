-- Migration: Add source and current_stage_entered_at columns to candidates table
-- Run this in your Supabase SQL Editor

-- Add source column to track where candidates came from
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source TEXT;

-- Add current_stage_entered_at to track when candidate entered their current stage
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_stage_entered_at TIMESTAMPTZ;

-- Create index on source for faster source effectiveness queries
CREATE INDEX IF NOT EXISTS idx_candidates_source ON candidates(source);

-- Optional: Backfill source from raw_data if it was stored there
-- UPDATE candidates SET source = raw_data->>'source' WHERE source IS NULL AND raw_data->>'source' IS NOT NULL;
