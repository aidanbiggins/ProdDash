# Dev-Only Migrations

**WARNING: These migrations are DANGEROUS for production environments.**

This directory contains SQL migrations that should ONLY be applied to local development databases. They disable Row-Level Security (RLS) by using `USING (true)` policies, which would expose all data to all users if applied in production.

## What's Here

| File | Purpose |
|------|---------|
| `014_permissive_rls_for_dev.sql` | Creates permissive RLS policies for dev bypass compatibility |
| `015_fix_rls_policy_conflicts.sql` | Cleans up conflicting policy names with permissive policies |

## Why These Exist

During local development with the dev auth bypass (`REACT_APP_DEV_BYPASS_AUTH=true`), `auth.uid()` returns `NULL`. Strict RLS policies that check `auth.uid()` will block all queries. These permissive policies allow local development to proceed without authentication.

## When to Use

**ONLY apply these migrations when:**
1. Running on `localhost` or `127.0.0.1`
2. Using a local Supabase instance (not cloud)
3. Testing features that require database access without auth

**NEVER apply to:**
- Supabase cloud projects (production, staging, preview)
- Any shared database
- Any database accessible over the network

## How to Apply Locally

```bash
# Using Supabase CLI with local instance
npx supabase db reset  # Reset to clean state first
psql -h localhost -p 54322 -U postgres -d postgres \
  -f supabase/migrations_dev_only/014_permissive_rls_for_dev.sql
psql -h localhost -p 54322 -U postgres -d postgres \
  -f supabase/migrations_dev_only/015_fix_rls_policy_conflicts.sql

# Or via Supabase Studio SQL Editor (local only)
# Navigate to http://localhost:54323 and paste contents
```

## Reverting (Restoring Secure RLS)

To restore proper RLS policies after dev testing, re-run the production migrations:

```bash
npx supabase db reset
npx supabase db push
```

## Security Notice

The normal migration path (`supabase/migrations/`) does NOT include these files. Running `npx supabase db push` or `supabase migration up` will NOT apply these dangerous policies to production.
