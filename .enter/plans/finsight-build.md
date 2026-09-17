# FinSight — Build Plan (EnterPro + Qwen Edition)

## Context

We are building **FinSight**, a fully working financial early-warning & intervention system for the fictional company **Northstar Commerce** (INR), inside this EnterPro project. The master prompt (source of truth) defines 10 screens, two signature features (Trace Cause causal graph, Crisis Simulator), a deterministic financial engine, Qwen as reasoning layer, EnterPro as orchestration layer, and a Definition of Done: every number traceable to seed data or a deterministic calculation, no dead ends, no placeholders.

**Environment constraints that change the spec (flagged, not guessed):**
- Enter cannot run Node.js/Express/Fastify or Prisma migrations. The frontend is React + Vite + Tailwind + TS; the backend layer is **Enter Cloud** (Postgres, auth, backend functions). The spec's `server/` folder and Express backend are therefore re-architected: the deterministic engine lives in `src/domain/`, Qwen runs in an Enter Cloud backend function (key server-side), EnterPro is a **stateful mock adapter** (explicitly permitted by §7), and demo state persists in the frontend (localStorage) so the entire demo runs with **zero external services reachable** (§11.7).
- Qwen wiring follows the `enter_llm_integration` skill's model-selection workflow when Enter Cloud + AI capability are enabled; if Qwen is not a built-in model, the key is stored via `supabase_add_secret` and the backend function calls the OpenAI-compatible endpoint directly. The app must work fully without it (fallback mode).
- The referenced prototype is not attached; the prompt text is the full spec.
- i18n plumbing stays untouched; FinSight UI is English-only (per reply-language rule and spec).
- Testing: template has no test runner → add **Vitest** (`npm test`).
- Design: light-first "financial terminal" — warm off-white canvas, charcoal text, near-black inset panels, restrained green/amber/red, one sparse accent. No purple/blue AI gradients, no glassmorphism. Inter + JetBrains Mono bundled locally via `@fontsource` (works offline). Tabular numerals for figures, mono for IDs/audit.

## Architecture

```
src/
  components/   AppShell, Sidebar, Header, MetricCard, HealthGauge, RiskCard,
                CausalGraph, TraceCauseDrawer, ExplainabilityDrawer, ForecastChart,
                ScenarioControls, WorkflowTimeline, AuditTable, EvidenceDrawer, …
  pages/        Overview, RiskRadar, MoneyLeaks, CashForecast, Simulator,
                Transactions, Vendors, Workflows, Analyst, AuditTrail
  domain/       types.ts, format.ts, seed.ts, engine.ts (pure deterministic math)
  services/     qwen.ts (backend-function wrapper + deterministic fallback),
                enterpro.ts (stateful mock adapter)
  store/        FinSightProvider (context + useReducer + localStorage persistence)
  lib/          utils (cn)
```

- **`domain/engine.ts`** — pure functions, the only source of numeric truth: `computeFinancialHealth` (with point-by-point breakdown), `forecastCash(caseType)` (90-day series + min-safe ₹1.25 Cr + breach date), `scoreRisk`, `runScenario`, `findOptimalIntervention` (predefined strategy set), `detectLeaks` (5–6 categories), `detectDuplicateInvoices` (INV-48291), `detectVendorPriceCreep` (V-019), causal chains, `citeEvidence` (returns real invoice/vendor/PO IDs).
- **`domain/seed.ts`** — Northstar Commerce data **calibrated by construction** so the engine reproduces the target figures: current cash ₹4.82 Cr, 90-day forecast ₹2.17 Cr, at-risk capital ₹28.4L, recoverable leakage ₹38.4L, health 78/100, liquidity exposure ≈₹64L, threshold breach ≈52 days, min safe ₹1.25 Cr. Deliberate patterns: duplicate invoice INV-48291, V-019 price creep, Aster Retail receivables aging, rising inventory spend, one cross-domain risk. Never labeled "fake" in UI.
- **`store/`** — reducer with actions: `approveWorkflow` (sets status + approver + audit event + immediate UI update), `rejectWorkflow`, `createWorkflowFromLeak`, `createEnterproWorkflow`, `markLeakRecovered`, `askAnalyst`, `runSimulation`, `resetDemo`. Persisted to localStorage; mutations always emit an audit event. EnterPro adapter calls are stateful mutations the UI reflects.
- **`services/enterpro.ts`** — interface: `createApproval, holdPayment, createInvestigation, assignFinanceTask, notifyStakeholder, createVendorReview, createCollectionsTask`. Stateful mock behind it (records status `Detected → Investigating → Awaiting Approval → Approved → Executed`), swappable for live credentials later.
- **`services/qwen.ts`** — `askFinancialQuestion, explainRisk, investigateAnomaly, generateRecommendation, explainScenario`. Calls Enter Cloud function `finsight-analyst`; on failure/absence → deterministic templated answers. Small "Demo Intelligence Mode" indicator (unobtrusive). Qwen may explain numbers, never invent them; UI labels **Observed / Calculated / Forecast / AI-recommendation**.

## Implementation checklist

- [ ] **Phase 0 — Scaffolding & design system**
  - [ ] Add deps: `vitest`, `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`.
  - [ ] Load `frontend-design` skill; extend `src/index.css` + `tailwind.config.ts` with FinSight tokens (canvas/ink/near-black panels, semantic pos/neg/warn/danger, accent, tabular-nums, mono), fonts.
  - [ ] Create folder structure; extend `src/router.tsx` with 10 routes (overview → `/`, risk-radar, money-leaks, cash-forecast, simulator, transactions, vendors, workflows, ai-analyst, audit-trail). Replace `src/pages/Index.tsx` template hero with the FinSight AppShell + Overview.
  - [ ] Implement `src/domain/{types,format,seed,engine}.ts` and `src/store/` (provider + reducer + localStorage + reset).
  - [ ] Build `AppShell`, `Sidebar` (fixed left nav, exactly the 10 items in order), `Header` (company, cash chip, Demo Intelligence Mode indicator, demo-walkthrough trigger).
  - [ ] Add `vitest.config.ts` + `test` script; first engine tests (health = 78, breach at ~52 days, leakage total ≈ ₹38.4L).
  - [ ] Green: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm run build`.

- [ ] **Phase 1 — All 10 screens interactive from day one** (every button real, all loading/error/empty states)
  - [ ] **Overview**: HealthGauge (78, explainable), current cash ₹4.82 Cr, 90-day forecast, at-risk capital, recoverable leakage, 3–5 Emerging Risk cards (level/impact/horizon), AI briefing paragraph (fallback first, clearly labeled AI-generated).
  - [ ] **Risk Radar**: risk list with level/impact/probability/confidence/horizon/drivers/evidence/action; **Trace Cause** → animated causal graph highlighting nodes in sequence with real evidence links (invoice/vendor/PO IDs); explainability drawer with point-by-point score contribution.
  - [ ] **Money Leaks**: total + category breakdown; each item expands (why detected, evidence, baseline comparison, confidence) with **"Recover this value"** → creates a real Workflow + audit event.
  - [ ] **Cash Forecast**: hero chart = 30/60/90-day forecast vs min-safe ₹1.25 Cr with **projected breach date** (not a generic line chart); Base/Downside/Upside toggle; key drivers; "forecast is an estimate" disclaimer.
  - [ ] **Simulator**: sliders/inputs (revenue change, receivables delay, vendor cost change, discretionary/inventory spend) → Baseline vs Scenario vs Scenario+Recommended-Intervention, **deterministic**; "Find optimal intervention" tests the predefined strategy set and ranks by impact/risk/complexity.
  - [ ] **Transactions**: seeded invoices/payments/POs (~50 rows), filterable by type/status + search + expandable evidence links.
  - [ ] **Vendors**: list with pricing-history sparkline, flags (price creep, bank-detail change), links back to risks/leaks.
  - [ ] **Workflows**: full state machine `Detected → Investigating → Awaiting Approval → Approved → Executed`; **approve chain works end-to-end**: status → Approved, approver recorded, audit event created, UI updates immediately. EnterPro-created workflows visible with status.
  - [ ] **AI Analyst**: analyst-workstation layout (not chat bubbles); preset prompt chips populate + submit; every answer includes plain-language answer, metrics used, evidence citations (real IDs — never fabricated), confidence, recommended actions, limitations; says "insufficient evidence" rather than guessing.
  - [ ] **Audit Trail**: every workflow/risk/approval action → one entry (timestamp, actor, action, reason, evidence, risk ID, workflow ID, approval state, outcome); filterable.
  - [ ] Green: lint, tsc, tests, build.

- [ ] **Phase 2 — Financial model tightening**
  - [ ] Every score/forecast explainable (point-by-point contribution drawer), deterministic, no guaranteed-forecast language.
  - [ ] Visual distinction Observed / Calculated / Forecast / AI-recommendation throughout.
  - [ ] Engine tests: health calc, cash forecasting, risk scoring, scenario simulation, duplicate detection, vendor price detection, leakage totals, workflow transitions, audit creation, AI fallback mode.

- [ ] **Phase 3 — Backend wiring (Enter Cloud)**
  - [ ] `supabase_enable` then `enable_ai_capability`; load `enter_cloud` + `enter_llm_integration` skills; follow model-selection workflow; store Qwen credentials via `supabase_add_secret` if needed.
  - [ ] Backend function `finsight-analyst` (OpenAI-compatible chat completions to Qwen; Zod validation; structured response: answer, metrics, evidence, confidence, actions, limitations).
  - [ ] `src/services/qwen.ts` wrapper with deterministic fallback; Demo Intelligence Mode indicator reflects live vs fallback.
  - [ ] EnterPro mock adapter stays behind its interface (already wired in Phase 1). Optional: Enter Cloud DB sync of workflows/audit — non-blocking, skip if it risks the core loop.

- [ ] **Phase 4 — Polish + demo trigger + delivery**
  - [ ] Design self-audit vs spec §8 checklist; fix repetitive cards, over-rounded corners, unnecessary gradients, weak hierarchy, decorative elements.
  - [ ] **"Demo Scenario" trigger**: guided walkthrough of §11.7 sequence (Overview → Liquidity risk → Trace Cause → evidence → AI Analyst → Simulator revenue −15% → optimal intervention → EnterPro workflow → Money Leaks → recover one item → Audit Trail), works fully offline, with step list + auto-navigation.
  - [ ] Subtle load animations on figures, causal-graph node highlight, evidence drawers.
  - [ ] Final green: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm run build`.
  - [ ] Deliver short honest limitations list.

## Verification checklist

- [ ] **Positive**: demo walkthrough runs start-to-finish with no external service; approving a workflow shows status Approved, approver, audit event, immediate UI update; simulator outputs change deterministically with sliders; AI Analyst answers cite real IDs.
- [ ] **Negative/default**: Qwen function unreachable → app fully functional in fallback mode with "Demo Intelligence Mode" indicator; empty filters show empty states; search finds seeded transactions.
- [ ] **Boundary**: forecast breaches ₹1.25 Cr at ~52 days in Base case; leakage totals ≈ ₹38.4L; health = 78/100; INR formatting (₹, lakhs/crores) consistent.
- [ ] **Build scope**: `pnpm lint` + `pnpm exec tsc --noEmit` + `pnpm test` (Vitest) + `pnpm run build` all pass after each phase.
- [ ] **Responsive**: desktop-first; verify overview at desktop_1280 and tablet_768 (mobile is explicitly out of scope per spec).

## Files to create / modify

- **Modify**: `src/router.tsx`, `src/pages/Index.tsx` (→ AppShell+Overview), `src/index.css`, `tailwind.config.ts`, `package.json` (test script + deps).
- **Create**: `src/domain/{types,format,seed,engine}.ts`, `src/store/FinSightProvider.tsx`, `src/services/{qwen,enterpro}.ts`, `src/components/**` (AppShell, Sidebar, Header, MetricCard, HealthGauge, RiskCard, CausalGraph, TraceCauseDrawer, ExplainabilityDrawer, ForecastChart, ScenarioControls, WorkflowTimeline, AuditTable, EvidenceDrawer, DemoWalkthrough, …), `src/pages/{Overview,RiskRadar,MoneyLeaks,CashForecast,Simulator,Transactions,Vendors,Workflows,Analyst,AuditTrail}.tsx`, `vitest.config.ts`, engine tests under `src/domain/__tests__/`.

## What I need from you

- [ ] Nothing blocking. Optional: Qwen `QWEN_API_KEY`/`QWEN_BASE_URL`/`QWEN_MODEL` (fallback mode works without them — supply via the secret prompt during Phase 3). Optional later: live EnterPro base URL/key (mock adapter is the default). No database connection string needed (localStorage store; Enter Cloud DB sync optional).
