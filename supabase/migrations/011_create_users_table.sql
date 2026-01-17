-- ============================================
-- CREATE USERS TABLE (Recruiting Users)
-- ============================================
-- This table stores recruiting team users (HMs, Recruiters, etc.)
-- NOT to be confused with auth.users (Supabase auth)
--
-- The migrations assumed this table existed but never created it.
-- This migration creates it with the correct schema.

-- Create the users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  team TEXT,
  manager_user_id TEXT,
  email TEXT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for organization lookups
CREATE INDEX IF NOT EXISTS idx_users_organization ON public.users(organization_id);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;

-- RLS Policies (matching the simplified architecture from 009)
DROP POLICY IF EXISTS "users_read" ON public.users;
DROP POLICY IF EXISTS "users_write" ON public.users;
DROP POLICY IF EXISTS "users_modify" ON public.users;
DROP POLICY IF EXISTS "users_remove" ON public.users;

CREATE POLICY "users_read" ON public.users
  FOR SELECT USING (
    organization_id IN (SELECT user_org_ids())
    OR organization_id IS NULL
  );

CREATE POLICY "users_write" ON public.users
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "users_modify" ON public.users
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "users_remove" ON public.users
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- Add comment for documentation
COMMENT ON TABLE public.users IS 'Recruiting team users (HMs, Recruiters) - not auth users';
