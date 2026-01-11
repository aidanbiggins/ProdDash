-- Multi-Tenant Organization Architecture Migration
-- This migration adds organization-based data isolation with role-based access control

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CREATE NEW TABLES
-- ============================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ DEFAULT NULL  -- Soft delete for compliance
);

-- Organization memberships (many-to-many user <-> org)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Super admins (platform-level administrators)
CREATE TABLE IF NOT EXISTS super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization invites (for invite flow)
CREATE TABLE IF NOT EXISTS organization_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ DEFAULT NULL
);

-- Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON organization_invites(token);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON organization_invites(email);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- ============================================
-- 2. ADD ORGANIZATION_ID TO EXISTING TABLES
-- ============================================

-- Add organization_id column to all data tables (nullable initially for migration)
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Create indexes for efficient org-based queries
CREATE INDEX IF NOT EXISTS idx_requisitions_org ON requisitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_candidates_org ON candidates(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_org ON events(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);

-- ============================================
-- 3. HELPER FUNCTIONS FOR RLS
-- ============================================

-- Function to get current user's organization IDs
CREATE OR REPLACE FUNCTION user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if current user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = auth.uid()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if user is admin of a specific org
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
    AND organization_id = org_id
    AND role = 'admin'
  ) OR is_super_admin()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to generate URL-safe slug from name
CREATE OR REPLACE FUNCTION generate_org_slug(org_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove non-alphanumeric
  base_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- Ensure slug is not empty
  IF base_slug = '' THEN
    base_slug := 'org';
  END IF;

  final_slug := base_slug;

  -- Check for uniqueness, append number if needed
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter::TEXT;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. ROW-LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Organizations policies
DROP POLICY IF EXISTS "organizations_select" ON organizations;
CREATE POLICY "organizations_select" ON organizations
  FOR SELECT USING (
    is_super_admin() OR id IN (SELECT user_org_ids())
  );

DROP POLICY IF EXISTS "organizations_insert" ON organizations;
CREATE POLICY "organizations_insert" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "organizations_update" ON organizations;
CREATE POLICY "organizations_update" ON organizations
  FOR UPDATE USING (is_org_admin(id));

DROP POLICY IF EXISTS "organizations_delete" ON organizations;
CREATE POLICY "organizations_delete" ON organizations
  FOR DELETE USING (is_super_admin());

-- Organization members policies
DROP POLICY IF EXISTS "org_members_select" ON organization_members;
CREATE POLICY "org_members_select" ON organization_members
  FOR SELECT USING (
    is_super_admin() OR organization_id IN (SELECT user_org_ids())
  );

DROP POLICY IF EXISTS "org_members_insert" ON organization_members;
CREATE POLICY "org_members_insert" ON organization_members
  FOR INSERT WITH CHECK (
    is_super_admin() OR is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "org_members_update" ON organization_members;
CREATE POLICY "org_members_update" ON organization_members
  FOR UPDATE USING (
    is_super_admin() OR is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "org_members_delete" ON organization_members;
CREATE POLICY "org_members_delete" ON organization_members
  FOR DELETE USING (
    is_super_admin() OR is_org_admin(organization_id)
  );

-- Super admins policies (only super admins can see/modify)
DROP POLICY IF EXISTS "super_admins_select" ON super_admins;
CREATE POLICY "super_admins_select" ON super_admins
  FOR SELECT USING (is_super_admin());

DROP POLICY IF EXISTS "super_admins_all" ON super_admins;
CREATE POLICY "super_admins_all" ON super_admins
  FOR ALL USING (is_super_admin());

-- Organization invites policies
DROP POLICY IF EXISTS "org_invites_select" ON organization_invites;
CREATE POLICY "org_invites_select" ON organization_invites
  FOR SELECT USING (
    is_super_admin()
    OR is_org_admin(organization_id)
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "org_invites_insert" ON organization_invites;
CREATE POLICY "org_invites_insert" ON organization_invites
  FOR INSERT WITH CHECK (
    is_super_admin() OR is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "org_invites_delete" ON organization_invites;
CREATE POLICY "org_invites_delete" ON organization_invites
  FOR DELETE USING (
    is_super_admin() OR is_org_admin(organization_id)
  );

-- Requisitions policies
DROP POLICY IF EXISTS "requisitions_select" ON requisitions;
CREATE POLICY "requisitions_select" ON requisitions
  FOR SELECT USING (
    is_super_admin() OR organization_id IN (SELECT user_org_ids())
  );

DROP POLICY IF EXISTS "requisitions_insert" ON requisitions;
CREATE POLICY "requisitions_insert" ON requisitions
  FOR INSERT WITH CHECK (
    is_super_admin() OR is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "requisitions_update" ON requisitions;
CREATE POLICY "requisitions_update" ON requisitions
  FOR UPDATE USING (
    is_super_admin() OR is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "requisitions_delete" ON requisitions;
CREATE POLICY "requisitions_delete" ON requisitions
  FOR DELETE USING (
    is_super_admin() OR is_org_admin(organization_id)
  );

-- Candidates policies
DROP POLICY IF EXISTS "candidates_select" ON candidates;
CREATE POLICY "candidates_select" ON candidates
  FOR SELECT USING (
    is_super_admin() OR organization_id IN (SELECT user_org_ids())
  );

DROP POLICY IF EXISTS "candidates_insert" ON candidates;
CREATE POLICY "candidates_insert" ON candidates
  FOR INSERT WITH CHECK (
    is_super_admin() OR is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "candidates_update" ON candidates;
CREATE POLICY "candidates_update" ON candidates
  FOR UPDATE USING (
    is_super_admin() OR is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "candidates_delete" ON candidates;
CREATE POLICY "candidates_delete" ON candidates
  FOR DELETE USING (
    is_super_admin() OR is_org_admin(organization_id)
  );

-- Events policies
DROP POLICY IF EXISTS "events_select" ON events;
CREATE POLICY "events_select" ON events
  FOR SELECT USING (
    is_super_admin() OR organization_id IN (SELECT user_org_ids())
  );

DROP POLICY IF EXISTS "events_insert" ON events;
CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (
    is_super_admin() OR is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "events_update" ON events;
CREATE POLICY "events_update" ON events
  FOR UPDATE USING (
    is_super_admin() OR is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "events_delete" ON events;
CREATE POLICY "events_delete" ON events
  FOR DELETE USING (
    is_super_admin() OR is_org_admin(organization_id)
  );

-- Users (recruiters/HMs) policies
DROP POLICY IF EXISTS "users_select" ON users;
CREATE POLICY "users_select" ON users
  FOR SELECT USING (
    is_super_admin() OR organization_id IN (SELECT user_org_ids())
  );

DROP POLICY IF EXISTS "users_insert" ON users;
CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (
    is_super_admin() OR is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "users_update" ON users;
CREATE POLICY "users_update" ON users
  FOR UPDATE USING (
    is_super_admin() OR is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "users_delete" ON users;
CREATE POLICY "users_delete" ON users
  FOR DELETE USING (
    is_super_admin() OR is_org_admin(organization_id)
  );

-- ============================================
-- 5. TRIGGER FOR AUTO-MEMBERSHIP ON ORG CREATE
-- ============================================

-- When a user creates an org, automatically make them an admin
CREATE OR REPLACE FUNCTION auto_add_org_creator()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_org_created ON organizations;
CREATE TRIGGER on_org_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  WHEN (NEW.created_by IS NOT NULL)
  EXECUTE FUNCTION auto_add_org_creator();

-- ============================================
-- 6. DATA MIGRATION (Run after tables exist)
-- ============================================
-- This section should be run manually after reviewing existing data

-- Example: Create a default organization and migrate existing data
-- UNCOMMENT AND MODIFY the section below after reviewing your data

/*
-- Step 1: Create default organization
INSERT INTO organizations (id, name, slug, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Organization',
  'default',
  NOW()
);

-- Step 2: Migrate existing data to default org
UPDATE requisitions SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE candidates SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE events SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE users SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- Step 3: Add existing auth users to default org as admins
INSERT INTO organization_members (organization_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', id, 'admin'
FROM auth.users
ON CONFLICT DO NOTHING;

-- Step 4: Make organization_id NOT NULL after migration
ALTER TABLE requisitions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE candidates ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE events ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;
*/

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================

-- Grant usage on functions to authenticated users
GRANT EXECUTE ON FUNCTION user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_org_slug(TEXT) TO authenticated;
