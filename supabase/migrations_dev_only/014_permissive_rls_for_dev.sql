-- Migration 014: Permissive RLS policies for dev bypass compatibility
-- These policies allow all operations on data tables when using the dev auth bypass
-- (where auth.uid() is NULL). Data is still scoped by organization_id in the app layer.

-- =============================================================================
-- SUPER_ADMINS TABLE
-- =============================================================================
DROP POLICY IF EXISTS super_admins_select ON super_admins;
CREATE POLICY super_admins_select ON super_admins FOR SELECT USING (true);

-- Fix is_super_admin function to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = auth.uid()
  )
$$;

-- =============================================================================
-- USERS TABLE (Recruiter/HM metadata, not auth users)
-- =============================================================================
DROP POLICY IF EXISTS users_select ON users;
DROP POLICY IF EXISTS users_insert ON users;
DROP POLICY IF EXISTS users_update ON users;
DROP POLICY IF EXISTS users_delete ON users;
DROP POLICY IF EXISTS users_select_policy ON users;
DROP POLICY IF EXISTS users_insert_policy ON users;
DROP POLICY IF EXISTS users_update_policy ON users;
DROP POLICY IF EXISTS users_delete_policy ON users;
DROP POLICY IF EXISTS users_all ON users;

CREATE POLICY users_all ON users FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- REQUISITIONS TABLE
-- =============================================================================
DROP POLICY IF EXISTS requisitions_select ON requisitions;
DROP POLICY IF EXISTS requisitions_insert ON requisitions;
DROP POLICY IF EXISTS requisitions_update ON requisitions;
DROP POLICY IF EXISTS requisitions_delete ON requisitions;
DROP POLICY IF EXISTS requisitions_select_policy ON requisitions;
DROP POLICY IF EXISTS requisitions_insert_policy ON requisitions;
DROP POLICY IF EXISTS requisitions_update_policy ON requisitions;
DROP POLICY IF EXISTS requisitions_delete_policy ON requisitions;
DROP POLICY IF EXISTS requisitions_all ON requisitions;

CREATE POLICY requisitions_all ON requisitions FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- CANDIDATES TABLE
-- =============================================================================
DROP POLICY IF EXISTS candidates_select ON candidates;
DROP POLICY IF EXISTS candidates_insert ON candidates;
DROP POLICY IF EXISTS candidates_update ON candidates;
DROP POLICY IF EXISTS candidates_delete ON candidates;
DROP POLICY IF EXISTS candidates_select_policy ON candidates;
DROP POLICY IF EXISTS candidates_insert_policy ON candidates;
DROP POLICY IF EXISTS candidates_update_policy ON candidates;
DROP POLICY IF EXISTS candidates_delete_policy ON candidates;
DROP POLICY IF EXISTS candidates_all ON candidates;

CREATE POLICY candidates_all ON candidates FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- EVENTS TABLE
-- =============================================================================
DROP POLICY IF EXISTS events_select ON events;
DROP POLICY IF EXISTS events_insert ON events;
DROP POLICY IF EXISTS events_update ON events;
DROP POLICY IF EXISTS events_delete ON events;
DROP POLICY IF EXISTS events_select_policy ON events;
DROP POLICY IF EXISTS events_insert_policy ON events;
DROP POLICY IF EXISTS events_update_policy ON events;
DROP POLICY IF EXISTS events_delete_policy ON events;
DROP POLICY IF EXISTS events_all ON events;

CREATE POLICY events_all ON events FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- SNAPSHOT TABLES
-- =============================================================================
DROP POLICY IF EXISTS snapshots_insert_policy ON snapshots;
DROP POLICY IF EXISTS snapshots_update_policy ON snapshots;
DROP POLICY IF EXISTS snapshots_all ON snapshots;
CREATE POLICY snapshots_all ON snapshots FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS data_snapshots_insert_policy ON data_snapshots;
DROP POLICY IF EXISTS data_snapshots_update_policy ON data_snapshots;
DROP POLICY IF EXISTS data_snapshots_all ON data_snapshots;
CREATE POLICY data_snapshots_all ON data_snapshots FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS snapshot_candidates_insert_policy ON snapshot_candidates;
DROP POLICY IF EXISTS snapshot_candidates_update_policy ON snapshot_candidates;
DROP POLICY IF EXISTS snapshot_candidates_all ON snapshot_candidates;
CREATE POLICY snapshot_candidates_all ON snapshot_candidates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS snapshot_requisitions_insert_policy ON snapshot_requisitions;
DROP POLICY IF EXISTS snapshot_requisitions_update_policy ON snapshot_requisitions;
DROP POLICY IF EXISTS snapshot_requisitions_all ON snapshot_requisitions;
CREATE POLICY snapshot_requisitions_all ON snapshot_requisitions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS snapshot_events_insert_policy ON snapshot_events;
DROP POLICY IF EXISTS snapshot_events_update_policy ON snapshot_events;
DROP POLICY IF EXISTS snapshot_events_all ON snapshot_events;
CREATE POLICY snapshot_events_all ON snapshot_events FOR ALL USING (true) WITH CHECK (true);
