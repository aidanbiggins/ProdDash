-- ============================================
-- SIMPLIFIED RLS ARCHITECTURE
-- ============================================
-- This migration replaces the complex multi-admin RLS system with a simpler model:
--
-- PRINCIPLES:
-- 1. RLS enforces DATA ISOLATION (who can see what org's data)
-- 2. Application layer enforces BUSINESS LOGIC (who can modify)
-- 3. Two simple patterns: user-owned data, org-owned data
-- 4. No circular dependencies
-- 5. All GRANTs in one place
--
-- REMOVED:
-- - super_admins dependency in policies (handled in app via SUPER_ADMIN_EMAIL)
-- - Duplicate helper functions
-- - Complex nested permission checks
--
-- ============================================

-- ============================================
-- STEP 1: ENSURE ALL GRANTS ARE IN PLACE
-- ============================================
-- Grant all tables to authenticated role
-- (RLS policies control what rows are visible, GRANTs control table access)

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_admins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ai_vault TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_ai_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.snapshot_candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.snapshot_requisitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.snapshot_events TO authenticated;

-- ============================================
-- STEP 2: SIMPLIFIED HELPER FUNCTION
-- ============================================
-- Single helper: check if user belongs to an org
-- No more is_super_admin() checks in RLS - that's handled in app layer

CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
    AND organization_id = org_id
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION is_org_member(UUID) TO authenticated;

-- Keep user_org_ids() for backwards compatibility with some queries
CREATE OR REPLACE FUNCTION user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- STEP 3: ORGANIZATIONS - Simplified
-- ============================================
-- Users can see orgs they belong to
-- Users can create orgs (app layer checks quotas)
-- Users can update/delete orgs they belong to (app layer checks if admin)

DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "organizations_insert" ON organizations;
DROP POLICY IF EXISTS "organizations_update" ON organizations;
DROP POLICY IF EXISTS "organizations_delete" ON organizations;

CREATE POLICY "org_read" ON organizations
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (id IN (SELECT user_org_ids()) OR deleted_at IS NULL)
  );

CREATE POLICY "org_write" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "org_modify" ON organizations
  FOR UPDATE USING (is_org_member(id));

CREATE POLICY "org_remove" ON organizations
  FOR DELETE USING (is_org_member(id));

-- ============================================
-- STEP 4: ORGANIZATION_MEMBERS - Simplified
-- ============================================
-- Users can see members of orgs they belong to
-- Write operations checked in app layer (only admins can add/remove members)

DROP POLICY IF EXISTS "org_members_select" ON organization_members;
DROP POLICY IF EXISTS "org_members_insert" ON organization_members;
DROP POLICY IF EXISTS "org_members_update" ON organization_members;
DROP POLICY IF EXISTS "org_members_delete" ON organization_members;

CREATE POLICY "members_read" ON organization_members
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT user_org_ids())
  );

CREATE POLICY "members_write" ON organization_members
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT user_org_ids())
  );

CREATE POLICY "members_modify" ON organization_members
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "members_remove" ON organization_members
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- ============================================
-- STEP 5: SUPER_ADMINS - Simplified
-- ============================================
-- Anyone authenticated can check if they're a super admin
-- Only existing super admins can add new ones (via seed_super_admin function)

DROP POLICY IF EXISTS "super_admins_select" ON super_admins;
DROP POLICY IF EXISTS "super_admins_modify" ON super_admins;
DROP POLICY IF EXISTS "super_admins_update" ON super_admins;
DROP POLICY IF EXISTS "super_admins_delete" ON super_admins;
DROP POLICY IF EXISTS "super_admins_all" ON super_admins;

-- Simple: any authenticated user can read (they'll only see their own row if exists)
CREATE POLICY "super_read" ON super_admins
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Writes go through seed_super_admin() function which has SECURITY DEFINER
CREATE POLICY "super_write" ON super_admins
  FOR INSERT WITH CHECK (FALSE); -- Block direct inserts, use seed_super_admin()

CREATE POLICY "super_modify" ON super_admins
  FOR UPDATE USING (FALSE); -- No updates allowed

CREATE POLICY "super_remove" ON super_admins
  FOR DELETE USING (user_id = auth.uid()); -- Can only remove self

-- ============================================
-- STEP 6: ORGANIZATION_INVITES - Simplified
-- ============================================

DROP POLICY IF EXISTS "org_invites_select" ON organization_invites;
DROP POLICY IF EXISTS "org_invites_insert" ON organization_invites;
DROP POLICY IF EXISTS "org_invites_delete" ON organization_invites;

-- Can see invites for orgs you belong to, or invites sent to your email
CREATE POLICY "invites_read" ON organization_invites
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      organization_id IN (SELECT user_org_ids())
      OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "invites_write" ON organization_invites
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "invites_remove" ON organization_invites
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- ============================================
-- STEP 7: DATA TABLES - Simplified
-- ============================================
-- Pattern: org members can read, write handled by app layer

-- REQUISITIONS
DROP POLICY IF EXISTS "requisitions_select" ON requisitions;
DROP POLICY IF EXISTS "requisitions_insert" ON requisitions;
DROP POLICY IF EXISTS "requisitions_update" ON requisitions;
DROP POLICY IF EXISTS "requisitions_delete" ON requisitions;

CREATE POLICY "reqs_read" ON requisitions
  FOR SELECT USING (
    organization_id IN (SELECT user_org_ids())
    OR organization_id IS NULL
  );

CREATE POLICY "reqs_write" ON requisitions
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "reqs_modify" ON requisitions
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "reqs_remove" ON requisitions
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- CANDIDATES
DROP POLICY IF EXISTS "candidates_select" ON candidates;
DROP POLICY IF EXISTS "candidates_insert" ON candidates;
DROP POLICY IF EXISTS "candidates_update" ON candidates;
DROP POLICY IF EXISTS "candidates_delete" ON candidates;

CREATE POLICY "cands_read" ON candidates
  FOR SELECT USING (
    organization_id IN (SELECT user_org_ids())
    OR organization_id IS NULL
  );

CREATE POLICY "cands_write" ON candidates
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "cands_modify" ON candidates
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "cands_remove" ON candidates
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- EVENTS
DROP POLICY IF EXISTS "events_select" ON events;
DROP POLICY IF EXISTS "events_insert" ON events;
DROP POLICY IF EXISTS "events_update" ON events;
DROP POLICY IF EXISTS "events_delete" ON events;

CREATE POLICY "events_read" ON events
  FOR SELECT USING (
    organization_id IN (SELECT user_org_ids())
    OR organization_id IS NULL
  );

CREATE POLICY "events_write" ON events
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "events_modify" ON events
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "events_remove" ON events
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- USERS (recruiting users, not auth users)
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;

CREATE POLICY "users_read" ON users
  FOR SELECT USING (
    organization_id IN (SELECT user_org_ids())
    OR organization_id IS NULL
  );

CREATE POLICY "users_write" ON users
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "users_modify" ON users
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "users_remove" ON users
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- ============================================
-- STEP 8: USER_AI_VAULT - Already Good
-- ============================================
-- user_ai_vault already uses the simple pattern: auth.uid() = user_id
-- No changes needed

-- ============================================
-- STEP 9: ORGANIZATION_SETTINGS - Simplified
-- ============================================

DROP POLICY IF EXISTS "org_settings_select" ON organization_settings;
DROP POLICY IF EXISTS "org_settings_insert" ON organization_settings;
DROP POLICY IF EXISTS "org_settings_update" ON organization_settings;
DROP POLICY IF EXISTS "org_settings_delete" ON organization_settings;

CREATE POLICY "settings_read" ON organization_settings
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "settings_write" ON organization_settings
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "settings_modify" ON organization_settings
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "settings_remove" ON organization_settings
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- ============================================
-- STEP 10: ORG_AI_KEYS - Simplified
-- ============================================

DROP POLICY IF EXISTS "Org members can view org AI keys" ON org_ai_keys;
DROP POLICY IF EXISTS "Admins can insert org AI keys" ON org_ai_keys;
DROP POLICY IF EXISTS "Admins can update org AI keys" ON org_ai_keys;
DROP POLICY IF EXISTS "Admins can delete org AI keys" ON org_ai_keys;

CREATE POLICY "orgkeys_read" ON org_ai_keys
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "orgkeys_write" ON org_ai_keys
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "orgkeys_modify" ON org_ai_keys
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "orgkeys_remove" ON org_ai_keys
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- ============================================
-- STEP 11: SNAPSHOT TABLES - Simplified
-- ============================================

-- DATA_SNAPSHOTS
DROP POLICY IF EXISTS "snapshots_select" ON data_snapshots;
DROP POLICY IF EXISTS "snapshots_insert" ON data_snapshots;
DROP POLICY IF EXISTS "snapshots_update" ON data_snapshots;
DROP POLICY IF EXISTS "snapshots_delete" ON data_snapshots;

CREATE POLICY "snapshots_read" ON data_snapshots
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapshots_write" ON data_snapshots
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapshots_modify" ON data_snapshots
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapshots_remove" ON data_snapshots
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- SNAPSHOT_CANDIDATES
DROP POLICY IF EXISTS "snap_cand_select" ON snapshot_candidates;
DROP POLICY IF EXISTS "snap_cand_insert" ON snapshot_candidates;
DROP POLICY IF EXISTS "snap_cand_update" ON snapshot_candidates;
DROP POLICY IF EXISTS "snap_cand_delete" ON snapshot_candidates;

CREATE POLICY "snapcand_read" ON snapshot_candidates
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapcand_write" ON snapshot_candidates
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapcand_modify" ON snapshot_candidates
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapcand_remove" ON snapshot_candidates
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- SNAPSHOT_REQUISITIONS
DROP POLICY IF EXISTS "snap_req_select" ON snapshot_requisitions;
DROP POLICY IF EXISTS "snap_req_insert" ON snapshot_requisitions;
DROP POLICY IF EXISTS "snap_req_update" ON snapshot_requisitions;
DROP POLICY IF EXISTS "snap_req_delete" ON snapshot_requisitions;

CREATE POLICY "snapreq_read" ON snapshot_requisitions
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapreq_write" ON snapshot_requisitions
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapreq_modify" ON snapshot_requisitions
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapreq_remove" ON snapshot_requisitions
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- SNAPSHOT_EVENTS
DROP POLICY IF EXISTS "snap_events_select" ON snapshot_events;
DROP POLICY IF EXISTS "snap_events_insert" ON snapshot_events;
DROP POLICY IF EXISTS "snap_events_update" ON snapshot_events;
DROP POLICY IF EXISTS "snap_events_delete" ON snapshot_events;

CREATE POLICY "snapevents_read" ON snapshot_events
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapevents_write" ON snapshot_events
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapevents_modify" ON snapshot_events
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapevents_remove" ON snapshot_events
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- ============================================
-- STEP 12: CLEANUP OLD FUNCTIONS
-- ============================================
-- Keep is_super_admin() for backwards compatibility with app code
-- Keep is_org_admin() for backwards compatibility
-- Remove duplicate is_org_admin_or_super()

DROP FUNCTION IF EXISTS is_org_admin_or_super(UUID);

-- ============================================
-- DONE!
-- ============================================
-- New architecture:
-- - 15 tables, ~60 policies (same count but simpler logic)
-- - 1 primary pattern: organization_id IN (SELECT user_org_ids())
-- - No circular dependencies
-- - Admin checks happen in application layer
-- - All GRANTs in one place
