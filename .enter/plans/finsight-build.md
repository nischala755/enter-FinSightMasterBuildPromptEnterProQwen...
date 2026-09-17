# FinSight — Build Plan (Enter Cloud + Qwen Edition)

## Build status — DONE (2026-09-17)

All phases completed: design system, 10 interactive screens, calibrated deterministic engine (health 78, cash ₹4.82 Cr, 90-day ₹2.17 Cr, exposure ₹64L, breach day 52, leakage ₹38.4L, at-risk ₹28.6L), Trace Cause + Simulator signature features, end-to-end approve→audit chain, Enter Cloud Postgres persistence (workflows/audit/leaks) with in-memory fallback, Qwen live via deployed `qwen-ask` (Qwen 3.6 Plus, OpenAI-compatible protocol, verified with a live call) with Demo Intelligence fallback, EnterPro stateful mock wired through the app, demo walkthrough, and 22 tests. Remaining: 7 non-blocking lint warnings (react-refresh/exhaustive-deps); analyst session history is in-memory; auth/roles out of scope.

## Context

We are building **FinSight**, a fully working financial early-warning & intervention system for the fictional company **Northstar Commerce** (INR), on Enter. The revised master prompt (source of truth) defines 10 screens, two signature features (Trace Cause causal graph, Crisis Simulator), a deterministic engine, Qwen as reasoning layer, EnterPro as a **stateful mock** (no real credentials exist), and a Definition of Done: every number traceable to seed data or a deterministic calculation, no dead ends, no placeholders.

**Platform architecture (already aligned with the revised spec):**
- Frontend = React + Vite + Tailwind + TS. Backend = **Enter Cloud only**: managed Postgres for all persisted entities, Deno backend functions for anything server-side (Qwen call, seeding, any untrusted write). No Node/Express/Prisma.
- **Authoritative store = Enter Cloud Postgres.** Workflows, approvals, audit events, transactions, vendors are real rows — refreshing the page or a second viewer sees real current status. No in-memory-only frontend store for these.
- Build order per §11: frontend/domain first with seed data (behind a `DataAccess` interface), then wire Postgres, then Qwen + EnterPro, then polish, then demo trigger. In Phase 1 the `DataAccess` interface is backed by an in-memory adapter over the seed so every screen is interactive day one; Phase 4 swaps that adapter for Enter Cloud with zero component changes.
- The demo walkthrough must run without any **external** service — Qwen has a deterministic fallback; EnterPro is a mock. Enter Cloud is platform infra (always reachable in preview), so Postgres-backed data is fine; DB fetch failures render proper error states with retry.
- i18n plumbing stays untouched; FinSight UI is English-only.
- Testing: template has no test runner → add **Vitest** + **@testing-library/react** (jsdom) for the approve-workflow chain and key interactions.
- Design: light-first "financial terminal" — warm off-white canvas, charcoal text, near-black inset panels, restrained green/amber/red, one sparse accent. No purple/blue AI gradients, no glassmorphism, no robot icons. Inter + JetBrains Mono bundled locally via `@fontsource` (works offline). Tabular numerals for figures, mono for IDs/audit.

## Architecture

```
src/
  components/   AppShell, Sidebar, Header, MetricCard, HealthGauge, RiskCard,
                CausalGraph, TraceCauseDrawer, ExplainabilityDrawer, ForecastChart,
                ScenarioControls, WorkflowTimeline, AuditTable, EvidenceDrawer, …
  pages/        Overview, RiskRadar, MoneyLeaks, CashForecast, Simulator,
                Transactions, Vendors, Workflows, Analyst, AuditTrail
  domain/       types.ts, format.ts, engine.ts (pure deterministic math, source of
                numeric truth), seed.ts (embedded copy of seed dataset for tests/fallback)
  services/     data.ts  (DataAccess interface + Postgres adapter via React Query)
                qwen.ts  (calls qwen-ask backend function + deterministic fallback)
                enterpro.ts (stateful mock behind one interface; persists to Postgres)
  hooks/        useFinSight.ts (React Query hooks over DataAccess)
  lib/          utils (cn)
```

- **`domain/engine.ts`** — pure functions, the only source of numeric truth: `computeFinancialHealth` (with point-by-point breakdown), `forecastCash(caseType)` (90-day series vs min-safe ₹1.25 Cr + breach date), `scoreRisk`, `runScenario`, `findOptimalIntervention` (predefined strategy set), `detectLeaks` (categories), `detectDuplicateInvoices` (INV-48291), `detectVendorPriceCreep` (V-019), causal chains, `citeEvidence` (real invoice/vendor/PO IDs). Runs in the frontend; Qwen only reasons over numbers the engine hands it.
- **Seed dataset (canonical, shared)** — a single JSON/TS source of Northstar data (invoices, payments, POs, vendors, receivables, cash history, risks, workflows, audit events) **calibrated by construction** so the engine reproduces: current cash ₹4.82 Cr, 90-day forecast ₹2.17 Cr, at-risk capital ₹28.4L, recoverable leakage ₹38.4L, health 78/100, liquidity exposure ≈₹64L, breach ≈52 days, min safe ₹1.25 Cr. Deliberate patterns: INV-48291 duplicate, V-019 price creep, Aster Retail aging, rising inventory spend, one cross-domain risk. Same dataset used by the seed backend function and the frontend adapter — one source, no drift. Never labeled "fake" in UI.
- **`services/data.ts`** — typed interface: `getInvoices/getPayments/getPos/getVendors/getWorkflows/getAuditEvents/getCashHistory/getRisks/updateWorkflow/approveWorkflow/insertAuditEvent/createWorkflowFromLeak/…`. Components consume React Query hooks only; the Phase-4 swap to Postgres is invisible to them.
- **`services/enterpro.ts`** — interface: `createApproval, holdPayment, createInvestigation, assignFinanceTask, notifyStakeholder, createVendorReview, createCollectionsTask`. Stateful mock: writes workflow + audit rows to Postgres through `data.ts` (or a backend function if the enter_cloud skill shows that's the safer pattern). Status `Detected → Investigating → Awaiting Approval → Approved → Executed` persisted. Swappable for a real HTTP client later with no changes outside this module.

## Backend design (Enter Cloud)

- **Postgres schema** (created after loading the `enter_cloud` skill, per its migration/RLS conventions): `customers, vendors, invoices, payments, purchase_orders, expenses, subscriptions, receivables, cash_balances, risks, workflows, workflow_events, audit_events`. RLS: demo-appropriate anon access (auth/roles explicitly out of scope unless the core loop is solid first).
- **Backend function `finsight-seed`** — idempotent upsert of the canonical Northstar dataset so a fresh environment and every visitor sees the same state.
- **Backend function `qwen-ask`** — reads secrets `QWEN_API_KEY`/`QWEN_BASE_URL`/`QWEN_MODEL` (added via `supabase_add_secret`, never bundled to the browser); accepts a mode param (`askFinancialQuestion | explainRisk | investigateAnomaly | generateRecommendation | explainScenario`) plus the pre-computed evidence/metrics from the frontend; calls the OpenAI-compatible chat-completions endpoint; returns a structured answer (plain-language answer, metrics used, evidence citations, confidence, recommended actions, limitations); Zod validation in/out. If secrets are absent or the call fails → the frontend uses deterministic templated answers from `src/domain/` with a small "Demo Intelligence Mode" indicator.

## Implementation checklist

- [ ] **Phase 0 — Scaffolding & design system**
  - [ ] Add deps: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`.
  - [ ] Load `frontend-design` skill; extend `src/index.css` + `tailwind.config.ts` with FinSight tokens (canvas/ink/near-black panels, semantic pos/neg/warn/danger, one accent, tabular-nums, mono fonts).
  - [ ] Create folder structure; extend `src/router.tsx` with 10 routes (overview → `/`, risk-radar, money-leaks, cash-forecast, simulator, transactions, vendors, workflows, ai-analyst, audit-trail). Replace the template hero in `src/pages/Index.tsx` with AppShell + Overview.
  - [ ] Implement `src/domain/{types,format,engine}.ts` + canonical seed dataset + `src/services/data.ts` with an in-memory seed-backed adapter + `src/hooks/useFinSight.ts` (React Query hooks).
  - [ ] Build `AppShell`, `Sidebar` (fixed left nav, exactly the 10 items in order), `Header` (company, cash chip, Demo Intelligence Mode indicator, demo-walkthrough trigger).
  - [ ] Add `vitest.config.ts` + `test` script; first engine tests (health = 78, breach ~52 days, leakage ≈ ₹38.4L).
  - [ ] Green: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm run build`.

- [ ] **Phase 1 — All 10 screens interactive from day one** (every button real, all loading/error/empty states)
  - [ ] **Overview**: HealthGauge (78, explainable), current cash ₹4.82 Cr, 90-day forecast, at-risk capital, recoverable leakage, 3–5 Emerging Risk cards (level/impact/horizon), AI briefing (fallback first, clearly labeled AI-generated).
  - [ ] **Risk Radar**: risk list with level/impact/probability/confidence/horizon/drivers/evidence/action; **Trace Cause** → animated causal graph highlighting nodes in sequence with real evidence links; explainability drawer with point-by-point score contribution.
  - [ ] **Money Leaks**: total + category breakdown; each item expands (why detected, evidence, baseline comparison, confidence) with **"Recover this value"** → creates a real Workflow + audit event.
  - [ ] **Cash Forecast**: hero chart = 30/60/90-day forecast vs min-safe ₹1.25 Cr with **projected breach date**; Base/Downside/Upside toggle; key drivers; "forecast is an estimate" disclaimer.
  - [ ] **Simulator**: sliders (revenue change, receivables delay, vendor cost change, discretionary/inventory spend) → Baseline vs Scenario vs Scenario+Recommended-Intervention, **deterministic**; "Find optimal intervention" ranks the predefined strategy set by impact/risk/complexity.
  - [ ] **Transactions**: seeded invoices/payments/POs (~50 rows), filter by type/status + search + expandable evidence links.
  - [ ] **Vendors**: list with pricing-history sparkline, flags (price creep, bank-detail change), links back to risks/leaks.
  - [ ] **Workflows**: full state machine `Detected → Investigating → Awaiting Approval → Approved → Executed`; **approve chain works end-to-end**: status → Approved, approver recorded, audit event created, UI updates immediately.
  - [ ] **AI Analyst**: analyst-workstation layout (not chat bubbles); preset prompt chips populate + submit; answers include plain-language answer, metrics used, evidence citations (real IDs), confidence, recommended actions, limitations; says "insufficient evidence" rather than guessing.
  - [ ] **Audit Trail**: every workflow/risk/approval action → one entry (timestamp, actor, action, reason, evidence, risk ID, workflow ID, approval state, outcome); filterable.
  - [ ] Green: lint, tsc, tests, build.

- [ ] **Phase 2 — Financial model tightening**
  - [ ] Every score/forecast explainable (point-by-point contribution drawer), deterministic, no guaranteed-forecast language; visual distinction Observed / Calculated / Forecast / AI-recommendation throughout.
  - [ ] Engine tests: health calc, cash forecasting, risk scoring, scenario simulation, duplicate detection, vendor price detection, leakage totals, workflow transitions, audit creation, AI fallback mode.

- [ ] **Phase 3 — Wire Enter Cloud Postgres** (load `enter_cloud` skill first)
  - [ ] Define schema + RLS for all persisted entities; create tables via the skill's migration mechanism.
  - [ ] Backend function `finsight-seed`: idempotent upsert of the canonical dataset (from the shared seed source).
  - [ ] Replace the in-memory adapter in `services/data.ts` with the Postgres adapter (`@supabase/supabase-js`, already in deps); components unchanged; add DB error/loading/empty handling.
  - [ ] Verify: refresh persistence, second-viewer consistency, seed idempotency.

- [ ] **Phase 4 — Wire Qwen + EnterPro mock**
  - [ ] `supabase_enable` then `enable_ai_capability`; load `enter_llm_integration` skill; follow its model-selection workflow; store `QWEN_API_KEY`/`QWEN_BASE_URL`/`QWEN_MODEL` via `supabase_add_secret` (Qwen is external — function calls its OpenAI-compatible endpoint).
  - [ ] Backend function `qwen-ask` (modes, Zod validation, structured response); `src/services/qwen.ts` wrapper + deterministic fallback; Demo Intelligence Mode indicator reflects live vs fallback.
  - [ ] `src/services/enterpro.ts` stateful mock persisted via `data.ts` (workflows + audit rows); UI shows AI-flagged risk/leak → concrete workflow with persisted status.
  - [ ] Optional: auth/roles only if core loop is already fully solid — otherwise skip.

- [ ] **Phase 5 — Polish + demo trigger + delivery**
  - [ ] Design self-audit vs spec §8 checklist; fix repetitive cards, over-rounded corners, unnecessary gradients, weak hierarchy, decorative elements.
  - [ ] **"Demo Scenario" trigger**: guided walkthrough of §11.7 sequence (Overview → Liquidity risk → Trace Cause → evidence → AI Analyst → Simulator revenue −15% → optimal intervention → EnterPro workflow → Money Leaks → recover one item → Audit Trail), works with no external service, step list + auto-navigation.
  - [ ] Subtle load animations on figures, causal-graph node highlight, evidence drawers.
  - [ ] Final green: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm run build`.
  - [ ] Deliver short honest limitations list.

## Verification checklist

- [ ] **Positive**: demo walkthrough runs start-to-finish with no external service; approving a workflow shows status Approved, approver, audit event, immediate UI update — and persists across refresh; simulator outputs change deterministically with sliders; AI Analyst answers cite real IDs; seeded data appears identical on a second load (idempotent seed).
- [ ] **Negative/default**: Qwen unreachable → full app functionality in fallback mode with "Demo Intelligence Mode" indicator; DB fetch failure → error state with retry; empty filters show empty states; search finds seeded transactions.
- [ ] **Boundary**: forecast breaches ₹1.25 Cr at ~52 days in Base case; leakage ≈ ₹38.4L; health = 78/100; INR formatting (₹, lakhs/crores) consistent.
- [ ] **Build scope**: `pnpm lint` + `pnpm exec tsc --noEmit` + `pnpm test` (Vitest + Testing Library) + `pnpm run build` all pass after each phase.
- [ ] **Responsive**: desktop-first; verify overview at desktop_1280 and tablet_768 (mobile explicitly out of scope).

## Files to create / modify

- **Modify**: `src/router.tsx`, `src/pages/Index.tsx` (→ AppShell+Overview), `src/index.css`, `tailwind.config.ts`, `package.json` (test script + deps).
- **Create**: `src/domain/{types,format,engine}.ts` + canonical seed, `src/services/{data,qwen,enterpro}.ts`, `src/hooks/useFinSight.ts`, `src/components/**` (AppShell, Sidebar, Header, MetricCard, HealthGauge, RiskCard, CausalGraph, TraceCauseDrawer, ExplainabilityDrawer, ForecastChart, ScenarioControls, WorkflowTimeline, AuditTable, EvidenceDrawer, DemoWalkthrough, …), `src/pages/{Overview,RiskRadar,MoneyLeaks,CashForecast,Simulator,Transactions,Vendors,Workflows,Analyst,AuditTrail}.tsx`, `vitest.config.ts`, tests under `src/domain/__tests__/` and `src/pages/__tests__/` (approve-workflow chain, trace cause, run simulation).
- **Enter Cloud**: Postgres tables + RLS; backend functions `finsight-seed` and `qwen-ask`; secrets.

## What I need from you

- [ ] Qwen: `QWEN_API_KEY`, `QWEN_BASE_URL`, `QWEN_MODEL` (supply via the secret prompt in Phase 4; fallback mode works without them).
- [ ] Confirmation EnterPro stays a stateful mock (no real credentials) — assumed yes per the prompt; flag if that changes.
- [ ] Nothing else blocking. I'll flag anything about Enter Cloud's function-invocation or schema setup I'm unsure how to do before guessing.
