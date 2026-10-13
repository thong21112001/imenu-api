# 🧪 Phase 6: Order Operations, POS & Table Synchronization (Order & POS Lifecycle)

> **Language:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)<br>
> **Phase:** 6 — Order & POS Lifecycle<br>
> **Sub-phase Status:** **SUB-PHASE 6.9 IMPLEMENTED — MASTER CLOSURE GATE READY**<br>
> **Directory Convention:** `ONE PHASE = ONE TEST DIRECTORY` (All Phase 6 test artifacts are stored directly in this single directory).

---

## 1. Phase 6 Purpose & Architectural Context

Phase 6 is the mission-critical phase implementing the end-to-end Order Lifecycle, POS Cashier operations, Customer QR ordering, transaction deduplication / race condition control (Idempotency & Concurrency), table-order state synchronization (Table ↔ Order Synchronization), Frontend Monorepo integration, and cross-application automated browser E2E validation.

Per `imenu-api` repository architecture standard:
> **Repository Convention:** `ONE PHASE = ONE DIRECTORY`  
> All automated test files, test orchestrator, and architecture specs for Phase 6 (from 6.1 through 6.9) reside directly inside `tests/phase-06-order-pos/`. Sub-phases do **NOT** create individual directories to avoid repository fragmentation.

---

## 2. Phase 6 Scope & Sub-phases

Phase 6 encompasses 9 complete functional sub-phases:

1. **Sub-phase 6.1 — Core Order & Table Lifecycle Baseline:** Core order lifecycle foundations, table-order associations, order rounds (`rounds[]`), and line items (`items[]`).
2. **Sub-phase 6.2 — State Machine & Business Invariants:** State machine transitions for orders and tables, immutable state constraints (Single active order per table, Paid is Terminal, RBAC state transition checks).
3. **Sub-phase 6.3 — POS Cashier & Billing Flows:** POS cashier workflows, tax calculations (VAT, service fee, discounts), Cash payments with exact change calculations (`changeAmount`), VietQR payments, and Quick-pay.
4. **Sub-phase 6.4 — Customer QR Ordering:** Table QR scanning, public digital menu access, batch order placement (`WaitingConfirmation`), staff review/confirmation (`Confirmed`), protection against duplicate active order creation.
5. **Sub-phase 6.5 — Idempotency Key & Concurrency Control:** `X-Idempotency-Key` middleware for caching and replaying duplicate requests, atomic multi-threaded POS payment claims (`Atomic Payment Claim`), financial invariant preservation.
6. **Sub-phase 6.6 — Table ↔ Order Synchronization & Transfer/Merge:** Hardened table-order lifecycle synchronization, table transfer (`transferTable`), table merge (`mergeTables`), item movement between tables (`moveItemsBetweenTables`), Split Bill flows, database-level atomic CAS (Compare-And-Swap) locking, and Optimistic Concurrency Control (OCC) Retries.
7. **Sub-phase 6.7 — Order Query, Filters, Search & Multi-Branch Optimization:** Comprehensive upgrade of `GET /api/orders` query API (date/time range filters, dynamic `dateField`, staff filters, multi-status filter, payment method filter, safe regex search, deterministic sorting, pagination with `totalPages`, strict multi-branch scoping and MongoDB compound indexes).
8. **Sub-phase 6.8 — Frontend Monorepo Integration:** End-to-end integration between frontend monorepo (`imenu-menudientu`) and backend API (`imenu-api`); public QR table context (`GET /api/orders/public/table-context`), order round lifecycle synchronization (`OrderRound`, `WaitingConfirmation`), POS QR approval & KDS guard, table operations (transfer, merge, move-items), bill preview & 80mm print, hardened WebSocket room authorization (`AUD-6.8-01`).
9. **Sub-phase 6.9 — Phase 6 Master Hardening, E2E Cross-App Validation & Final Closure Gate:**
   - Real browser E2E automated suite (`puppeteer-core` connected to Chrome) verifying 9 independent checkpoints across Customer Menu $\leftrightarrow$ Admin POS.
   - Master test orchestrator `run-all-phase6.ts` supporting dual modes (`--mode=dev` and `--mode=acceptance`).
   - Hardware thermal printer ESC/POS architectural specification prepared for Phase 8 (`thermal-printer-spec.md`).
   - 365-case reconciliation framework and final official Phase 6 closure gate.

---

## 3. Test Inventory & Audit Breakdown

All automated test files and scripts for Phase 6:

| Test File | Sub-phase | Verification Scope | Test Count | Status |
| :--- | :---: | :--- | :---: | :---: |
| **`state-machine.test.ts`** | 6.2 | Order state transitions (`WaitingConfirmation` $\rightarrow$ `Preparing` $\rightarrow$ `Ready` $\rightarrow$ `Served` $\rightarrow$ `Paid` / `Cancelled`), round confirmation/cancellation, item cancellations, subtotal recalculations, staff RBAC. | **56** | **PASS** |
| **`pos-cashier.test.ts`** | 6.3 | POS Cashier operations, financial calculation engine (VAT, service fees, discounts), Cash payments (change amount), VietQR payments, quick-pay, immutable Paid orders, tenant/branch isolation. | **30** | **PASS** |
| **`customer-qr.test.ts`** | 6.4 | Customer QR ordering, `WaitingConfirmation` rounds, staff confirmation flow, table binding, QR token validation, multi-tenant and branch boundaries. | **43** | **PASS** |
| **`idempotency-concurrency.test.ts`** | 6.5 | `X-Idempotency-Key` header re-identification (cached replay), concurrent payments via `Promise.all` (exactly 1 succeeds, 1 rejected), zero duplicate charges. | **32** | **PASS** |
| **`table-order-sync.test.ts`** | 6.6 | Table transfer (`transferTable`), table merge (`mergeTables`), item movement (`moveItemsBetweenTables`), split billing, CAS atomic locking against transfer races, OCC retries against Mongoose VersionError, defect regression suite. | **38** | **PASS** |
| **`order-query.test.ts`** | 6.7 | Order query filters (date range, dateField, staff, multi-status, payment method), safe regex search, deterministic pagination with `totalPages`, strict multi-branch isolation, index scan verification. | **42** | **PASS** |
| **`subphase-6-8-integration.test.ts`** | 6.8 | End-to-end frontend-backend integration, QR round lifecycle, POS approval, table operations, bill preview & POS checkout, tenant isolation, and Realtime room authorization hardening (`AUD-6.8-01`). | **29** | **PASS** |
| **`e2e-browser-runner.test.ts`**<br>*(with `scripts/e2e-order-lifecycle.mjs`)* | 6.9 | Automated cross-app browser E2E validation across 9 checkpoints (`E2E-01` .. `E2E-09`): QR Order $\leftrightarrow$ POS Approval $\leftrightarrow$ Round 1 & 2 $\leftrightarrow$ Pre-bill $\leftrightarrow$ Cash Pay $\leftrightarrow$ Table Release. | **9** | **READY** |
| **`run-all-phase6.ts`** | 6.9 | Master Test Orchestrator: Dev Mode (279 cases) & Acceptance Mode (365 cases). | N/A | **READY** |
| **`thermal-printer-spec.md`** | 6.9 | Phase 8 80mm ESC/POS hardware thermal printer architecture specification (Documentation only, zero code changes). | N/A | **DOCUMENTED** |

---

## 4. Ecosystem 365-Case Test Reconciliation

The Phase 6 closure gate reconciles exactly 365 automated test cases without double-counting:

```
┌────────────────────────────────────────────────────────────────────────┐
│  IMENU TESTING ECOSYSTEM — 365 RECONCILED AUTOMATED TEST CASES         │
├────────────────────────────────┬──────────────────────┬────────────────┤
│ Test Group                     │ Source File / Loc    │ Test Count     │
├────────────────────────────────┼──────────────────────┼────────────────┤
│ 1. Phase 6 Backend (7 suites)  │ tests/phase-06-order │ 270            │
│ 2. Frontend SDK Contract       │ imenu-menudientu     │ 9              │
│ 3. Browser E2E (9 checkpoints) │ scripts/e2e-order    │ 9              │
│ 4. Phase 2–5 Regression        │ tests/phase-02..05   │ 77             │
├────────────────────────────────┴──────────────────────┼────────────────┤
│ ECOSYSTEM TOTAL (FINAL ACCEPTANCE CLOSURE REQUIREMENT)│ 365 TESTS      │
└───────────────────────────────────────────────────────┴────────────────┘
```

Detailed breakdown of the 77 Phase 2–5 regression cases:
- **Phase 2:** 24 cases (`test.ts`: 12 cases + `test-multi-branch.ts`: 12 cases)
- **Phase 3:** 16 cases (`tests/phase-03-staff-rbac/test.ts`)
- **Phase 4:** 17 cases (`tests/phase-04-menu/test.ts`)
- **Phase 5:** 20 cases (`tests/phase-05-order-table-kds/test.ts`)

---

## 5. Test Execution Commands

Execute test suites via standardized NPM scripts:

### 5.1. Dual-Mode Master Test Orchestrator:
```powershell
# 1. Developer Test Run
# Executes 270 backend + 9 SDK = 279 mandatory tests. E2E may SKIP if UI dev servers are offline.
npm run test:phase6:all

# 2. Final Acceptance Run (Official Closure Gate)
# MANDATORY 100% of all 365 tests (270 Backend + 9 SDK + 9 E2E + 77 Phases 2-5).
# ZERO SKIP, ZERO FAIL, ZERO BLOCKED PERMITTED.
npm run test:phase6:acceptance
```

### 5.2. Individual Suite Execution:
```powershell
# Phase 6 Backend Suites:
npm run test:phase6:transitions  # Sub-phase 6.2: State Machine (56 tests)
npm run test:phase6:pos          # Sub-phase 6.3: POS Cashier (30 tests)
npm run test:phase6:customer-qr  # Sub-phase 6.4: Customer QR (43 tests)
npm run test:phase6:concurrency  # Sub-phase 6.5: Idempotency (32 tests)
npm run test:phase6:sync         # Sub-phase 6.6: Table Sync (38 tests)
npm run test:phase6:query        # Sub-phase 6.7: Order Query (42 tests)
npm run test:phase6:integration  # Sub-phase 6.8: Frontend Monorepo Integration (29 tests)

# Run standard 6 backend suites (241 tests):
npm run test:phase6

# Standalone Browser E2E Script (Requires API:3001, Admin:3003, Menu:3005):
npm run test:phase6:e2e

# Run all Phase 2-5 regression tests (77 tests):
npm run test:regression:phase2-5
```

---

## 6. Fixture Lifecycle & Teardown Verification

The E2E test script adheres strictly to deterministic fixture safety:
1. **Unique Isolation Identifier:** All E2E resources carry unique timestamped prefix `e2e_${Date.now()}` (e.g. `tbl-e2e-17734...`).
2. **Authentic Staff Credentials:** Uses seeded owner credentials `owner@sample.vn` to acquire JWT Bearer token and create an isolated table via `POST /api/tables`.
3. **Guaranteed Teardown in `finally`:** Ensures deletion of created orders and the test table (`DELETE /api/tables/:id`).
4. **Cleanup Verification:** Queries `GET /api/tables?search=${E2E_ID}` and asserts an empty result (`data.length === 0`). Any leftover triggers a visible `CLEANUP_FAILURE` error.

---

## 7. Architectural & Design Highlights

1. **Port & Fixture Isolation:** Each backend test file spins up an isolated NestJS Application instance on unique ports (from 3098 to 3105), generating dynamic fixtures and cleaning up completely.
2. **Partial Unique Index Guard:** Database constraint `{ restaurantId: 1, tableId: 1 }` with `partialFilterExpression` prevents more than 1 active order per table.
3. **Atomic CAS State Transitions & OCC Retry:** Table transfer relies on atomic `tableModel.findOneAndUpdate`. Item move and merge use OCC retry loops catching `VersionError` with backoff.
4. **Hardware Thermal Printer Spec (Phase 8):** Clear separation between rendering layer (HTML/Canvas/PDF) and transport layer (WebUSB/Print Gateway), documented in `thermal-printer-spec.md`.
