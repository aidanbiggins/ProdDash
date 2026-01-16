-- Snapshot Diff Event Stream Migration
-- Creates tables for storing dated snapshots and diff-generated events
-- See docs/plans/SNAPSHOT_DIFF_EVENT_STREAM_V1.md for full specification

-- ============================================
-- 1. DATA SNAPSHOTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS data_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Snapshot identification
  snapshot_date DATE NOT NULL,
  snapshot_seq INTEGER NOT NULL,

  -- Import metadata
  source_filename TEXT,
  source_hash TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by UUID REFERENCES auth.users(id),

  -- Record counts
  req_count INTEGER NOT NULL DEFAULT 0,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  user_count INTEGER NOT NULL DEFAULT 0,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'superseded')),
  diff_completed_at TIMESTAMPTZ,
  events_generated INTEGER DEFAULT 0,
  error_message TEXT,

  -- Constraints
  UNIQUE(organization_id, snapshot_seq),
  UNIQUE(organization_id, source_hash)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_org_date ON data_snapshots(organization_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_org_seq ON data_snapshots(organization_id, snapshot_seq DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_status ON data_snapshots(status) WHERE status IN ('pending', 'processing');

-- ============================================
-- 2. SNAPSHOT CANDIDATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS snapshot_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES data_snapshots(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Candidate identity (natural key)
  candidate_id TEXT NOT NULL,
  req_id TEXT NOT NULL,

  -- State at this snapshot
  current_stage TEXT NOT NULL,
  canonical_stage TEXT,
  disposition TEXT,

  -- Timestamps from CSV
  applied_at TIMESTAMPTZ,
  current_stage_entered_at TIMESTAMPTZ,
  hired_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  offer_extended_at TIMESTAMPTZ,

  -- Source tracing
  source_row_number INTEGER,
  raw_data JSONB,

  UNIQUE(snapshot_id, candidate_id, req_id)
);

-- Indexes for diff queries
CREATE INDEX IF NOT EXISTS idx_snap_cand_snapshot ON snapshot_candidates(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snap_cand_candidate ON snapshot_candidates(candidate_id, req_id);
CREATE INDEX IF NOT EXISTS idx_snap_cand_org ON snapshot_candidates(organization_id);

-- ============================================
-- 3. SNAPSHOT REQUISITIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS snapshot_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES data_snapshots(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Req identity
  req_id TEXT NOT NULL,

  -- State at this snapshot
  status TEXT,
  recruiter_id TEXT,
  hiring_manager_id TEXT,

  -- Timestamps
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- Source tracing
  source_row_number INTEGER,
  raw_data JSONB,

  UNIQUE(snapshot_id, req_id)
);

CREATE INDEX IF NOT EXISTS idx_snap_req_snapshot ON snapshot_requisitions(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snap_req_req ON snapshot_requisitions(req_id);

-- ============================================
-- 4. SNAPSHOT EVENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS snapshot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Event identity
  event_type TEXT NOT NULL CHECK (event_type IN (
    'STAGE_CHANGE',
    'STAGE_REGRESSION',
    'DISPOSITION_CHANGE',
    'REQ_STATUS_CHANGE',
    'CANDIDATE_APPEARED',
    'CANDIDATE_DISAPPEARED',
    'REQ_APPEARED',
    'REQ_DISAPPEARED'
  )),

  -- Entity references
  candidate_id TEXT,
  req_id TEXT,

  -- State change details
  from_value TEXT,
  to_value TEXT,
  from_canonical TEXT,
  to_canonical TEXT,

  -- Temporal data
  event_at TIMESTAMPTZ NOT NULL,

  -- Provenance
  from_snapshot_id UUID REFERENCES data_snapshots(id),
  to_snapshot_id UUID NOT NULL REFERENCES data_snapshots(id),
  from_snapshot_date DATE,
  to_snapshot_date DATE NOT NULL,

  -- Confidence scoring
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low', 'inferred')),
  confidence_reasons TEXT[],

  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for query patterns
CREATE INDEX IF NOT EXISTS idx_snap_events_org ON snapshot_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_snap_events_candidate ON snapshot_events(candidate_id, req_id);
CREATE INDEX IF NOT EXISTS idx_snap_events_req ON snapshot_events(req_id);
CREATE INDEX IF NOT EXISTS idx_snap_events_type ON snapshot_events(event_type);
CREATE INDEX IF NOT EXISTS idx_snap_events_time ON snapshot_events(organization_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_snap_events_to_snap ON snapshot_events(to_snapshot_id);

-- ============================================
-- 5. ROW-LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE data_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_events ENABLE ROW LEVEL SECURITY;

-- Grant table access
GRANT SELECT, INSERT, UPDATE, DELETE ON data_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON snapshot_candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON snapshot_requisitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON snapshot_events TO authenticated;

-- data_snapshots policies
DROP POLICY IF EXISTS "snapshots_select" ON data_snapshots;
CREATE POLICY "snapshots_select" ON data_snapshots
  FOR SELECT USING (is_super_admin() OR organization_id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS "snapshots_insert" ON data_snapshots;
CREATE POLICY "snapshots_insert" ON data_snapshots
  FOR INSERT WITH CHECK (is_super_admin() OR is_org_admin(organization_id));

DROP POLICY IF EXISTS "snapshots_update" ON data_snapshots;
CREATE POLICY "snapshots_update" ON data_snapshots
  FOR UPDATE USING (is_super_admin() OR is_org_admin(organization_id));

DROP POLICY IF EXISTS "snapshots_delete" ON data_snapshots;
CREATE POLICY "snapshots_delete" ON data_snapshots
  FOR DELETE USING (is_super_admin() OR is_org_admin(organization_id));

-- snapshot_candidates policies
DROP POLICY IF EXISTS "snap_cand_select" ON snapshot_candidates;
CREATE POLICY "snap_cand_select" ON snapshot_candidates
  FOR SELECT USING (is_super_admin() OR organization_id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS "snap_cand_insert" ON snapshot_candidates;
CREATE POLICY "snap_cand_insert" ON snapshot_candidates
  FOR INSERT WITH CHECK (is_super_admin() OR is_org_admin(organization_id));

DROP POLICY IF EXISTS "snap_cand_update" ON snapshot_candidates;
CREATE POLICY "snap_cand_update" ON snapshot_candidates
  FOR UPDATE USING (is_super_admin() OR is_org_admin(organization_id));

DROP POLICY IF EXISTS "snap_cand_delete" ON snapshot_candidates;
CREATE POLICY "snap_cand_delete" ON snapshot_candidates
  FOR DELETE USING (is_super_admin() OR is_org_admin(organization_id));

-- snapshot_requisitions policies
DROP POLICY IF EXISTS "snap_req_select" ON snapshot_requisitions;
CREATE POLICY "snap_req_select" ON snapshot_requisitions
  FOR SELECT USING (is_super_admin() OR organization_id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS "snap_req_insert" ON snapshot_requisitions;
CREATE POLICY "snap_req_insert" ON snapshot_requisitions
  FOR INSERT WITH CHECK (is_super_admin() OR is_org_admin(organization_id));

DROP POLICY IF EXISTS "snap_req_update" ON snapshot_requisitions;
CREATE POLICY "snap_req_update" ON snapshot_requisitions
  FOR UPDATE USING (is_super_admin() OR is_org_admin(organization_id));

DROP POLICY IF EXISTS "snap_req_delete" ON snapshot_requisitions;
CREATE POLICY "snap_req_delete" ON snapshot_requisitions
  FOR DELETE USING (is_super_admin() OR is_org_admin(organization_id));

-- snapshot_events policies
DROP POLICY IF EXISTS "snap_events_select" ON snapshot_events;
CREATE POLICY "snap_events_select" ON snapshot_events
  FOR SELECT USING (is_super_admin() OR organization_id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS "snap_events_insert" ON snapshot_events;
CREATE POLICY "snap_events_insert" ON snapshot_events
  FOR INSERT WITH CHECK (is_super_admin() OR is_org_admin(organization_id));

DROP POLICY IF EXISTS "snap_events_update" ON snapshot_events;
CREATE POLICY "snap_events_update" ON snapshot_events
  FOR UPDATE USING (is_super_admin() OR is_org_admin(organization_id));

DROP POLICY IF EXISTS "snap_events_delete" ON snapshot_events;
CREATE POLICY "snap_events_delete" ON snapshot_events
  FOR DELETE USING (is_super_admin() OR is_org_admin(organization_id));
