-- ============================================
-- SECURITY ADVISOR FIXES V2
-- ============================================
-- Fixes remaining warnings after 014:
-- 1. Two functions still missing search_path (need explicit schema refs)
-- 2. RLS "Always True" policies on data tables
-- ============================================

-- ============================================
-- FIX 1: Remaining Function Search Path Issues
-- ============================================
-- These functions call other functions, need explicit public. prefix

DROP FUNCTION IF EXISTS create_organization(text) CASCADE;
DROP FUNCTION IF EXISTS accept_organization_invite(uuid) CASCADE;

-- create_organization - Create org and add creator as admin
CREATE OR REPLACE FUNCTION create_organization(org_name TEXT)
RETURNS UUID AS $$
DECLARE
  new_org_id UUID;
  org_slug TEXT;
BEGIN
  -- Generate unique slug (explicit schema reference)
  SELECT public.generate_org_slug(org_name) INTO org_slug;

  -- Create the organization
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (org_name, org_slug, auth.uid())
  RETURNING id INTO new_org_id;

  -- Add creator as admin member
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, auth.uid(), 'admin');

  RETURN new_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- accept_organization_invite - Accept an invite and become a member
CREATE OR REPLACE FUNCTION accept_organization_invite(invite_token UUID)
RETURNS UUID AS $$
DECLARE
  invite_record RECORD;
  new_membership_id UUID;
BEGIN
  -- Find the invite
  SELECT * INTO invite_record
  FROM public.organization_invites
  WHERE token = invite_token
  AND expires_at > NOW()
  AND accepted_at IS NULL;

  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  -- Create membership
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (invite_record.organization_id, auth.uid(), invite_record.role)
  RETURNING id INTO new_membership_id;

  -- Mark invite as accepted
  UPDATE public.organization_invites
  SET accepted_at = NOW(), accepted_by = auth.uid()
  WHERE id = invite_record.id;

  RETURN new_membership_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION create_organization(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_organization_invite(UUID) TO authenticated;

-- Recreate trigger that was dropped
DROP TRIGGER IF EXISTS on_organization_created ON organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_org_creator();

-- ============================================
-- FIX 2: RLS Policy "Always True" warnings
-- ============================================
-- The issue: policies with "organization_id IS NULL" are flagged as
-- overly permissive because NULL org data is accessible to all auth users.
--
-- Solution: Remove NULL org access. Data without org_id should be migrated
-- or is not accessible via API. For safety, we require org membership.
-- ============================================

-- CANDIDATES - Drop and recreate with strict policy
DROP POLICY IF EXISTS "cands_read" ON candidates;
DROP POLICY IF EXISTS "cands_write" ON candidates;
DROP POLICY IF EXISTS "cands_modify" ON candidates;
DROP POLICY IF EXISTS "cands_remove" ON candidates;
DROP POLICY IF EXISTS "candidates_select" ON candidates;
DROP POLICY IF EXISTS "candidates_insert" ON candidates;
DROP POLICY IF EXISTS "candidates_update" ON candidates;
DROP POLICY IF EXISTS "candidates_delete" ON candidates;

CREATE POLICY "candidates_select" ON candidates
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "candidates_insert" ON candidates
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "candidates_update" ON candidates
  FOR UPDATE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "candidates_delete" ON candidates
  FOR DELETE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

-- REQUISITIONS - Drop and recreate with strict policy
DROP POLICY IF EXISTS "reqs_read" ON requisitions;
DROP POLICY IF EXISTS "reqs_write" ON requisitions;
DROP POLICY IF EXISTS "reqs_modify" ON requisitions;
DROP POLICY IF EXISTS "reqs_remove" ON requisitions;
DROP POLICY IF EXISTS "requisitions_select" ON requisitions;
DROP POLICY IF EXISTS "requisitions_insert" ON requisitions;
DROP POLICY IF EXISTS "requisitions_update" ON requisitions;
DROP POLICY IF EXISTS "requisitions_delete" ON requisitions;

CREATE POLICY "requisitions_select" ON requisitions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "requisitions_insert" ON requisitions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "requisitions_update" ON requisitions
  FOR UPDATE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "requisitions_delete" ON requisitions
  FOR DELETE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

-- EVENTS - Drop and recreate with strict policy
DROP POLICY IF EXISTS "events_read" ON events;
DROP POLICY IF EXISTS "events_write" ON events;
DROP POLICY IF EXISTS "events_modify" ON events;
DROP POLICY IF EXISTS "events_remove" ON events;
DROP POLICY IF EXISTS "events_select" ON events;
DROP POLICY IF EXISTS "events_insert" ON events;
DROP POLICY IF EXISTS "events_update" ON events;
DROP POLICY IF EXISTS "events_delete" ON events;

CREATE POLICY "events_select" ON events
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "events_update" ON events
  FOR UPDATE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "events_delete" ON events
  FOR DELETE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

-- DATA_SNAPSHOTS - Drop and recreate with strict policy
DROP POLICY IF EXISTS "snapshots_read" ON data_snapshots;
DROP POLICY IF EXISTS "snapshots_write" ON data_snapshots;
DROP POLICY IF EXISTS "snapshots_modify" ON data_snapshots;
DROP POLICY IF EXISTS "snapshots_remove" ON data_snapshots;
DROP POLICY IF EXISTS "snapshots_select" ON data_snapshots;
DROP POLICY IF EXISTS "snapshots_insert" ON data_snapshots;
DROP POLICY IF EXISTS "snapshots_update" ON data_snapshots;
DROP POLICY IF EXISTS "snapshots_delete" ON data_snapshots;

CREATE POLICY "snapshots_select" ON data_snapshots
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "snapshots_insert" ON data_snapshots
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "snapshots_update" ON data_snapshots
  FOR UPDATE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "snapshots_delete" ON data_snapshots
  FOR DELETE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

-- SNAPSHOT_CANDIDATES
DROP POLICY IF EXISTS "snapcand_read" ON snapshot_candidates;
DROP POLICY IF EXISTS "snapcand_write" ON snapshot_candidates;
DROP POLICY IF EXISTS "snapcand_modify" ON snapshot_candidates;
DROP POLICY IF EXISTS "snapcand_remove" ON snapshot_candidates;
DROP POLICY IF EXISTS "snap_cand_select" ON snapshot_candidates;
DROP POLICY IF EXISTS "snap_cand_insert" ON snapshot_candidates;
DROP POLICY IF EXISTS "snap_cand_update" ON snapshot_candidates;
DROP POLICY IF EXISTS "snap_cand_delete" ON snapshot_candidates;

CREATE POLICY "snap_cand_select" ON snapshot_candidates
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "snap_cand_insert" ON snapshot_candidates
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "snap_cand_update" ON snapshot_candidates
  FOR UPDATE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "snap_cand_delete" ON snapshot_candidates
  FOR DELETE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

-- SNAPSHOT_REQUISITIONS
DROP POLICY IF EXISTS "snapreq_read" ON snapshot_requisitions;
DROP POLICY IF EXISTS "snapreq_write" ON snapshot_requisitions;
DROP POLICY IF EXISTS "snapreq_modify" ON snapshot_requisitions;
DROP POLICY IF EXISTS "snapreq_remove" ON snapshot_requisitions;
DROP POLICY IF EXISTS "snap_req_select" ON snapshot_requisitions;
DROP POLICY IF EXISTS "snap_req_insert" ON snapshot_requisitions;
DROP POLICY IF EXISTS "snap_req_update" ON snapshot_requisitions;
DROP POLICY IF EXISTS "snap_req_delete" ON snapshot_requisitions;

CREATE POLICY "snap_req_select" ON snapshot_requisitions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "snap_req_insert" ON snapshot_requisitions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "snap_req_update" ON snapshot_requisitions
  FOR UPDATE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "snap_req_delete" ON snapshot_requisitions
  FOR DELETE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

-- SNAPSHOT_EVENTS
DROP POLICY IF EXISTS "snapevents_read" ON snapshot_events;
DROP POLICY IF EXISTS "snapevents_write" ON snapshot_events;
DROP POLICY IF EXISTS "snapevents_modify" ON snapshot_events;
DROP POLICY IF EXISTS "snapevents_remove" ON snapshot_events;
DROP POLICY IF EXISTS "snap_events_select" ON snapshot_events;
DROP POLICY IF EXISTS "snap_events_insert" ON snapshot_events;
DROP POLICY IF EXISTS "snap_events_update" ON snapshot_events;
DROP POLICY IF EXISTS "snap_events_delete" ON snapshot_events;

CREATE POLICY "snap_events_select" ON snapshot_events
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "snap_events_insert" ON snapshot_events
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "snap_events_update" ON snapshot_events
  FOR UPDATE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

CREATE POLICY "snap_events_delete" ON snapshot_events
  FOR DELETE USING (
    organization_id IN (SELECT public.user_org_ids())
  );

-- ============================================
-- DONE
-- ============================================
-- All functions now have proper search_path.
-- All RLS policies now require organization membership (no NULL org access).
--
-- NOTE: Data with NULL organization_id will no longer be accessible via API.
-- Run a migration to assign org_ids to legacy data if needed.
-- ============================================
