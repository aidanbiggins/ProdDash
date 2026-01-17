-- ============================================
-- CLEAN RLS POLICIES - Multi-tenant Security
-- ============================================
-- This migration drops ALL existing policies and creates fresh ones
-- with a consistent, simple pattern that actually works.
--
-- PATTERN:
-- 1. SELECT: User can see data from orgs they belong to (or NULL org_id for legacy)
-- 2. INSERT/UPDATE/DELETE: User can modify data from orgs they belong to
-- 3. User-owned tables (like user_ai_vault): Simple auth.uid() = user_id check
--
-- KEY FIX: The previous policies were too complex and had conflicts.
-- This uses a simple inline check instead of helper functions in policies.
-- ============================================

-- ============================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ============================================

-- Organizations
DROP POLICY IF EXISTS "org_read" ON organizations;
DROP POLICY IF EXISTS "org_write" ON organizations;
DROP POLICY IF EXISTS "org_modify" ON organizations;
DROP POLICY IF EXISTS "org_remove" ON organizations;
DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "organizations_insert" ON organizations;
DROP POLICY IF EXISTS "organizations_update" ON organizations;
DROP POLICY IF EXISTS "organizations_delete" ON organizations;

-- Organization members
DROP POLICY IF EXISTS "members_read" ON organization_members;
DROP POLICY IF EXISTS "members_write" ON organization_members;
DROP POLICY IF EXISTS "members_modify" ON organization_members;
DROP POLICY IF EXISTS "members_remove" ON organization_members;
DROP POLICY IF EXISTS "org_members_select" ON organization_members;
DROP POLICY IF EXISTS "org_members_insert" ON organization_members;
DROP POLICY IF EXISTS "org_members_update" ON organization_members;
DROP POLICY IF EXISTS "org_members_delete" ON organization_members;

-- Super admins
DROP POLICY IF EXISTS "super_read" ON super_admins;
DROP POLICY IF EXISTS "super_write" ON super_admins;
DROP POLICY IF EXISTS "super_modify" ON super_admins;
DROP POLICY IF EXISTS "super_remove" ON super_admins;
DROP POLICY IF EXISTS "super_admins_select" ON super_admins;
DROP POLICY IF EXISTS "super_admins_all" ON super_admins;
DROP POLICY IF EXISTS "super_admins_modify" ON super_admins;
DROP POLICY IF EXISTS "super_admins_update" ON super_admins;
DROP POLICY IF EXISTS "super_admins_delete" ON super_admins;

-- Organization invites
DROP POLICY IF EXISTS "invites_read" ON organization_invites;
DROP POLICY IF EXISTS "invites_write" ON organization_invites;
DROP POLICY IF EXISTS "invites_remove" ON organization_invites;
DROP POLICY IF EXISTS "org_invites_select" ON organization_invites;
DROP POLICY IF EXISTS "org_invites_insert" ON organization_invites;
DROP POLICY IF EXISTS "org_invites_delete" ON organization_invites;

-- Organization settings
DROP POLICY IF EXISTS "settings_read" ON organization_settings;
DROP POLICY IF EXISTS "settings_write" ON organization_settings;
DROP POLICY IF EXISTS "settings_modify" ON organization_settings;
DROP POLICY IF EXISTS "settings_remove" ON organization_settings;
DROP POLICY IF EXISTS "org_settings_select" ON organization_settings;
DROP POLICY IF EXISTS "org_settings_insert" ON organization_settings;
DROP POLICY IF EXISTS "org_settings_update" ON organization_settings;
DROP POLICY IF EXISTS "org_settings_delete" ON organization_settings;

-- Org AI keys
DROP POLICY IF EXISTS "orgkeys_read" ON org_ai_keys;
DROP POLICY IF EXISTS "orgkeys_write" ON org_ai_keys;
DROP POLICY IF EXISTS "orgkeys_modify" ON org_ai_keys;
DROP POLICY IF EXISTS "orgkeys_remove" ON org_ai_keys;
DROP POLICY IF EXISTS "Org members can view org AI keys" ON org_ai_keys;
DROP POLICY IF EXISTS "Admins can insert org AI keys" ON org_ai_keys;
DROP POLICY IF EXISTS "Admins can update org AI keys" ON org_ai_keys;
DROP POLICY IF EXISTS "Admins can delete org AI keys" ON org_ai_keys;

-- Requisitions
DROP POLICY IF EXISTS "reqs_read" ON requisitions;
DROP POLICY IF EXISTS "reqs_write" ON requisitions;
DROP POLICY IF EXISTS "reqs_modify" ON requisitions;
DROP POLICY IF EXISTS "reqs_remove" ON requisitions;
DROP POLICY IF EXISTS "requisitions_select" ON requisitions;
DROP POLICY IF EXISTS "requisitions_insert" ON requisitions;
DROP POLICY IF EXISTS "requisitions_update" ON requisitions;
DROP POLICY IF EXISTS "requisitions_delete" ON requisitions;
DROP POLICY IF EXISTS "Authenticated users can view requisitions." ON requisitions;
DROP POLICY IF EXISTS "Authenticated users can insert requisitions." ON requisitions;
DROP POLICY IF EXISTS "Authenticated users can update requisitions." ON requisitions;

-- Candidates
DROP POLICY IF EXISTS "cands_read" ON candidates;
DROP POLICY IF EXISTS "cands_write" ON candidates;
DROP POLICY IF EXISTS "cands_modify" ON candidates;
DROP POLICY IF EXISTS "cands_remove" ON candidates;
DROP POLICY IF EXISTS "candidates_select" ON candidates;
DROP POLICY IF EXISTS "candidates_insert" ON candidates;
DROP POLICY IF EXISTS "candidates_update" ON candidates;
DROP POLICY IF EXISTS "candidates_delete" ON candidates;
DROP POLICY IF EXISTS "Authenticated users can view candidates." ON candidates;
DROP POLICY IF EXISTS "Authenticated users can insert candidates." ON candidates;
DROP POLICY IF EXISTS "Authenticated users can update candidates." ON candidates;

-- Events
DROP POLICY IF EXISTS "events_read" ON events;
DROP POLICY IF EXISTS "events_write" ON events;
DROP POLICY IF EXISTS "events_modify" ON events;
DROP POLICY IF EXISTS "events_remove" ON events;
DROP POLICY IF EXISTS "events_select" ON events;
DROP POLICY IF EXISTS "events_insert" ON events;
DROP POLICY IF EXISTS "events_update" ON events;
DROP POLICY IF EXISTS "events_delete" ON events;
DROP POLICY IF EXISTS "Authenticated users can view events." ON events;
DROP POLICY IF EXISTS "Authenticated users can insert events." ON events;

-- Users (recruiting users table)
DROP POLICY IF EXISTS "users_read" ON users;
DROP POLICY IF EXISTS "users_write" ON users;
DROP POLICY IF EXISTS "users_modify" ON users;
DROP POLICY IF EXISTS "users_remove" ON users;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;
DROP POLICY IF EXISTS "Authenticated users can view users." ON users;
DROP POLICY IF EXISTS "Authenticated users can insert users." ON users;
DROP POLICY IF EXISTS "Authenticated users can update users." ON users;

-- Snapshots
DROP POLICY IF EXISTS "snapshots_read" ON data_snapshots;
DROP POLICY IF EXISTS "snapshots_write" ON data_snapshots;
DROP POLICY IF EXISTS "snapshots_modify" ON data_snapshots;
DROP POLICY IF EXISTS "snapshots_remove" ON data_snapshots;
DROP POLICY IF EXISTS "Authenticated users can view snapshots." ON data_snapshots;
DROP POLICY IF EXISTS "Authenticated users can insert snapshots." ON data_snapshots;

DROP POLICY IF EXISTS "snapcand_read" ON snapshot_candidates;
DROP POLICY IF EXISTS "snapcand_write" ON snapshot_candidates;
DROP POLICY IF EXISTS "snapcand_modify" ON snapshot_candidates;
DROP POLICY IF EXISTS "snapcand_remove" ON snapshot_candidates;

DROP POLICY IF EXISTS "snapreq_read" ON snapshot_requisitions;
DROP POLICY IF EXISTS "snapreq_write" ON snapshot_requisitions;
DROP POLICY IF EXISTS "snapreq_modify" ON snapshot_requisitions;
DROP POLICY IF EXISTS "snapreq_remove" ON snapshot_requisitions;

DROP POLICY IF EXISTS "snapevents_read" ON snapshot_events;
DROP POLICY IF EXISTS "snapevents_write" ON snapshot_events;
DROP POLICY IF EXISTS "snapevents_modify" ON snapshot_events;
DROP POLICY IF EXISTS "snapevents_remove" ON snapshot_events;

-- ============================================
-- STEP 2: ENSURE ALL GRANTS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================
-- STEP 3: CREATE HELPER FUNCTION
-- ============================================
-- Simple function to check org membership with INLINE logic
-- This avoids the circular dependency issues

CREATE OR REPLACE FUNCTION user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- STEP 4: ORGANIZATIONS
-- ============================================
-- Users can see orgs they belong to
-- Any authenticated user can create an org
-- Members can update their org (admin check in app layer)

CREATE POLICY "organizations_select" ON organizations
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      id IN (SELECT user_org_ids())
      OR deleted_at IS NULL  -- Allow seeing active orgs for joining
    )
  );

CREATE POLICY "organizations_insert" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "organizations_update" ON organizations
  FOR UPDATE USING (id IN (SELECT user_org_ids()));

CREATE POLICY "organizations_delete" ON organizations
  FOR DELETE USING (id IN (SELECT user_org_ids()));

-- ============================================
-- STEP 5: ORGANIZATION MEMBERS
-- ============================================
-- Users can see members of orgs they belong to
-- Users can be added to orgs (for accepting invites)

CREATE POLICY "org_members_select" ON organization_members
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT user_org_ids())
  );

-- Allow insert for: existing members adding others, OR user adding themselves (invite accept)
CREATE POLICY "org_members_insert" ON organization_members
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      organization_id IN (SELECT user_org_ids())  -- Existing member adding
      OR user_id = auth.uid()  -- User accepting invite (adding self)
    )
  );

CREATE POLICY "org_members_update" ON organization_members
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "org_members_delete" ON organization_members
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- ============================================
-- STEP 6: SUPER ADMINS
-- ============================================
-- Any authenticated user can check if they're a super admin
-- Only seed_super_admin() function can insert (SECURITY DEFINER)

CREATE POLICY "super_admins_select" ON super_admins
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "super_admins_insert" ON super_admins
  FOR INSERT WITH CHECK (FALSE);  -- Use seed_super_admin() function

CREATE POLICY "super_admins_delete" ON super_admins
  FOR DELETE USING (user_id = auth.uid());  -- Can only remove self

-- ============================================
-- STEP 7: ORGANIZATION INVITES
-- ============================================

CREATE POLICY "org_invites_select" ON organization_invites
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      organization_id IN (SELECT user_org_ids())
      OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "org_invites_insert" ON organization_invites
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "org_invites_delete" ON organization_invites
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- ============================================
-- STEP 8: ORGANIZATION SETTINGS
-- ============================================

CREATE POLICY "org_settings_select" ON organization_settings
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT user_org_ids())
  );

CREATE POLICY "org_settings_insert" ON organization_settings
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "org_settings_update" ON organization_settings
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "org_settings_delete" ON organization_settings
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- ============================================
-- STEP 9: ORG AI KEYS
-- ============================================

CREATE POLICY "org_ai_keys_select" ON org_ai_keys
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT user_org_ids())
  );

CREATE POLICY "org_ai_keys_insert" ON org_ai_keys
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "org_ai_keys_update" ON org_ai_keys
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "org_ai_keys_delete" ON org_ai_keys
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- ============================================
-- STEP 10: DATA TABLES (reqs, cands, events, users)
-- ============================================
-- These tables have organization_id that can be NULL (legacy data)
-- Policy: Can see own org's data OR data with NULL org_id

-- REQUISITIONS
CREATE POLICY "requisitions_select" ON requisitions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      organization_id IN (SELECT user_org_ids())
      OR organization_id IS NULL
    )
  );

CREATE POLICY "requisitions_insert" ON requisitions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      organization_id IN (SELECT user_org_ids())
      OR organization_id IS NULL
    )
  );

CREATE POLICY "requisitions_update" ON requisitions
  FOR UPDATE USING (
    organization_id IN (SELECT user_org_ids())
    OR organization_id IS NULL
  );

CREATE POLICY "requisitions_delete" ON requisitions
  FOR DELETE USING (
    organization_id IN (SELECT user_org_ids())
    OR organization_id IS NULL
  );

-- CANDIDATES
CREATE POLICY "candidates_select" ON candidates
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      organization_id IN (SELECT user_org_ids())
      OR organization_id IS NULL
    )
  );

CREATE POLICY "candidates_insert" ON candidates
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      organization_id IN (SELECT user_org_ids())
      OR organization_id IS NULL
    )
  );

CREATE POLICY "candidates_update" ON candidates
  FOR UPDATE USING (
    organization_id IN (SELECT user_org_ids())
    OR organization_id IS NULL
  );

CREATE POLICY "candidates_delete" ON candidates
  FOR DELETE USING (
    organization_id IN (SELECT user_org_ids())
    OR organization_id IS NULL
  );

-- EVENTS
CREATE POLICY "events_select" ON events
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      organization_id IN (SELECT user_org_ids())
      OR organization_id IS NULL
    )
  );

CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      organization_id IN (SELECT user_org_ids())
      OR organization_id IS NULL
    )
  );

CREATE POLICY "events_update" ON events
  FOR UPDATE USING (
    organization_id IN (SELECT user_org_ids())
    OR organization_id IS NULL
  );

CREATE POLICY "events_delete" ON events
  FOR DELETE USING (
    organization_id IN (SELECT user_org_ids())
    OR organization_id IS NULL
  );

-- USERS (recruiting users, not auth users)
CREATE POLICY "users_select" ON users
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      organization_id IN (SELECT user_org_ids())
      OR organization_id IS NULL
    )
  );

CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      organization_id IN (SELECT user_org_ids())
      OR organization_id IS NULL
    )
  );

CREATE POLICY "users_update" ON users
  FOR UPDATE USING (
    organization_id IN (SELECT user_org_ids())
    OR organization_id IS NULL
  );

CREATE POLICY "users_delete" ON users
  FOR DELETE USING (
    organization_id IN (SELECT user_org_ids())
    OR organization_id IS NULL
  );

-- ============================================
-- STEP 11: SNAPSHOT TABLES
-- ============================================

-- DATA_SNAPSHOTS
CREATE POLICY "snapshots_select" ON data_snapshots
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT user_org_ids())
  );

CREATE POLICY "snapshots_insert" ON data_snapshots
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapshots_update" ON data_snapshots
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapshots_delete" ON data_snapshots
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- SNAPSHOT_CANDIDATES
CREATE POLICY "snap_cand_select" ON snapshot_candidates
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT user_org_ids())
  );

CREATE POLICY "snap_cand_insert" ON snapshot_candidates
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snap_cand_update" ON snapshot_candidates
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snap_cand_delete" ON snapshot_candidates
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- SNAPSHOT_REQUISITIONS
CREATE POLICY "snap_req_select" ON snapshot_requisitions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT user_org_ids())
  );

CREATE POLICY "snap_req_insert" ON snapshot_requisitions
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snap_req_update" ON snapshot_requisitions
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snap_req_delete" ON snapshot_requisitions
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- SNAPSHOT_EVENTS
CREATE POLICY "snap_events_select" ON snapshot_events
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT user_org_ids())
  );

CREATE POLICY "snap_events_insert" ON snapshot_events
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snap_events_update" ON snapshot_events
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snap_events_delete" ON snapshot_events
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- ============================================
-- STEP 12: USER_AI_VAULT (user-owned, not org-owned)
-- ============================================
-- This table uses user_id, not organization_id
-- Policies should already exist but let's ensure they're correct

DROP POLICY IF EXISTS "Users can view own vault entries" ON user_ai_vault;
DROP POLICY IF EXISTS "Users can insert own vault entries" ON user_ai_vault;
DROP POLICY IF EXISTS "Users can update own vault entries" ON user_ai_vault;
DROP POLICY IF EXISTS "Users can delete own vault entries" ON user_ai_vault;

CREATE POLICY "vault_select" ON user_ai_vault
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "vault_insert" ON user_ai_vault
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vault_update" ON user_ai_vault
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "vault_delete" ON user_ai_vault
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- DONE!
-- ============================================
-- Summary:
-- - All old policies dropped
-- - Fresh policies with consistent naming
-- - Pattern: organization_id IN (SELECT user_org_ids()) OR organization_id IS NULL
-- - Data tables allow NULL org_id for backwards compatibility
-- - Admin/role checks happen in application layer
-- ============================================
