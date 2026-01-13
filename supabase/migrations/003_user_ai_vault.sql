-- Migration: Add user_ai_vault table for zero-knowledge API key storage
-- Keys are encrypted client-side with user passphrase before storage
-- Server never sees plaintext API keys

-- Create the user_ai_vault table
CREATE TABLE IF NOT EXISTS user_ai_vault (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'openai_compatible')),
  encrypted_blob jsonb NOT NULL,
  -- encrypted_blob structure:
  -- {
  --   "ciphertext": "<base64>",
  --   "iv": "<base64>",
  --   "salt": "<base64>",
  --   "kdf": { "alg": "pbkdf2", "iterations": 100000, "hash": "SHA-256" },
  --   "alg": { "name": "aes-gcm" }
  -- }
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Each user can only have one key per provider
  UNIQUE (user_id, provider)
);

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_user_ai_vault_user_id ON user_ai_vault(user_id);

-- Enable Row Level Security
ALTER TABLE user_ai_vault ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own vault entries
-- Select policy
CREATE POLICY "Users can view own vault entries"
  ON user_ai_vault
  FOR SELECT
  USING (auth.uid() = user_id);

-- Insert policy
CREATE POLICY "Users can insert own vault entries"
  ON user_ai_vault
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Update policy
CREATE POLICY "Users can update own vault entries"
  ON user_ai_vault
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Delete policy
CREATE POLICY "Users can delete own vault entries"
  ON user_ai_vault
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_ai_vault_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_ai_vault_updated_at
  BEFORE UPDATE ON user_ai_vault
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ai_vault_updated_at();

-- Comment on table for documentation
COMMENT ON TABLE user_ai_vault IS 'Zero-knowledge encrypted storage for user AI provider API keys. Keys are encrypted client-side with user passphrase.';
COMMENT ON COLUMN user_ai_vault.encrypted_blob IS 'Client-encrypted blob containing ciphertext, IV, salt, and encryption metadata. Server cannot decrypt.';
