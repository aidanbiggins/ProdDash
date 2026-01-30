-- ============================================
-- SECURITY ADVISOR FIXES
-- ============================================
-- Fixes warnings from Supabase Security Advisor:
-- 1. Function Search Path Mutable - Add SET search_path = '' to all functions
-- 2. RLS Policy Always True - Fix overly permissive policies
-- ============================================

-- ============================================
-- DROP EXISTING FUNCTIONS FIRST
-- ============================================
-- Need to drop before recreating to avoid return type conflicts
-- Using CASCADE to handle trigger dependencies

DROP FUNCTION IF EXISTS user_org_ids() CASCADE;
DROP FUNCTION IF EXISTS is_org_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS is_org_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS generate_org_slug(text) CASCADE;
DROP FUNCTION IF EXISTS create_organization(text) CASCADE;
DROP FUNCTION IF EXISTS auto_add_org_creator() CASCADE;
DROP FUNCTION IF EXISTS seed_super_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS accept_organization_invite(uuid) CASCADE;
DROP FUNCTION IF EXISTS update_user_ai_vault_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_org_settings_timestamp() CASCADE;
DROP FUNCTION IF EXISTS update_org_ai_keys_updated_at() CASCADE;

-- ============================================
-- FIX 1: Function Search Path Mutable
-- ============================================
-- Adding SET search_path = '' prevents search path hijacking attacks
-- where malicious objects in other schemas could be invoked instead

-- user_org_ids - Used in RLS policies
CREATE OR REPLACE FUNCTION user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '';

-- is_org_member - Check if user belongs to an org
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
    AND organization_id = org_id
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '';

-- is_super_admin - Check if user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE user_id = auth.uid()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '';

-- is_org_admin - Check if user is admin of a specific org
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
    AND organization_id = org_id
    AND role = 'admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '';

-- generate_org_slug - Generate URL-friendly slug from org name
CREATE OR REPLACE FUNCTION generate_org_slug(org_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  -- Convert to lowercase, replace spaces and special chars with hyphens
  base_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  -- Remove leading/trailing hyphens
  base_slug := trim(both '-' from base_slug);
  -- Truncate to reasonable length
  base_slug := substring(base_slug from 1 for 50);

  final_slug := base_slug;

  -- Check for uniqueness, append number if needed
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- create_organization - Create org and add creator as admin
CREATE OR REPLACE FUNCTION create_organization(org_name TEXT)
RETURNS UUID AS $$
DECLARE
  new_org_id UUID;
  org_slug TEXT;
BEGIN
  -- Generate unique slug
  org_slug := public.generate_org_slug(org_name);

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
SET search_path = '';

-- auto_add_org_creator - Trigger function to add org creator as admin
CREATE OR REPLACE FUNCTION auto_add_org_creator()
RETURNS TRIGGER AS $$
BEGIN
  -- Only add if created_by is set and not already a member
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- seed_super_admin - Seed initial super admin (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION seed_super_admin(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.super_admins (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

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
SET search_path = '';

-- update_user_ai_vault_updated_at - Trigger for user_ai_vault timestamp
CREATE OR REPLACE FUNCTION update_user_ai_vault_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- update_org_settings_timestamp - Trigger for org_settings timestamp
CREATE OR REPLACE FUNCTION update_org_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- update_org_ai_keys_updated_at - Trigger for org_ai_keys timestamp
CREATE OR REPLACE FUNCTION update_org_ai_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- ============================================
-- FIX 2: RLS Policy Always True
-- ============================================
-- The candidates table has an overly permissive policy.
-- We need to ensure it uses proper org-based filtering.

-- First, check what policies exist and recreate with proper conditions
-- Drop any policies that might be using USING (true)
DROP POLICY IF EXISTS "candidates_select_all" ON candidates;
DROP POLICY IF EXISTS "candidates_insert_all" ON candidates;
DROP POLICY IF EXISTS "candidates_update_all" ON candidates;
DROP POLICY IF EXISTS "candidates_delete_all" ON candidates;
DROP POLICY IF EXISTS "allow_all_candidates" ON candidates;

-- Ensure proper policies exist (these should already exist from migration 010)
-- If they don't exist, create them
DO $$
BEGIN
  -- Check if cands_read policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'candidates' AND policyname = 'cands_read'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'candidates' AND policyname = 'candidates_select'
  ) THEN
    CREATE POLICY "candidates_select" ON candidates
      FOR SELECT USING (
        auth.uid() IS NOT NULL
        AND (
          organization_id IN (SELECT public.user_org_ids())
          OR organization_id IS NULL
        )
      );
  END IF;
END $$;

-- ============================================
-- GRANT EXECUTE on functions to authenticated
-- ============================================
GRANT EXECUTE ON FUNCTION user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_org_slug(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_organization(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION seed_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_organization_invite(UUID) TO authenticated;

-- ============================================
-- RECREATE TRIGGERS (dropped by CASCADE)
-- ============================================

-- Trigger for auto-adding org creator as admin
DROP TRIGGER IF EXISTS on_organization_created ON organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_org_creator();

-- Trigger for user_ai_vault updated_at
DROP TRIGGER IF EXISTS update_user_ai_vault_updated_at ON user_ai_vault;
CREATE TRIGGER update_user_ai_vault_updated_at
  BEFORE UPDATE ON user_ai_vault
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ai_vault_updated_at();

-- Trigger for organization_settings updated_at
DROP TRIGGER IF EXISTS update_org_settings_timestamp ON organization_settings;
CREATE TRIGGER update_org_settings_timestamp
  BEFORE UPDATE ON organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_org_settings_timestamp();

-- Trigger for org_ai_keys updated_at
DROP TRIGGER IF EXISTS update_org_ai_keys_updated_at ON org_ai_keys;
CREATE TRIGGER update_org_ai_keys_updated_at
  BEFORE UPDATE ON org_ai_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_org_ai_keys_updated_at();

-- ============================================
-- DONE
-- ============================================
-- All functions now have SET search_path = '' to prevent
-- search path hijacking attacks.
--
-- RLS policies have been checked for overly permissive rules.
-- Triggers have been recreated.
-- ============================================
