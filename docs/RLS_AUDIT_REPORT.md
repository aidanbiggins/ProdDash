# RLS Audit Report

**Date:** 2026-01-16
**Status:** CRITICAL ISSUES FOUND

---

## Executive Summary

The current RLS implementation is over-engineered for the actual use case and has multiple systemic issues causing production bugs. The architecture was designed for a complex multi-tenant SaaS with super-admins, but the actual usage is a single organization with one admin user.

**Root Causes of Recurring Issues:**
1. Migrations exist but aren't applied to production (no CI/CD)
2. Circular dependencies in helper functions
3. Missing `GRANT` statements (RLS enabled but no table access)
4. 15 tables with RLS, 4+ helper functions, 60+ policy rules

---

## Current State: Tables & Policies

### Table Inventory (15 tables with RLS)

| Table | Migration | RLS | GRANTs | Helper Functions Used |
|-------|-----------|-----|--------|----------------------|
| organizations | 001 | ✅ | ❌ Missing | is_super_admin(), user_org_ids() |
| organization_members | 001 | ✅ | ❌ Missing | is_super_admin(), user_org_ids(), is_org_admin() |
| super_admins | 001 | ✅ | ❌ Missing | is_super_admin() ⚠️ CIRCULAR |
| organization_invites | 001 | ✅ | ❌ Missing | is_super_admin(), is_org_admin() |
| requisitions | 001 | ✅ | ❌ Missing | is_super_admin(), user_org_ids(), is_org_admin() |
| candidates | 001 | ✅ | ❌ Missing | is_super_admin(), user_org_ids(), is_org_admin() |
| events | 001 | ✅ | ❌ Missing | is_super_admin(), user_org_ids(), is_org_admin() |
| users | 001 | ✅ | ❌ Missing | is_super_admin(), user_org_ids(), is_org_admin() |
| user_ai_vault | 003 | ✅ | ✅ Implicit | None (simple auth.uid() check) ✅ |
| organization_settings | 004 | ✅ | ✅ Line 85 | is_super_admin(), user_org_ids(), is_org_admin() |
| org_ai_keys | 005 | ✅ | ❌ Missing | is_org_admin_or_super() (duplicate!) |
| data_snapshots | 008 | ✅ | ✅ Line 180 | is_super_admin(), user_org_ids(), is_org_admin() |
| snapshot_candidates | 008 | ✅ | ✅ Line 181 | is_super_admin(), user_org_ids(), is_org_admin() |
| snapshot_requisitions | 008 | ✅ | ✅ Line 182 | is_super_admin(), user_org_ids(), is_org_admin() |
| snapshot_events | 008 | ✅ | ✅ Line 183 | is_super_admin(), user_org_ids(), is_org_admin() |

### Helper Functions (4 functions)

```sql
-- 1. user_org_ids() - Gets user's org memberships
CREATE FUNCTION user_org_ids() RETURNS SETOF UUID AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. is_super_admin() - Checks if user is super admin
CREATE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. is_org_admin(org_id) - Checks if user is org admin
CREATE FUNCTION is_org_admin(org_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid() AND organization_id = org_id AND role = 'admin'
  ) OR is_super_admin()  -- Note: calls is_super_admin()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. is_org_admin_or_super(org_id) - DUPLICATE of is_org_admin()
CREATE FUNCTION is_org_admin_or_super(org_id uuid) RETURNS boolean AS $$
  -- Duplicates is_org_admin() logic
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Critical Issues

### Issue 1: Missing GRANTs (PRODUCTION BUG)

**Symptom:** "permission denied for table users"

**Cause:** Migration 001 enables RLS but never grants table access to the `authenticated` role.

```sql
-- Migration 001 does this:
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select" ON users FOR SELECT USING (...);

-- But NEVER does this:
GRANT SELECT ON users TO authenticated;  -- MISSING!
```

**Affected Tables:** organizations, organization_members, super_admins, organization_invites, requisitions, candidates, events, users, org_ai_keys

**Fix Exists:** Migration 007 adds GRANTs but was **never applied to production**.

---

### Issue 2: Circular Dependency in super_admins

**Symptom:** Query hangs or fails when checking super admin status

**Cause:** The `super_admins` SELECT policy calls `is_super_admin()`, which queries `super_admins`.

```sql
-- Original policy (001):
CREATE POLICY "super_admins_select" ON super_admins
  FOR SELECT USING (is_super_admin());  -- Calls function that queries THIS table!

-- The function:
CREATE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

**Fix Exists:** Migration 007 changes policy to `auth.uid() IS NOT NULL` but was **never applied**.

---

### Issue 3: No CI/CD for Migrations

**Symptom:** Migrations exist in repo but aren't in production

**Current State:**
- 8 migration files in `supabase/migrations/`
- No `supabase link` or `supabase db push` in deploy process
- Manual SQL Editor runs are forgotten

**Evidence:** Migration 007 was created to fix RLS issues but production still has the bug.

---

### Issue 4: Over-Engineering for Actual Use Case

**Designed For:**
- Multiple organizations
- Super admins managing all orgs
- Complex role hierarchy (super_admin > admin > member)
- Invite flow with tokens

**Actual Use:**
- 1 organization ("Acme")
- 1 admin user (you)
- No other members
- No invites sent

**Complexity Cost:**
- 60+ RLS policy rules
- 4 helper functions with SECURITY DEFINER
- 3 role levels
- Invite table with token management

---

### Issue 5: Inconsistent Patterns

Different migrations use different approaches:

```sql
-- Pattern A: Using helpers (001, 004, 008)
FOR SELECT USING (is_super_admin() OR organization_id IN (SELECT user_org_ids()))

-- Pattern B: Inline checks (005)
FOR SELECT USING (
  EXISTS (SELECT 1 FROM organization_members WHERE organization_id = org_ai_keys.organization_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
)

-- Pattern C: Simple direct check (003 - user_ai_vault) ✅ BEST
FOR SELECT USING (auth.uid() = user_id)
```

---

## Actual Usage Analysis

### What the Code Actually Does

| Operation | Service | Tables Accessed |
|-----------|---------|-----------------|
| Login/Auth | AuthContext | organization_members, super_admins |
| View Dashboard | dbService | requisitions, candidates, events, users |
| Import Data | dbService | requisitions, candidates, events, users |
| Org Settings | organizationService | organizations, organization_members, organization_invites |
| AI Keys (User) | userAiVaultService | user_ai_vault |
| AI Keys (Org) | orgAiKeyService | org_ai_keys |
| Config | configService | organization_settings |
| Snapshots | snapshotService | data_snapshots, snapshot_candidates, snapshot_requisitions, snapshot_events |

### Permission Requirements (Actual)

| Operation | Who Needs Access |
|-----------|-----------------|
| Read dashboard data | Any org member |
| Import/modify data | Org admins only |
| Read org settings | Any org member |
| Modify org settings | Org admins only |
| Read/write own AI keys | The key owner |
| Read org AI keys | Any org member |
| Modify org AI keys | Org admins only |

---

## Recommendations

### Option A: Minimal Fix (Quick)

Apply migration 007 to production immediately:

```bash
# In Supabase Dashboard > SQL Editor, run:
# Contents of supabase/migrations/007_fix_rls_permissions.sql
```

**Pros:** Fast, fixes current bugs
**Cons:** Doesn't address complexity, will have more issues

---

### Option B: Simplified RLS (Recommended)

Replace the entire RLS system with a simpler model:

#### 1. Remove Super Admin Concept

Instead of a separate table, use a hardcoded list or app-level check:

```typescript
// In AuthContext.tsx (already exists!)
const SUPER_ADMIN_EMAIL = 'aidanbiggins@gmail.com';
```

Remove `super_admins` table and all `is_super_admin()` calls from policies.

#### 2. Simplify to Two Patterns

**Pattern 1: User-owned data (like user_ai_vault)**
```sql
FOR SELECT USING (auth.uid() = user_id)
FOR INSERT WITH CHECK (auth.uid() = user_id)
FOR UPDATE USING (auth.uid() = user_id)
FOR DELETE USING (auth.uid() = user_id)
```

**Pattern 2: Org-owned data (simplified)**
```sql
-- Helper (single function)
CREATE FUNCTION user_belongs_to_org(org_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid() AND organization_id = org_id
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Policies
FOR SELECT USING (user_belongs_to_org(organization_id))
FOR INSERT WITH CHECK (user_belongs_to_org(organization_id))
FOR UPDATE USING (user_belongs_to_org(organization_id))
FOR DELETE USING (user_belongs_to_org(organization_id))
```

#### 3. Move Admin Checks to Application Layer

Instead of RLS enforcing "only admins can insert", handle this in the service:

```typescript
// organizationService.ts
export async function importData(...) {
  if (userRole !== 'admin') throw new Error('Only admins can import data');
  // proceed with insert
}
```

**Why:** RLS should enforce data isolation, not business logic. Admin-only operations are better handled in code where you can show proper error messages.

#### 4. Consolidate Migrations

Create a single migration that:
1. Drops all existing policies
2. Drops helper functions except `user_belongs_to_org()`
3. Creates simple new policies
4. Adds all GRANTs in one place

---

### Option C: Single-Tenant Mode (Simplest)

If you only ever have one organization:

1. Remove `organization_id` from all data tables
2. Remove all org-related tables except `organization_members` (for role check)
3. Use simple user-based RLS:

```sql
-- All data visible to authenticated users
FOR SELECT USING (auth.uid() IS NOT NULL)
-- Only admins can modify (check in app layer)
```

**Pros:** Maximum simplicity
**Cons:** Rework needed if you add multi-tenant later

---

## Immediate Action Items

### Today (Fix Production)

1. **Apply migration 007** to production via SQL Editor
2. **Verify** org settings modal works after

### This Week (Prevent Recurrence)

3. **Add Supabase CLI to deploy process:**
   ```bash
   # In your deploy script or CI
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

4. **Add RLS smoke test** to catch permission errors before deploy

### Next Sprint (Simplify)

5. **Implement Option B** - Simplified RLS model
6. **Remove super_admin table** - use app-level check
7. **Consolidate policies** - one pattern for all org data

---

## Appendix: Full Policy Audit

<details>
<summary>Click to expand all 60+ policy rules</summary>

### organizations
- `organizations_select`: is_super_admin() OR id IN (SELECT user_org_ids())
- `organizations_insert`: auth.uid() IS NOT NULL
- `organizations_update`: is_org_admin(id)
- `organizations_delete`: is_super_admin()

### organization_members
- `org_members_select`: is_super_admin() OR organization_id IN (SELECT user_org_ids())
- `org_members_insert`: is_super_admin() OR is_org_admin(organization_id)
- `org_members_update`: is_super_admin() OR is_org_admin(organization_id)
- `org_members_delete`: is_super_admin() OR is_org_admin(organization_id)

### super_admins (CIRCULAR!)
- `super_admins_select`: is_super_admin() ← CALLS ITSELF
- `super_admins_all`: is_super_admin()

### organization_invites
- `org_invites_select`: is_super_admin() OR is_org_admin(organization_id) OR email = current_user_email
- `org_invites_insert`: is_super_admin() OR is_org_admin(organization_id)
- `org_invites_delete`: is_super_admin() OR is_org_admin(organization_id)

### requisitions
- `requisitions_select`: is_super_admin() OR organization_id IN (SELECT user_org_ids())
- `requisitions_insert`: is_super_admin() OR is_org_admin(organization_id)
- `requisitions_update`: is_super_admin() OR is_org_admin(organization_id)
- `requisitions_delete`: is_super_admin() OR is_org_admin(organization_id)

### candidates
- `candidates_select`: is_super_admin() OR organization_id IN (SELECT user_org_ids())
- `candidates_insert`: is_super_admin() OR is_org_admin(organization_id)
- `candidates_update`: is_super_admin() OR is_org_admin(organization_id)
- `candidates_delete`: is_super_admin() OR is_org_admin(organization_id)

### events
- `events_select`: is_super_admin() OR organization_id IN (SELECT user_org_ids())
- `events_insert`: is_super_admin() OR is_org_admin(organization_id)
- `events_update`: is_super_admin() OR is_org_admin(organization_id)
- `events_delete`: is_super_admin() OR is_org_admin(organization_id)

### users
- `users_select`: is_super_admin() OR organization_id IN (SELECT user_org_ids())
- `users_insert`: is_super_admin() OR is_org_admin(organization_id)
- `users_update`: is_super_admin() OR is_org_admin(organization_id)
- `users_delete`: is_super_admin() OR is_org_admin(organization_id)

### user_ai_vault ✅ GOOD
- `Users can view own vault entries`: auth.uid() = user_id
- `Users can insert own vault entries`: auth.uid() = user_id
- `Users can update own vault entries`: auth.uid() = user_id
- `Users can delete own vault entries`: auth.uid() = user_id

### organization_settings
- `org_settings_select`: is_super_admin() OR organization_id IN (SELECT user_org_ids())
- `org_settings_insert`: is_super_admin() OR is_org_admin(organization_id)
- `org_settings_update`: is_super_admin() OR is_org_admin(organization_id)
- `org_settings_delete`: is_super_admin()

### org_ai_keys
- `Org members can view org AI keys`: inline member check OR super admin check
- `Admins can insert org AI keys`: is_org_admin_or_super(organization_id)
- `Admins can update org AI keys`: is_org_admin_or_super(organization_id)
- `Admins can delete org AI keys`: is_org_admin_or_super(organization_id)

### data_snapshots
- `snapshots_select`: is_super_admin() OR organization_id IN (SELECT user_org_ids())
- `snapshots_insert`: is_super_admin() OR is_org_admin(organization_id)
- `snapshots_update`: is_super_admin() OR is_org_admin(organization_id)
- `snapshots_delete`: is_super_admin() OR is_org_admin(organization_id)

### snapshot_candidates
- `snap_cand_select`: is_super_admin() OR organization_id IN (SELECT user_org_ids())
- `snap_cand_insert`: is_super_admin() OR is_org_admin(organization_id)
- `snap_cand_update`: is_super_admin() OR is_org_admin(organization_id)
- `snap_cand_delete`: is_super_admin() OR is_org_admin(organization_id)

### snapshot_requisitions
- `snap_req_select`: is_super_admin() OR organization_id IN (SELECT user_org_ids())
- `snap_req_insert`: is_super_admin() OR is_org_admin(organization_id)
- `snap_req_update`: is_super_admin() OR is_org_admin(organization_id)
- `snap_req_delete`: is_super_admin() OR is_org_admin(organization_id)

### snapshot_events
- `snap_events_select`: is_super_admin() OR organization_id IN (SELECT user_org_ids())
- `snap_events_insert`: is_super_admin() OR is_org_admin(organization_id)
- `snap_events_update`: is_super_admin() OR is_org_admin(organization_id)
- `snap_events_delete`: is_super_admin() OR is_org_admin(organization_id)

</details>
