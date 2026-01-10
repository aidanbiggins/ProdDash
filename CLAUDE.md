# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProdDash is a React + TypeScript Recruiter Productivity Dashboard for recruitment analytics, hiring manager performance tracking, and capacity planning. Data is imported via CSV and persisted to Supabase.

## Commands

```bash
npm start          # Development server (localhost:3000)
npm run build      # Production build
npm test           # Run Jest tests
npm test -- --watchAll=false  # Single test run (CI mode)
```

## Architecture

### Entry Point Flow
```
src/index.js → App.js → AuthProvider → Router
                                         ↓
                            RecruiterProductivityDashboard (/)
                                         ↓
                         DashboardProvider + DataMaskingProvider
                                         ↓
                              ProductivityDashboard
```

### Main Module: `/src/productivity-dashboard/`

The modern dashboard lives here. Legacy components in `/src/components/` are deprecated.

**State Management**: Context + Reducer pattern in `hooks/useDashboardContext.tsx`
- `DashboardProvider` wraps the app and exposes `useDashboard()` hook
- Actions: `IMPORT_DATA`, `SET_FILTERS`, `SELECT_RECRUITER`, `SET_OVERVIEW`, etc.
- State persists to Supabase via `services/dbService.ts`

**Data Flow**:
```
CSV Upload → csvParser.ts → DashboardState → metricsEngine.ts → Components
                                           → hmMetricsEngine.ts
```

**Services** (business logic in `/services/`):
- `csvParser.ts` - CSV parsing and validation
- `metricsEngine.ts` - Recruiter-level metrics calculations
- `hmMetricsEngine.ts` - Hiring manager analytics
- `stageNormalization.ts` - Maps custom stage names to canonical stages
- `complexityScoring.ts` - Hire complexity scoring algorithm
- `dbService.ts` - Supabase persistence

**Types** (`/types/`):
- `entities.ts` - Core domain models: `Requisition`, `Candidate`, `Event`, `User`
- `hmTypes.ts` - HM-specific types: `HMRollup`, `HMLatencyMetrics`
- `metrics.ts` - Filter and metric types

**Tab Components** (`/components/`):
- `OverviewTab` - KPIs and high-level metrics
- `RecruiterDetailTab` - Individual recruiter performance
- `HMFrictionTab` - Hiring manager latency analysis
- `HiringManagersTab` - HM scorecard and action queue
- `QualityTab` - Candidate quality metrics
- `SourceEffectivenessTab` - Source ROI analysis

### Key Patterns

**Canonical Stages**: Raw stage names from CSV are normalized via `stageNormalization.ts` to `CanonicalStage` enum values (LEAD, APPLIED, SCREEN, HM_SCREEN, ONSITE, FINAL, OFFER, HIRED, REJECTED, WITHDRAWN).

**Fact Tables**: Services create enriched/denormalized records (`ReqFact`, `CandidateFact`, `EventFact`) for efficient metric computation.

**Imports**: `tsconfig.json` sets `baseUrl: "src"`, so imports use absolute paths from src (e.g., `import { X } from 'productivity-dashboard/types'`).

### Authentication

Supabase auth with dev bypass: set `localStorage.setItem('dev-auth-bypass', JSON.stringify({user: {id: 'dev', email: 'dev@test.com'}}))` to skip login during development.

### Styling

Swiss Modern design system in `dashboard-theme.css`. Uses Bootstrap 5.3 as base with custom overrides. Fonts: Outfit (display), Plus Jakarta Sans (UI), Inter (body).
