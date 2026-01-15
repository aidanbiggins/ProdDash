-- Migration: Add organization-level AI keys and simplify user AI key storage
-- Removes client-side encryption requirement, stores keys directly (encrypted at rest by Supabase)
-- Adds org_ai_keys table for organization-wide API keys (admin only)

-- ============================================
-- 1. Create org_ai_keys table
-- ============================================
CREATE TABLE IF NOT EXISTS org_ai_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'openai_compatible')),
  api_key text NOT NULL,
  model text, -- Optional: default model for this provider
  base_url text, -- For openai_compatible providers
  set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Each org can only have one key per provider
  UNIQUE (organization_id, provider)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_ai_keys_org_id ON org_ai_keys(organization_id);

-- Enable Row Level Security
ALTER TABLE org_ai_keys ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is org admin or super admin
CREATE OR REPLACE FUNCTION is_org_admin_or_super(org_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Check if super admin
  IF EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()) THEN
    RETURN true;
  END IF;

  -- Check if org admin
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for org_ai_keys

-- Select: Org members can view (to use the key)
CREATE POLICY "Org members can view org AI keys"
  ON org_ai_keys
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = org_ai_keys.organization_id
      AND user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

-- Insert: Only admins can add
CREATE POLICY "Admins can insert org AI keys"
  ON org_ai_keys
  FOR INSERT
  WITH CHECK (is_org_admin_or_super(organization_id));

-- Update: Only admins can update
CREATE POLICY "Admins can update org AI keys"
  ON org_ai_keys
  FOR UPDATE
  USING (is_org_admin_or_super(organization_id))
  WITH CHECK (is_org_admin_or_super(organization_id));

-- Delete: Only admins can delete
CREATE POLICY "Admins can delete org AI keys"
  ON org_ai_keys
  FOR DELETE
  USING (is_org_admin_or_super(organization_id));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_org_ai_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER org_ai_keys_updated_at
  BEFORE UPDATE ON org_ai_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_org_ai_keys_updated_at();

-- ============================================
-- 2. Modify user_ai_vault to store keys directly
-- ============================================

-- Add new column for direct API key storage
ALTER TABLE user_ai_vault ADD COLUMN IF NOT EXISTS api_key text;
ALTER TABLE user_ai_vault ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE user_ai_vault ADD COLUMN IF NOT EXISTS base_url text;

-- Make encrypted_blob nullable (for backwards compatibility during transition)
ALTER TABLE user_ai_vault ALTER COLUMN encrypted_blob DROP NOT NULL;

-- ============================================
-- 3. Documentation
-- ============================================
COMMENT ON TABLE org_ai_keys IS 'Organization-level AI provider API keys. Set by admins, available to all org members.';
COMMENT ON COLUMN org_ai_keys.api_key IS 'API key for the AI provider. Encrypted at rest by Supabase.';
COMMENT ON COLUMN org_ai_keys.set_by IS 'User who set this API key (for audit trail).';

COMMENT ON COLUMN user_ai_vault.api_key IS 'Direct API key storage (no client-side encryption). Encrypted at rest by Supabase.';
COMMENT ON COLUMN user_ai_vault.encrypted_blob IS 'DEPRECATED: Legacy encrypted blob. New keys use api_key column directly.';
