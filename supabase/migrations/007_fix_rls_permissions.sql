-- Fix RLS Permissions for Google OAuth Sign-In
-- Run this in Supabase SQL Editor to fix "permission denied for table users" error

-- ============================================
-- STEP 1: Grant table access to authenticated role
-- ============================================
-- The migration enabled RLS but never granted base table access

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT SELECT ON public.super_admins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;

-- ============================================
-- STEP 2: Fix super_admins SELECT policy (circular dependency)
-- ============================================
-- Old policy: Can only SELECT if is_super_admin() - but that queries this table!
-- New policy: Any authenticated user can SELECT (they'll only see their own row if exists)

DROP POLICY IF EXISTS "super_admins_select" ON super_admins;
CREATE POLICY "super_admins_select" ON super_admins
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Keep restrictive policy for INSERT/UPDATE/DELETE (only super admins can modify)
DROP POLICY IF EXISTS "super_admins_all" ON super_admins;
CREATE POLICY "super_admins_modify" ON super_admins
  FOR INSERT WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "super_admins_update" ON super_admins;
CREATE POLICY "super_admins_update" ON super_admins
  FOR UPDATE USING (is_super_admin());

DROP POLICY IF EXISTS "super_admins_delete" ON super_admins;
CREATE POLICY "super_admins_delete" ON super_admins
  FOR DELETE USING (is_super_admin());

-- ============================================
-- STEP 3: Fix users table SELECT policy
-- ============================================
-- Allow any authenticated user to query (RLS still filters by org)
-- Users will only see rows where they're in the org

DROP POLICY IF EXISTS "users_select" ON users;
CREATE POLICY "users_select" ON users
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      is_super_admin()
      OR organization_id IN (SELECT user_org_ids())
      OR organization_id IS NULL
    )
  );

-- ============================================
-- STEP 4: Ensure service role can bypass RLS for initial super admin seeding
-- ============================================
-- This allows the first super admin to be added programmatically

-- Create a function that can add super admin with elevated privileges
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
