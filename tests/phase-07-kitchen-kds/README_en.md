# 🧪 Phase 7: Kitchen Display System (KDS) & Realtime Dish Dispatching

> **Languages:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)<br>
> **Phase:** 7 — Kitchen Display System (KDS) & Realtime Dish Dispatching<br>
> **Subsystem Status:** **✅ ACCEPTED — OFFICIALLY CLOSED (PHASE 7 CLOSURE GATE PASSED)**<br>
> **Directory Convention:** `ONE PHASE = ONE TEST DIRECTORY` (All Phase 7 test artifacts are consolidated in this directory).

---

## 1. Purpose & Context (Phase 7 Purpose)

Phase 7 represents the core kitchen dispatching subsystem that completes the entire F&B service loop: **Customer QR Order $\rightarrow$ POS Cashier Approval $\rightarrow$ Kitchen Display System (KDS) Processing $\rightarrow$ Cooked Notification & Table Service (Ready & Served)**.

Per the architectural convention of `imenu-api`:
> **Convention:** `ONE PHASE = ONE TEST DIRECTORY`  
> All automated test files, test runners, and test documentation for Phase 7 (from 7.1 to 7.6) are stored uniformly and centrally within `tests/phase-07-kitchen-kds/`. Sub-phases do **not** create separate subdirectories to avoid repo fragmentation.

---

## 2. Business Scope & Sub-phases (Phase 7 Scope & Sub-phases)

Phase 7 encompasses 6 comprehensive functional sub-phases:

1. **Sub-phase 7.1 — KDS Queue Engine, FIFO Ordering & Active Query:**
   - Dedicated Kitchen endpoints: `GET /api/kitchen/orders` and `GET /api/kitchen/items-summary`.
   - Strict First-In-First-Out queue ordering (**FIFO `createdAt ASC`**).
   - Automatic exclusion of terminated orders (`Paid` or `Cancelled`).
   - Active aggregation of waiting and cooking dishes (`Waiting`, `Cooking`) across all active tables within the branch.
   - Flexible filtering support: `branchId`, `zoneId`, `tableId`, `status`, `search` (order code, table name), `includeUnconfirmed`.

2. **Sub-phase 7.2 — Item Status State Machine & Auto Order Status Upgrade:**
   - Granular dish status lifecycle: `WaitingConfirmation` $\rightarrow$ `Waiting` $\rightarrow$ `Cooking` $\rightarrow$ `Ready` $\rightarrow$ `Served`.
   - Kitchen dispatching endpoints:
     * `POST /api/order-items/:id/start-cooking` (supports nested route `/api/orders/:orderId/items/:itemId/start-cooking`)
     * `POST /api/order-items/:id/mark-ready`
     * `POST /api/order-items/:id/mark-served`
     * `POST /api/orders/:orderId/kitchen/batch-update` (Batch update by round number or entire order)
   - Automatic order status upgrades (`Order.status`):
     * When at least 1 item starts cooking $\rightarrow$ `Order.status` automatically advances to `Preparing`.
     * When all items in the order are ready $\rightarrow$ `Order.status` automatically advances to `Ready`.
     * When all items in the order are served $\rightarrow$ `Order.status` automatically advances to `Served`.
   - Invariant Negative Guards: Blocks cooking unconfirmed items (`WaitingConfirmation`), blocks skipping from `Waiting` directly to `Ready`, blocks kitchen actions on `Cancelled` items or `Paid` orders.

3. **Sub-phase 7.3 — Out-of-Stock (86) Management & Multi-Branch Isolation:**
   - Dedicated kitchen menu management endpoints: `GET /api/kitchen/menu-items` and `PATCH /api/kitchen/menu-items/:id/availability`.
   - **Branch Availability Override**: Out-of-stock reporting at Sub-branch B only impacts Sub-branch B; HQ Branch A and other branches remain unaffected.
   - Blueprint Edge Case #2: Items in pre-existing active orders can still be cooked and marked ready normally; new QR orders for the 86'd item are immediately blocked with `400 Bad Request`.

4. **Sub-phase 7.4 — Cross-App Realtime WebSocket Pairing (3-Way Synchronization):**
   - 3-Way real-time synchronization between **KDS (Kitchen)** $\leftrightarrow$ **POS (Cashier)** $\leftrightarrow$ **Customer QR Menu (Diner at Table)**.
   - Kitchen immediately receives orders when placed or approved.
   - Diner at the table receives real-time item status changes (`Cooking`, `Ready`) inside the tracking drawer without refreshing the page.
   - Audio Chime alerts on KDS on new incoming orders or dish completion.

5. **Sub-phase 7.5 — Modern KDS User Interface (`apps/imenu-admin/src/app/kitchen/page.tsx`):**
   - Industrial-grade kitchen screen design (High-Contrast Dark Mode).
   - Header Summary Bar: Aggregated counts for Total Waiting and Total Cooking items.
   - Visual order cards with color-coded item badges, real-time elapsed timers, and delay warnings (red alert at >15 minutes).
   - One-touch 86 Stockout modal.
   - Instant search and zone filters.

6. **Sub-phase 7.6 — Hardening, Adversarial Audit & Zero-Vulnerability Closure:**
   - `AUD-7.1`: Sealed Cross-Branch Cook IDOR vulnerability; sub-branch cooks cannot manipulate orders belonging to other branches.
   - `AUD-7.2`: Strict permission separation for Custom Roles; cooking permission (`perm-kds-cook`) and 86 stockout permission (`perm-kds-out`) are independently enforced with `403 Forbidden`.
   - `AUD-7.3`: Reinforced Atomic Conditional Update preventing Race Conditions between cashier payment and kitchen dish status updates.
   - `AUD-7.4`: Hardened `RealtimeGateway` room security; guest sockets without staff JWT only join their table room (`table_${tableId}`) and the public menu room (`public_menu_${restId}`), strictly barred from staff restaurant rooms.
   - `AUD-7.5`: Rigorous input validation (`zoneId`, search length) and filter protection against paid order leakage.
   - `AUD-7.6`: Optimistic UI state rollback on API failures and audio chime deferral until API confirmation.

---

## 3. Test Inventory & Audit Breakdown

All automated test suites for Phase 7:

| Suite ID | Test File | Validation Focus | Test Count | Status |
| :---: | :--- | :--- | :---: | :---: |
| **P7-01** | `kds-queue-query.test.ts` | KDS Queue, FIFO order (`createdAt ASC`), filters (`zoneId`, `tableId`, `status`, `search`), branch isolation, exclusion of `Paid`/`Cancelled` orders, items summary aggregation, hardening AUD-7.5. | **9** | **PASS** |
| **P7-02** | `kds-state-transitions.test.ts` | Dish lifecycle (`start-cooking`, `mark-ready`, `mark-served`), auto order status upgrades (`Preparing`, `Ready`, `Served`), batch round updates, negative guards, hardening AUD-7.1 (cross-branch 403), hardening AUD-7.2 (`perm-kds-cook` vs `perm-kds-out` 403). | **10** | **PASS** |
| **P7-03** | `kds-concurrency-idempotency.test.ts` | Double-click idempotency (200 OK idempotent replay), OCC concurrency handling (`Promise.all`), zero lost updates, hardening AUD-7.3 (Cashier Pay vs Cook Update race condition). | **5** | **PASS** |
| **P7-04** | `kds-out-of-stock.test.ts` | Kitchen menu query, branch-isolated 86 stockout, Blueprint Edge Case #2 (active order proceeds, new order blocked 400), 3-way realtime events, hardening AUD-7.4 (guest socket room isolation). | **6** | **PASS** |
| **P7-SDK**| `packages/utils/tests/sdk-contract.test.ts`<br>*(in `imenu-menudientu`)* | Frontend SDK contract testing for all KDS endpoints (`apiClient.kitchen.*`: `getOrders`, `getItemsSummary`, `startCookingItem`, `markItemReady`, `markItemServed`, `batchUpdate`, `toggleAvailability`). | **14** | **PASS** |
| **P7-E2E**| `e2e-kds-runner.test.ts`<br>*(with `scripts/e2e-kds-lifecycle.mjs`)* | Real browser E2E automated testing validating the full kitchen dispatch lifecycle: QR Order $\rightarrow$ KDS Cooking $\rightarrow$ KDS Ready $\rightarrow$ Guest tracking $\rightarrow$ Served. | **6** | **PASS** |
| **MASTER**| `run-all-phase7.ts` | Master Test Orchestrator coordinating all 6 suites: Dev Mode (50 tests) & Acceptance Mode (Closure Gate). | N/A | **READY** |

---

## 4. Ecosystem Test Count Reconciliation Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  IMENU TESTING ECOSYSTEM — 415 TOTAL AUTOMATED TESTS RECONCILIATION                    │
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Test Subsystem                 │ Location / Test File         │ Actual Test Count      │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ 1. Phase 7 Backend Suites      │ tests/phase-07-kitchen-kds/  │ 30                     │
│ 2. Frontend SDK Contract Suite │ packages/utils/tests/        │ 14                     │
│ 3. Browser E2E Checkpoints     │ scripts/e2e-kds-lifecycle    │ 6                      │
│ 4. Phase 6 Orders & POS Suites │ tests/phase-06-order-pos/    │ 288 (270 BE + 9 SDK + 9 E2E)│
│ 5. Phases 2–5 Core Regressions │ tests/phase-02..05/          │ 77                     │
├────────────────────────────────┴──────────────────────────────┼────────────────────────┤
│ TOTAL ECOSYSTEM TESTS (ACCEPTANCE CLOSURE REQUIREMENT)         │ 415 TESTS              │
└───────────────────────────────────────────────────────────────┴────────────────────────┘
```

### Breakdown of the 50 Phase 7 Test Cases:
- **P7-01 (`kds-queue-query.test.ts`)**: 9 cases (`TC-01` to `TC-09`)
- **P7-02 (`kds-state-transitions.test.ts`)**: 10 cases (`TC-01` to `TC-10`)
- **P7-03 (`kds-concurrency-idempotency.test.ts`)**: 5 cases (`TC-01` to `TC-05`)
- **P7-04 (`kds-out-of-stock.test.ts`)**: 6 cases (`TC-01` to `TC-06`)
- **P7-SDK (`sdk-contract.test.ts`)**: 14 cases (`SDK-01` to `SDK-12`, including 02b and 03b)
- **P7-E2E (`e2e-kds-lifecycle.mjs`)**: 6 checkpoints

---

## 5. Test Execution Commands (Phase 7 Test Commands)

All test commands are registered in `package.json`:

### 🔹 Run the Entire Phase 7 Test Suite:
```powershell
# Run all 6 Phase 7 suites (30 Backend + 14 SDK + 6 E2E):
npm run test:phase7:all

# Run in strict Acceptance mode:
npm run test:phase7:acceptance
```

### 🔹 Run Individual Phase 7 Suites:
```powershell
# Suite 1: KDS Queue, FIFO & Filters (Port 3110)
npm run test:phase7:query

# Suite 2: Dish Lifecycle, Order Status Upgrades & Guards (Port 3111)
npm run test:phase7:transitions

# Suite 3: Double-Click Idempotency & OCC Concurrency (Port 3112)
npm run test:phase7:concurrency

# Suite 4: 86 Out-of-Stock, Branch Isolation & Realtime (Port 3113)
npm run test:phase7:out-of-stock

# Suite E2E: Real Browser E2E KDS Lifecycle Script
npm run test:phase7:e2e

# Run all 4 Backend suites sequentially:
npm run test:phase7
```

### 🔹 Run Ecosystem Regression:
```powershell
# Phases 2–5 Regression (77 tests):
npm run test:regression:phase2-5

# Phase 6 Full Regression (288 tests):
npm run test:phase6:all
```

---

## 6. Conclusion & Acceptance Closure

Phase 7 has completely satisfied all architectural requirements:
- Atomic teardown mechanisms (**Zero Garbage Teardown**) ensure zero residual test documents in MongoDB.
- Zero regressions across prior subsystems (Phases 2 through 6).
- Production-ready for deployment and ready to support subsequent phases of the iMenu ecosystem.
