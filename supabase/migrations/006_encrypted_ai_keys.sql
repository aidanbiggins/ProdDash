-- Migration: Add server-side encrypted API key storage
-- API keys are encrypted by ai-vault-crypto Edge Function using AES-GCM
-- Master encryption key is stored in Supabase Edge Function secrets
-- Client never has access to the encryption key

-- ============================================
-- 1. Add encrypted_key column to user_ai_vault
-- ============================================

ALTER TABLE user_ai_vault ADD COLUMN IF NOT EXISTS encrypted_key jsonb;
-- encrypted_key structure:
-- {
--   "ciphertext": "<base64>",
--   "iv": "<base64>",
--   "version": 1
-- }

COMMENT ON COLUMN user_ai_vault.encrypted_key IS 'Server-side encrypted API key blob (AES-GCM). Encrypted by ai-vault-crypto Edge Function.';

-- Mark api_key column as deprecated (will be removed in future migration)
COMMENT ON COLUMN user_ai_vault.api_key IS 'DEPRECATED: Plaintext API key. Use encrypted_key instead.';

-- ============================================
-- 2. Add encrypted_key column to org_ai_keys
-- ============================================

ALTER TABLE org_ai_keys ADD COLUMN IF NOT EXISTS encrypted_key jsonb;

COMMENT ON COLUMN org_ai_keys.encrypted_key IS 'Server-side encrypted API key blob (AES-GCM). Encrypted by ai-vault-crypto Edge Function.';

-- Make api_key column nullable (migration step - new keys will use encrypted_key)
ALTER TABLE org_ai_keys ALTER COLUMN api_key DROP NOT NULL;

-- Mark api_key column as deprecated
COMMENT ON COLUMN org_ai_keys.api_key IS 'DEPRECATED: Plaintext API key. Use encrypted_key instead.';

-- ============================================
-- 3. Documentation
-- ============================================

COMMENT ON TABLE user_ai_vault IS 'User AI provider API keys. Keys are encrypted server-side using ai-vault-crypto Edge Function.';
COMMENT ON TABLE org_ai_keys IS 'Organization-level AI provider API keys. Keys are encrypted server-side. Set by admins, available to all org members.';
