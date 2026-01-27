# CI Sanity Check

This document describes how to verify that a fresh clone of the repository will build and run correctly.

## Fresh Clone Verification Steps

Run these commands to simulate a fresh clone environment:

```bash
# 1. Clean all untracked and ignored files (DESTRUCTIVE - removes node_modules, build, etc.)
git clean -xfd

# 2. Install dependencies from lockfile
npm ci

# 3. Run tests
npm test -- --watchAll=false

# 4. Build production bundle
npm run build

# 5. Run UI audits
npm run ui:theme-audit
npm run ui:legacy-audit
```

## Expected Results

All commands should complete without errors:

| Command | Expected Output |
|---------|----------------|
| `npm ci` | Dependencies installed from lockfile |
| `npm test -- --watchAll=false` | All test suites pass (65+ suites, 1300+ tests) |
| `npm run build` | "Compiled successfully" with bundle sizes |
| `npm run ui:theme-audit` | "No theme violations found!" |
| `npm run ui:legacy-audit` | "All legacy imports are approved." |

## Common Issues

### Missing `_legacy/` folder
If imports fail with "Module not found: Can't resolve '../_legacy/...'", ensure the `_legacy/` folder is tracked in git:

```bash
git add src/productivity-dashboard/components/_legacy/
```

### Missing audit scripts
If `npm run ui:theme-audit` or `npm run ui:legacy-audit` fails with "script not found", ensure the scripts are tracked:

```bash
git add scripts/theme-audit.js scripts/legacy-audit.js
```

## CI Pipeline Gates

The following commands are run in CI and must pass:

1. `npm test -- --watchAll=false` - Unit tests
2. `npm run build` - Production build
3. `npm run ui:style-audit` - Style audit
4. `npm run ui:no-bootstrap` - Bootstrap audit
5. `npm run ui:theme-audit` - Theme audit
6. `npm run ui:legacy-audit` - Legacy import audit

## When to Run This Check

Run the full sanity check before:
- Pushing to main branch
- Creating a pull request
- After major refactoring (e.g., moving files)
