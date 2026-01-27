# Supabase Dev-Only Migrations

This document explains how dev-only migrations are separated from production migrations to prevent security vulnerabilities.

## Background

During local development, the app supports a "dev bypass" mode (`REACT_APP_DEV_BYPASS_AUTH=true`) that allows access without Supabase authentication. However, this means `auth.uid()` returns `NULL`, which breaks Row-Level Security (RLS) policies that rely on user authentication.

To work around this, we have special migrations that create permissive RLS policies (`USING (true)`). These policies are **extremely dangerous** for production because they allow any user to read/write all data.

## Directory Structure

```
supabase/
├── migrations/              # Production-safe migrations (auto-applied by Supabase)
│   ├── 001_multi_tenant.sql
│   ├── ...
│   └── 013_snapshot_tables.sql
│
└── migrations_dev_only/     # DANGEROUS - manual application only
    ├── README.md
    ├── 014_permissive_rls_for_dev.sql
    └── 015_fix_rls_policy_conflicts.sql
```

## Why Separate?

| Concern | Resolution |
|---------|------------|
| Supabase CLI auto-applies `migrations/` | Dev-only files are NOT in this directory |
| CI/CD pipelines run migrations | Only `migrations/` is deployed |
| Developers need permissive policies locally | Can manually apply from `migrations_dev_only/` |
| Production never gets permissive policies | Files physically separated from prod path |

## For Local Development

### Option 1: Use dev bypass with permissive RLS (recommended for solo dev)

```bash
# 1. Start local Supabase
npx supabase start

# 2. Apply dev-only migrations
psql -h localhost -p 54322 -U postgres -d postgres \
  -f supabase/migrations_dev_only/014_permissive_rls_for_dev.sql
psql -h localhost -p 54322 -U postgres -d postgres \
  -f supabase/migrations_dev_only/015_fix_rls_policy_conflicts.sql

# 3. Set env variable
echo "REACT_APP_DEV_BYPASS_AUTH=true" >> .env.local

# 4. Start the app
npm start
```

### Option 2: Use real auth (recommended for testing RLS)

```bash
# 1. Start local Supabase
npx supabase start

# 2. Do NOT apply dev-only migrations
# 3. Do NOT set REACT_APP_DEV_BYPASS_AUTH
# 4. Sign in with a real account via Google or magic link
npm start
```

### Resetting to clean state

```bash
npx supabase db reset  # Wipes local DB and re-applies migrations/ only
```

## For Production

**Do nothing.** Production deployments only run migrations from `supabase/migrations/`. The dev-only directory is explicitly excluded.

## Troubleshooting

### "permission denied for table X" in local dev

You probably haven't applied the dev-only migrations. Apply them:

```bash
psql -h localhost -p 54322 -U postgres -d postgres \
  -f supabase/migrations_dev_only/014_permissive_rls_for_dev.sql
```

### Production has permissive policies

**CRITICAL SECURITY ISSUE.** Someone applied dev-only migrations to production.

1. Immediately run the secure RLS migration to restore proper policies
2. Audit logs for data exposure
3. Review deployment process to prevent recurrence

### How to verify production RLS is secure

```sql
-- Run this in Supabase SQL Editor for your production project
SELECT schemaname, tablename, policyname, permissive, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true';

-- If this returns ANY rows, you have permissive policies that need fixing!
```

## Files Reference

### 014_permissive_rls_for_dev.sql

Creates `USING (true)` policies for:
- `super_admins`, `users`, `requisitions`, `candidates`, `events`
- `snapshots`, `data_snapshots`, `snapshot_candidates`, `snapshot_requisitions`, `snapshot_events`

### 015_fix_rls_policy_conflicts.sql

Extends permissive policies to:
- `organization_members`, `organizations`
- `user_ai_vault`, `organization_settings`, `organization_invites`

Both files drop existing policies before creating permissive ones to avoid conflicts.
