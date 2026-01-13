-- Organization Settings Migration
-- Persists dashboard configuration (benchmarks, stage mappings, weights, etc.) per organization
-- This enables seamless login from anywhere with all settings preserved

-- ============================================
-- 1. CREATE ORGANIZATION SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Config version for migrations
  config_version TEXT NOT NULL DEFAULT '1.0.0',

  -- Full dashboard config as JSONB (flexible schema)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),

  -- One settings row per organization
  UNIQUE(organization_id)
);

-- Create index for org lookup
CREATE INDEX IF NOT EXISTS idx_org_settings_org ON organization_settings(organization_id);

-- ============================================
-- 2. ROW-LEVEL SECURITY
-- ============================================

ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- Select: members can read their org's settings
DROP POLICY IF EXISTS "org_settings_select" ON organization_settings;
CREATE POLICY "org_settings_select" ON organization_settings
  FOR SELECT USING (
    is_super_admin() OR organization_id IN (SELECT user_org_ids())
  );

-- Insert: admins can create settings for their org
DROP POLICY IF EXISTS "org_settings_insert" ON organization_settings;
CREATE POLICY "org_settings_insert" ON organization_settings
  FOR INSERT WITH CHECK (
    is_super_admin() OR is_org_admin(organization_id)
  );

-- Update: admins can update their org's settings
DROP POLICY IF EXISTS "org_settings_update" ON organization_settings;
CREATE POLICY "org_settings_update" ON organization_settings
  FOR UPDATE USING (
    is_super_admin() OR is_org_admin(organization_id)
  );

-- Delete: only super admins can delete settings
DROP POLICY IF EXISTS "org_settings_delete" ON organization_settings;
CREATE POLICY "org_settings_delete" ON organization_settings
  FOR DELETE USING (is_super_admin());

-- ============================================
-- 3. AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_org_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_org_settings_update ON organization_settings;
CREATE TRIGGER on_org_settings_update
  BEFORE UPDATE ON organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_org_settings_timestamp();

-- ============================================
-- 4. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE ON organization_settings TO authenticated;
