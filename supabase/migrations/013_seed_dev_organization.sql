-- ============================================
-- SEED DEV ORGANIZATION FOR LOCAL DEVELOPMENT
-- ============================================
-- This creates a development organization that can be used with the
-- dev-auth-bypass feature for local testing without real Supabase auth.
--
-- The dev organization uses a well-known UUID that matches the one in
-- AuthContext.tsx when dev-auth-bypass is enabled.
-- ============================================

-- Insert the dev organization (if it doesn't already exist)
INSERT INTO organizations (id, name, slug, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Development',
    'dev',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Note: We don't create organization_members here because:
-- 1. The dev bypass uses service_role which bypasses RLS entirely
-- 2. There's no real auth.uid() to link to in dev bypass mode
