# FinSight Hardening — Implementation Plan

## Context

FinSight today is a working demo with a trustworthy deterministic engine wrapped in a fragile shell. Four things verified against the live system drive this plan:

1. **Reset is silently broken.** `supabase_get_table_schema` confirms there is **no DELETE policy** on any `finsight_*` table. RLS therefore blocks `resetDemo()`'s deletes, `tryCloud()` swallows the error, and the UI still reports "Demo data reset to seed state".
2. **There is a live cloud-only bug.** `CloudBackend.runSimulation` returns a `FinSightState` where `{result, state}` is required. `useRunSimulation.onSuccess` destructures `state` → `undefined` → `qc.setQueryData(stateKey, undefined)` blanks the app state. Tests never catch it because `src/test/setup.ts` forces memory mode. Found by running `tsc --strict`.
3. **The data is shared and real.** 7 workflows, 236 audit events, 6 leaks exist and must be preserved.
4. **Cleanup is narrower than the review assumed.** `next-themes` is required by `ui/sonner.tsx`, `react-hook-form`/`zod` by `ui/form.tsx`, and i18n by `NotFound.tsx`. Only `framer-motion` is genuinely unused.

Agreed direction: **anonymous-first ownership** — every visitor silently gets a real Enter Cloud identity, so the demo keeps working with no login wall, while every row gains a real owner and real RLS. Analytics and i18n get wired up rather than deleted. The `build` script stays untouched.

## Architecture

```
UI (pages)
 → React Query hooks (hooks/useFinSight.ts)
 → application service (services/finsightService.ts)   ← domain op runs ONCE here
 → domain operations (domain/operations.ts)            ← pure, single source of rules
 → persistence port (services/persistence/port.ts)
     ├── cloud adapter (services/persistence/cloud.ts)   + Zod validation at the boundary
     └── memory adapter (services/persistence/memory.ts)
```

`InMemoryBackend`/`CloudBackend` stop being two implementations of the same rules. Each mutation becomes: load snapshot → run one pure domain operation → persist the returned fragments. Only persistence differs.

### Ownership & security model

Anonymous auth gives every visitor a real `auth.uid()` with no login screen.

- New nullable `user_id uuid` column on all three tables. The 236 legacy rows keep `user_id IS NULL`, are **never deleted**, and become invisible to the app — each visitor is seeded their own private copy instead. This is a deliberate, visible behavior change.
- Surrogate `row_id uuid` primary key + `unique (user_id, id)`, because every user now holds their own `WF-1001`.
- RLS replaced: SELECT/INSERT/UPDATE/DELETE all scoped to `user_id = auth.uid()`. Reset becomes deterministic and **structurally incapable** of touching the legacy seed.
- **Server-side enforcement via Postgres triggers**, not a second copy of the engine: a stamp trigger forces `user_id = auth.uid()` on insert (so a client cannot forge ownership), and a transition trigger rejects illegal workflow status changes (so a client cannot jump `Detected → Executed` by calling PostgREST directly).

Triggers are chosen over a mutation backend function deliberately: they enforce invariants in one place without duplicating domain logic into Deno, which would recreate the exact duplication problem this refactor removes.

## Critical files

| Path | Change |
|---|---|
| `src/domain/operations.ts` | **New** — all mutation rules, one place |
| `src/domain/schemas.ts` | **New** — Zod schemas for persisted structures |
| `src/domain/transitions.ts` | **New** — centralized workflow/leak state machine, explicit errors |
| `src/services/persistence/{port,cloud,memory}.ts` | **New** — replaces the dual-backend `data.ts` |
| `src/services/finsightService.ts` | **New** — orchestration; `services/data.ts` becomes a thin re-export |
| `src/services/auth.ts` | **New** — anonymous session bootstrap, authoritative current user |
| `src/services/qwen.ts`, `src/pages/Analyst.tsx`, `src/pages/Overview.tsx` | Explicit AI provenance |
| `src/hooks/useFinSight.ts` | Point at the service; fix `runSimulation` contract |
| `src/router.tsx` | `React.lazy` + `Suspense` route splitting |
| `supabase/migrations/migration_20260917_102431000` | Neutralize the unconditional `DELETE` |
| `tsconfig.app.json` | `strict`, `noImplicitAny`, unused checks |

Reuse existing, do not reinvent: `domain/engine.ts` (untouched math), `domain/format.ts`, `components/primitives.tsx` (`SourceTag`, `EvidenceList`, `StatusBadge`), `components/ui/skeleton.tsx`.

## Implementation checklist

### Phase 0 — capabilities & data safety
- [ ] Call `i18n_enable` and `enable_analytics` (both currently off; each owns its own workflow once enabled)
- [ ] Enable anonymous users via `supabase_configure_auth`
- [ ] Migration adds `user_id`, surrogate `row_id` PK, `unique (user_id, id)`, and a `user_id` index to all three tables **without deleting any row**
- [ ] Migration replaces every `using (true)` policy with `user_id = auth.uid()` scoping, including a DELETE policy
- [ ] Insert trigger stamps `user_id = auth.uid()`, overriding any client-supplied value
- [ ] Update trigger rejects illegal workflow status transitions at the database level
- [ ] Verify with `supabase_read_query` that legacy row counts are still 7 / 236 / 6 after migrating
- [ ] Replace `migration_20260917_102431000` contents with a documented no-op so replay is non-destructive
- [ ] `resetDemo` deletes only the caller's rows, re-seeds them, and **returns an explicit result** instead of a silent fallback
- [ ] Reset toast reports success only when the reset actually happened; degraded/offline reports a distinct message

### Phase 1 — single source of domain rules
- [ ] `domain/transitions.ts` centralizes workflow + leak transitions and returns typed errors for invalid moves
- [ ] `domain/operations.ts` implements each mutation once: approve, advance, execute, createFromRisk, createFromLeak, createCollections, notify, acknowledgeRisk, recordRiskTrace, runSimulation, askAnalyst, reset
- [ ] `services/persistence/port.ts` defines load/persist only — no business rules
- [ ] Memory and cloud adapters implement the port; neither contains transition logic
- [ ] `finsightService.ts` runs the domain op once and hands fragments to the active adapter
- [ ] Invalid transitions surface as explicit errors in the UI, not silent no-ops
- [ ] Fix `runSimulation` to return `{result, state}` on the cloud path

### Phase 2 — types & validation
- [ ] `tsconfig.app.json`: `strict: true`, `noImplicitAny: true`, `noUnusedLocals/Parameters: true`
- [ ] Resolve all 24 strict errors without adding `as unknown as` casts
- [ ] `domain/schemas.ts` Zod schemas for `Workflow`, `Leak`, `AuditEvent`, `EvidenceRef`, `AnalystAnswer`
- [ ] Cloud hydration `safeParse`s every row; malformed rows are skipped, counted, and surfaced explicitly rather than cast

### Phase 3 — AI reliability
- [ ] `AnalystAnswer` carries per-section provenance; narrative is the only Qwen-sourced field
- [ ] `limitations` states plainly which parts were deterministic when Qwen answered
- [ ] Confidence is labeled as deterministic-template confidence, never implied to be model confidence
- [ ] Analyst and Overview label each block via `SourceTag`
- [ ] Engine remains the sole numeric authority — no AI value reaches a financial figure

### Phase 4 — persistence consistency & invariants
- [ ] New owned `finsight_analyst_answers` table with RLS; Analyst history survives reload
- [ ] `docs/PERSISTENCE.md` states what is durable, session-only, static seed, mutable state
- [ ] Seed calibration regression test pins measured cash, breach day, day-90, health, leakage, exposure, at-risk
- [ ] At-risk capital: pin the **measured** value; report the 28.4L/28.6L doc discrepancy without changing the math

### Phase 5 — performance
- [ ] `commit` no longer reads full state twice per mutation
- [ ] `seedIfEmpty` runs once per session, not per call
- [ ] Route-level `React.lazy` + `Suspense`; confirm chunk split in build output
- [ ] Skeleton loading states on major pages
- [ ] **Profile Simulator slider cost first**; optimize only if measurement justifies it

### Phase 6 — consistency, analytics, i18n
- [ ] One authoritative current user; remove the hardcoded "Nischala GS" / "A. Mehta" split
- [ ] EnterPro clearly labeled as simulated
- [ ] No control implies a permission the database does not enforce
- [ ] Register and instrument real analytics events
- [ ] Translate FinSight UI (en + zh-CN) via the `enter_i18n` skill; run its scan script as the final shell command
- [ ] Remove `framer-motion` only; keep `next-themes`, `react-hook-form`, `zod`, i18n

### Phase 7 — tests
- [ ] Reset behavior tests in the persistence layer
- [ ] Adapter-equivalence tests proving memory and cloud produce the same domain outcome
- [ ] Qwen tests: success, timeout, API failure, malformed, empty, fallback, mode labeling, off-pattern questions
- [ ] Zod boundary tests for malformed database rows
- [ ] Workflow lifecycle, leak recovery, Audit Trail, Simulator, DemoWalkthrough, route smoke tests
- [ ] Playwright E2E (1.62 + browsers confirmed available): Overview → Risk Radar → trace → workflow → advance/approve/execute → Audit Trail; plus leak recovery, simulator, analyst

## Verification checklist

- [ ] `pnpm test` passes; report exact counts before/after
- [ ] `pnpm lint` passes with no new warnings
- [ ] `pnpm exec tsc --noEmit` passes under strict
- [ ] `pnpm run build` passes; `pnpm run build:prod` verified as the minified production path, `build` left untouched
- [ ] Playwright E2E run and its real result reported
- [ ] **Positive:** approving a workflow updates status, records approver, writes an audit event, persists across reload
- [ ] **Negative:** an illegal transition (e.g. `Detected → Executed`) is rejected by the database trigger, not just the UI
- [ ] **Negative:** a direct PostgREST write attempting to set another user's `user_id` is rejected
- [ ] **Boundary:** Reset removes only the caller's rows; `supabase_read_query` confirms legacy 7 / 236 / 6 still intact afterwards
- [ ] **Boundary:** malformed JSONB row is skipped and reported, and does not crash hydration
- [ ] **Boundary:** Qwen timeout falls back with correct `fallback` labeling and no fabricated confidence

## Explicitly out of scope

- No change to `domain/engine.ts` financial math unless a test demonstrates a real bug (per instruction 36)
- No replacement of the deterministic engine with AI (37)
- No redesign into a generic SaaS dashboard (38)

## Honest limitations to report at the end

Production readiness will be claimed **only** for what is actually verified. Anonymous identities are real auth principals but are not identity-proofed; the display name on an audit event remains client-supplied even though the owning `user_id` is database-stamped. Optional email sign-in is layered on top but full multi-user organization/role management is not part of this pass.
