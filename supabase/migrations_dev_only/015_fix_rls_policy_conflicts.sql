-- Migration 015: Fix RLS policy conflicts
-- Previous migrations created policies with different naming conventions.
-- This migration drops ALL known policy variants and creates clean permissive policies.

-- =============================================================================
-- SUPER_ADMINS TABLE
-- =============================================================================
DROP POLICY IF EXISTS super_admins_select ON super_admins;
DROP POLICY IF EXISTS super_read ON super_admins;
DROP POLICY IF EXISTS super_write ON super_admins;
DROP POLICY IF EXISTS super_modify ON super_admins;
DROP POLICY IF EXISTS super_remove ON super_admins;
DROP POLICY IF EXISTS super_admins_all ON super_admins;

CREATE POLICY super_admins_permissive ON super_admins FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- USERS TABLE
-- =============================================================================
DROP POLICY IF EXISTS users_select ON users;
DROP POLICY IF EXISTS users_insert ON users;
DROP POLICY IF EXISTS users_update ON users;
DROP POLICY IF EXISTS users_delete ON users;
DROP POLICY IF EXISTS users_all ON users;
DROP POLICY IF EXISTS users_read ON users;
DROP POLICY IF EXISTS users_write ON users;
DROP POLICY IF EXISTS users_modify ON users;
DROP POLICY IF EXISTS users_remove ON users;

CREATE POLICY users_permissive ON users FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- REQUISITIONS TABLE
-- =============================================================================
DROP POLICY IF EXISTS requisitions_select ON requisitions;
DROP POLICY IF EXISTS requisitions_insert ON requisitions;
DROP POLICY IF EXISTS requisitions_update ON requisitions;
DROP POLICY IF EXISTS requisitions_delete ON requisitions;
DROP POLICY IF EXISTS requisitions_all ON requisitions;
DROP POLICY IF EXISTS reqs_read ON requisitions;
DROP POLICY IF EXISTS reqs_write ON requisitions;
DROP POLICY IF EXISTS reqs_modify ON requisitions;
DROP POLICY IF EXISTS reqs_remove ON requisitions;

CREATE POLICY requisitions_permissive ON requisitions FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- CANDIDATES TABLE
-- =============================================================================
DROP POLICY IF EXISTS candidates_select ON candidates;
DROP POLICY IF EXISTS candidates_insert ON candidates;
DROP POLICY IF EXISTS candidates_update ON candidates;
DROP POLICY IF EXISTS candidates_delete ON candidates;
DROP POLICY IF EXISTS candidates_all ON candidates;
DROP POLICY IF EXISTS cands_read ON candidates;
DROP POLICY IF EXISTS cands_write ON candidates;
DROP POLICY IF EXISTS cands_modify ON candidates;
DROP POLICY IF EXISTS cands_remove ON candidates;

CREATE POLICY candidates_permissive ON candidates FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- EVENTS TABLE
-- =============================================================================
DROP POLICY IF EXISTS events_select ON events;
DROP POLICY IF EXISTS events_insert ON events;
DROP POLICY IF EXISTS events_update ON events;
DROP POLICY IF EXISTS events_delete ON events;
DROP POLICY IF EXISTS events_all ON events;
DROP POLICY IF EXISTS events_read ON events;
DROP POLICY IF EXISTS events_write ON events;
DROP POLICY IF EXISTS events_modify ON events;
DROP POLICY IF EXISTS events_remove ON events;

CREATE POLICY events_permissive ON events FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- ORGANIZATION_MEMBERS TABLE
-- =============================================================================
DROP POLICY IF EXISTS org_members_read ON organization_members;
DROP POLICY IF EXISTS org_members_write ON organization_members;
DROP POLICY IF EXISTS org_members_modify ON organization_members;
DROP POLICY IF EXISTS org_members_remove ON organization_members;
DROP POLICY IF EXISTS organization_members_select ON organization_members;
DROP POLICY IF EXISTS organization_members_insert ON organization_members;
DROP POLICY IF EXISTS organization_members_update ON organization_members;
DROP POLICY IF EXISTS organization_members_delete ON organization_members;
DROP POLICY IF EXISTS organization_members_all ON organization_members;

CREATE POLICY organization_members_permissive ON organization_members FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- ORGANIZATIONS TABLE
-- =============================================================================
DROP POLICY IF EXISTS org_read ON organizations;
DROP POLICY IF EXISTS org_write ON organizations;
DROP POLICY IF EXISTS org_modify ON organizations;
DROP POLICY IF EXISTS org_remove ON organizations;
DROP POLICY IF EXISTS organizations_select ON organizations;
DROP POLICY IF EXISTS organizations_insert ON organizations;
DROP POLICY IF EXISTS organizations_update ON organizations;
DROP POLICY IF EXISTS organizations_delete ON organizations;
DROP POLICY IF EXISTS organizations_all ON organizations;

CREATE POLICY organizations_permissive ON organizations FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- SNAPSHOT TABLES
-- =============================================================================
DROP POLICY IF EXISTS data_snapshots_all ON data_snapshots;
DROP POLICY IF EXISTS snap_read ON data_snapshots;
DROP POLICY IF EXISTS snap_write ON data_snapshots;
DROP POLICY IF EXISTS snap_modify ON data_snapshots;
DROP POLICY IF EXISTS snap_remove ON data_snapshots;

CREATE POLICY data_snapshots_permissive ON data_snapshots FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS snapshot_candidates_all ON snapshot_candidates;
DROP POLICY IF EXISTS snapcand_read ON snapshot_candidates;
DROP POLICY IF EXISTS snapcand_write ON snapshot_candidates;
DROP POLICY IF EXISTS snapcand_modify ON snapshot_candidates;
DROP POLICY IF EXISTS snapcand_remove ON snapshot_candidates;

CREATE POLICY snapshot_candidates_permissive ON snapshot_candidates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS snapshot_requisitions_all ON snapshot_requisitions;
DROP POLICY IF EXISTS snapreq_read ON snapshot_requisitions;
DROP POLICY IF EXISTS snapreq_write ON snapshot_requisitions;
DROP POLICY IF EXISTS snapreq_modify ON snapshot_requisitions;
DROP POLICY IF EXISTS snapreq_remove ON snapshot_requisitions;

CREATE POLICY snapshot_requisitions_permissive ON snapshot_requisitions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS snapshot_events_all ON snapshot_events;
DROP POLICY IF EXISTS snapevt_read ON snapshot_events;
DROP POLICY IF EXISTS snapevt_write ON snapshot_events;
DROP POLICY IF EXISTS snapevt_modify ON snapshot_events;
DROP POLICY IF EXISTS snapevt_remove ON snapshot_events;

CREATE POLICY snapshot_events_permissive ON snapshot_events FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- USER_AI_VAULT TABLE
-- =============================================================================
DROP POLICY IF EXISTS vault_read ON user_ai_vault;
DROP POLICY IF EXISTS vault_write ON user_ai_vault;
DROP POLICY IF EXISTS vault_modify ON user_ai_vault;
DROP POLICY IF EXISTS vault_remove ON user_ai_vault;
DROP POLICY IF EXISTS user_ai_vault_all ON user_ai_vault;

CREATE POLICY user_ai_vault_permissive ON user_ai_vault FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- ORGANIZATION_SETTINGS TABLE
-- =============================================================================
DROP POLICY IF EXISTS orgsettings_read ON organization_settings;
DROP POLICY IF EXISTS orgsettings_write ON organization_settings;
DROP POLICY IF EXISTS orgsettings_modify ON organization_settings;
DROP POLICY IF EXISTS orgsettings_remove ON organization_settings;
DROP POLICY IF EXISTS organization_settings_all ON organization_settings;

CREATE POLICY organization_settings_permissive ON organization_settings FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- ORGANIZATION_INVITES TABLE
-- =============================================================================
DROP POLICY IF EXISTS invites_read ON organization_invites;
DROP POLICY IF EXISTS invites_write ON organization_invites;
DROP POLICY IF EXISTS invites_modify ON organization_invites;
DROP POLICY IF EXISTS invites_remove ON organization_invites;
DROP POLICY IF EXISTS organization_invites_all ON organization_invites;

CREATE POLICY organization_invites_permissive ON organization_invites FOR ALL USING (true) WITH CHECK (true);
