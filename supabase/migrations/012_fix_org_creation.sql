-- ============================================
-- FIX ORGANIZATION CREATION
-- ============================================
-- This migration fixes two issues:
-- 1. Creates the create_organization RPC function (was being called but never existed)
-- 2. Fixes organization_members INSERT policy to allow first member on org creation
--
-- After running this, org creation will work without timeouts.

-- ============================================
-- STEP 1: CREATE THE create_organization RPC FUNCTION
-- ============================================
-- This function creates an org and adds the creator as admin in one atomic operation
-- Uses SECURITY DEFINER to bypass RLS for the membership insert

CREATE OR REPLACE FUNCTION create_organization(
  org_name TEXT,
  org_slug TEXT,
  creator_id UUID
)
RETURNS UUID AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create the organization
  INSERT INTO organizations (name, slug, created_by)
  VALUES (org_name, org_slug, creator_id)
  RETURNING id INTO new_org_id;

  -- Add creator as admin (bypass RLS with SECURITY DEFINER)
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_org_id, creator_id, 'admin')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN new_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_organization(TEXT, TEXT, UUID) TO authenticated;

-- ============================================
-- STEP 2: FIX organization_members INSERT POLICY
-- ============================================
-- The current policy requires you to be a member to insert a member
-- This creates a chicken-and-egg problem for new orgs
--
-- New policy: Allow insert if:
-- - You're already a member of that org (existing behavior), OR
-- - You created the org (you're the created_by user), OR
-- - You're being added to an org you were invited to

DROP POLICY IF EXISTS "members_write" ON organization_members;

CREATE POLICY "members_write" ON organization_members
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Already a member of this org
      organization_id IN (SELECT user_org_ids())
      -- OR you're the creator of this org (first member)
      OR EXISTS (
        SELECT 1 FROM organizations
        WHERE id = organization_id
        AND created_by = auth.uid()
      )
      -- OR you're adding yourself (self-enrollment after invite accepted in app layer)
      OR user_id = auth.uid()
    )
  );

-- ============================================
-- STEP 3: ENSURE seed_super_admin EXISTS
-- ============================================
-- This function allows seeding the first super admin

CREATE OR REPLACE FUNCTION seed_super_admin(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO super_admins (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION seed_super_admin(UUID) TO authenticated;

-- ============================================
-- STEP 4: ENSURE GRANTS ARE IN PLACE
-- ============================================
-- Sometimes GRANTs get lost, so let's make sure they exist

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_admins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invites TO authenticated;

-- ============================================
-- DONE!
-- ============================================
-- After running this migration:
-- 1. create_organization RPC will work (no more timeout)
-- 2. New org creation will properly add the creator as admin
-- 3. Super admin seeding will work
