# 🧪 iMenu Backend Automated Test Suite (Master Index)

> **Language:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Project:** iMenu API Backend  
> **Testing Architectural Convention:** `ONE PHASE = ONE TEST DIRECTORY` (Each Phase owns exactly one dedicated test directory. All test files belonging to the sub-phases reside directly inside that Phase directory).

---

## 1. 📁 Test Directory Structure (Phase Directory Layout)

The test suite for `imenu-api` strictly adheres to the architectural convention: **One Phase corresponds to exactly one test directory**. All automated test files belonging to a Phase (even when divided into multiple functional sub-phases) reside directly inside that Phase directory, complete with bilingual documentation:

```text
tests/
├── README.md                          # Master testing index & conventions (Vietnamese)
├── README_en.md                       # Master testing index & conventions (English)
│
├── phase-02-auth-restaurant/           # [COMPLETED] Phase 2: Auth, Restaurant & Multi-Branch
│   ├── test.ts                        # E2E Scenario Part 1: Auth, Restaurant & Branch CRUD (12 tests)
│   ├── test-multi-branch.ts           # E2E Scenario Part 2: Multi-Branch Lifecycle & Isolation (12 tests)
│   ├── README.md                      # Detailed Phase 2 test guide (Vietnamese)
│   └── README_en.md                   # Detailed Phase 2 test guide (English)
│
├── phase-03-staff-rbac/               # [COMPLETED] Phase 3: Staff, RBAC & Auto-Redirect
│   ├── test.ts                        # E2E Scenario: Super Admin ENV, Soft Delete, Cross-Tenant Staff, VietQR (16 tests)
│   ├── README.md                      # Detailed Phase 3 test guide (Vietnamese)
│   └── README_en.md                   # Detailed Phase 3 test guide (English)
│
├── phase-04-menu/                     # [COMPLETED] Phase 4: Menu, Categories & Toppings
│   ├── test.ts                        # E2E Scenario: Categories, Items, Toppings, Cashier toggle, QR (17 tests)
│   ├── README.md                      # Detailed Phase 4 test guide (Vietnamese)
│   └── README_en.md                   # Detailed Phase 4 test guide (English)
│
├── phase-05-order-table-kds/          # [COMPLETED] Phase 5: Tables, Orders & Realtime KDS
│   ├── test.ts                        # E2E Scenario: Tables, Zones, Orders, KDS WebSockets, RBAC (18 tests)
│   ├── README.md                      # Detailed Phase 5 test guide (Vietnamese)
│   └── README_en.md                   # Detailed Phase 5 test guide (English)
│
├── phase-06-order-pos/                # [COMPLETED] Phase 6: Order & POS Lifecycle
│   ├── README.md                      # Comprehensive Phase 6 test guide (Vietnamese)
│   ├── README_en.md                   # Comprehensive Phase 6 test guide (English)
│   ├── thermal-printer-spec.md        # Phase 8 80mm ESC/POS hardware thermal printer architecture spec (Doc only)
│   ├── state-machine.test.ts          # Sub-phase 6.2: State Machine, Round/Item Cancellation & Invariants (56 tests)
│   ├── pos-cashier.test.ts            # Sub-phase 6.3: POS Cashier, Taxes/Fees, Cash Change & VietQR (30 tests)
│   ├── customer-qr.test.ts            # Sub-phase 6.4: Customer QR Ordering & Staff Approval (43 tests)
│   ├── idempotency-concurrency.test.ts# Sub-phase 6.5: Idempotency Key & Concurrent Payment Claims (32 tests)
│   ├── table-order-sync.test.ts       # Sub-phase 6.6: Table Transfer, Merge, Move Items & CAS Locks (38 tests)
│   ├── order-query.test.ts            # Sub-phase 6.7: Order Query, Filters, Search & Branch Isolation (42 tests)
│   ├── subphase-6-8-integration.test.ts # Sub-phase 6.8: Frontend Monorepo Integration & Room Auth (29 tests)
│   ├── e2e-browser-runner.test.ts     # Sub-phase 6.9: Wrapper calling Puppeteer browser E2E scenario (9 checkpoints)
│   └── run-all-phase6.ts              # Sub-phase 6.9: Master Test Orchestrator (288 tests)
│
├── phase-07-kitchen-kds/              # [COMPLETED] Phase 7: Kitchen Display System (KDS) & Realtime Dish Dispatching
│   ├── README.md                      # Comprehensive Phase 7 test guide (Vietnamese)
│   ├── README_en.md                   # Comprehensive Phase 7 test guide (English)
│   ├── kds-queue-query.test.ts        # P7-01: KDS Queue, FIFO, Filters, Search & Hardening AUD-7.5 (9 tests)
│   ├── kds-state-transitions.test.ts  # P7-02: Dish Lifecycle, Order Status Upgrades & Hardening AUD-7.1/7.2 (10 tests)
│   ├── kds-concurrency-idempotency.test.ts # P7-03: Double-click Idempotency, OCC Locks & Hardening AUD-7.3 (5 tests)
│   ├── kds-out-of-stock.test.ts       # P7-04: 86 Stockout, Branch Isolation, Realtime & Hardening AUD-7.4 (6 tests)
│   ├── e2e-kds-runner.test.ts         # P7-E2E: Wrapper calling Browser E2E KDS Lifecycle (6 checkpoints)
│   └── run-all-phase7.ts              # P7-MASTER: Master Test Orchestrator Phase 7 (50 tests)
├── phase-08-payment-bill/             # [COMPLETED] Phase 8: Payment, Bill, ESC/POS & Financial Audit
│   ├── README.md                      # Comprehensive Phase 8 test guide (Vietnamese)
│   ├── README_en.md                   # Comprehensive Phase 8 test guide (English)
│   ├── payment-request-vietqr.test.ts # P8-01: Payment Request & Server-side VietQR (23 tests)
│   ├── bills-complete-payment.test.ts # P8-02: Settlement, Bills & Atomic Table Release (18 tests)
│   ├── financial-audit-log.test.ts    # P8-03: Financial Audit Log & Data Sanitization (9 tests)
│   ├── escpos-receipt-encoder.test.ts # P8-04: ESC/POS Thermal Receipt Encoder 80mm/58mm (16 tests)
│   ├── e2e-payment-bill-runner.test.ts# P8-E2E: Browser E2E Payment & Bill Lifecycle (5 tests)
│   └── run-all-phase8.ts              # P8-MASTER: Master Test Orchestrator Phase 8 (98 tests)
│
├── phase-09-dashboard-reports/        # [COMPLETED] Phase 9: Dashboard, Revenue Reports & UI/UX Overhaul
│   ├── README.md                      # Comprehensive Phase 9 test guide (Vietnamese)
│   ├── README_en.md                   # Comprehensive Phase 9 test guide (English)
│   ├── dashboard-overview.test.ts     # P9-01: Realtime KPI Indicators & Dual-Key Engine (16 tests)
│   ├── reports-revenue-analytics.test.ts # P9-02: Revenue Reports & Payment Breakdown (13 tests)
│   ├── reports-top-items.test.ts      # P9-03: Top Selling Dishes & Options Delta (7 tests)
│   ├── reports-export-rbac.test.ts    # P9-04: UTF-8 BOM CSV Export for Excel & RBAC (10 tests)
│   ├── customer-demo-tables.test.ts   # P9-05: Public Demo Tables & QR Resolution (7 tests)
│   ├── e2e-dashboard-reports-runner.test.ts # P9-06: Browser E2E Dashboard, Reports & UI (4 tests)
│   └── run-all-phase9.ts              # P9-MASTER: Master Test Orchestrator Phase 9 (57 tests)
│
└── phase-10-realtime/                  # [✅ ACCEPTED] Phase 10: Realtime WebSocket, Room Security & Ecosystem Finalization
    ├── README.md                      # Comprehensive Phase 10 test guide (Vietnamese)
    ├── README_en.md                   # Comprehensive Phase 10 test guide (English)
    ├── call-staff-notification.test.ts # P10-01: Call Staff & Two-Way Acknowledgment (16 tests)
    ├── websocket-room-security.test.ts # P10-02: WebSocket Room Security & Multi-Branch Isolation (13 tests)
    ├── domain-events-matrix.test.ts   # P10-03: Domain Events Matrix 7 Realtime Groups (11 tests)
    ├── subphase-10-4-client-resilience.test.ts # P10-04B: Reconnection Backoff Jitter & Deduplication (8 tests)
    ├── e2e-realtime-runner.test.ts    # P10-05: Multi-Tab Browser E2E Realtime Ecosystem (3 tests)
    └── run-all-phase10.ts             # P10-MASTER: Master Test Orchestrator Phase 10 (85 tests)
```

---

## 2. 🗺️ Phase 10 Sub-phase Mapping

All Phase 10 functional sub-phases are consolidated inside `tests/phase-10-realtime/`:

| Sub-phase | Test File | Primary Focus | Test Count | Status |
| :--- | :--- | :--- | :---: | :---: |
| **10.1 Call Staff & Acknowledgment** | `call-staff-notification.test.ts` | Customer call staff, two-way staff acknowledgment, branch isolation, 60s cooldown (`isCooldownReplay`), `reason`/`note` length limits, TTL map eviction, RBAC `perm-pos-view`, hardening TC-10.1.14–16 | 16 | **PASS** |
| **10.2 WebSocket Room Security** | `websocket-room-security.test.ts` | JWT Bearer handshake auth, hierarchical room isolation (`restaurant_${id}`, `branch_${id}`, `table_${id}`), guest isolation from staff rooms, room cleanup on `switch:branch` and `leave:restaurant`, hardening TC-10.2.11–13 | 13 | **PASS** |
| **10.3 Domain Events Matrix** | `domain-events-matrix.test.ts` | 7 domain event groups (New Order, Order Updated, Item Status, Table Status, Call Staff, Payment & Bill, KDS 86 Out-of-Stock), payload integrity and broadcast verification | 11 | **PASS** |
| **10.4 Frontend SDK Contract** | `packages/utils/tests/sdk-contract.test.ts` | Frontend SDK Contract verification: `tables.callStaff` (SDK-30), `tables.acknowledgeCall` (SDK-31), `customerOrders.callStaff` (SDK-32) plus 31 inherited contract tests | 34 | **PASS** |
| **10.4 Client Resilience Suite** | `subphase-10-4-client-resilience.test.ts` | Client resilience, Reconnection Jitter Backoff, `CANONICAL_EVENT_MAP` deduplication, FIFO 50-notification ring buffer, hardening TC-10.4.6–8 | 8 | **PASS** |
| **10.5 Multi-Tab Browser E2E** | `e2e-realtime-runner.test.ts` | Real browser multi-tab E2E: Diner calls staff $\rightarrow$ Admin Header audio badge displays without reload; Staff acknowledges $\rightarrow$ Diner receives confirmation toast; Zero-reload full lifecycle | 3 | **PASS** |
| **10.6 Master Orchestrator** | `run-all-phase10.ts` | Master Test Orchestrator Phase 10: Dev Mode (Suites 1–5 Backend & SDK: 82 tests) & Acceptance Mode (Full 6 Suites: 85 tests) | N/A | **READY** |

---

## 3. ⚡ Master Test Commands

All test execution commands are registered in `package.json`:

### 🔹 Phase 10 (Realtime & Ecosystem Finalization) Tests:
```powershell
# Run the entire Phase 10 suite (85 tests):
npm run test:phase10:all

# Run in strict Acceptance mode (Official Quality Gate):
npm run test:phase10:acceptance

# Run individual Phase 10 suites:
npm run test:phase10:call-staff  # Suite 1: Call Staff & Acknowledgment Flow (16 tests)
npm run test:phase10:security    # Suite 2: WebSocket Room Security & Isolation (13 tests)
npm run test:phase10:events      # Suite 3: Domain Events Matrix 7 Groups (11 tests)
npm run test:phase10:sdk         # Suite 4A: Frontend SDK Contract (34 tests)
npm run test:phase10:resilience  # Suite 4B: Client Resilience & Deduplication (8 tests)
npm run test:phase10:e2e         # Suite 5: Browser E2E Multi-Tab Ecosystem (3 tests)
npm run test:phase10             # Run all 4 Backend suites sequentially (48 tests)
```

### 🔹 Phase 9 (Dashboard & Reports) Tests:
```powershell
# Run the entire Phase 9 suite (57 tests):
npm run test:phase9:all

# Run in strict Acceptance mode (Closure Gate):
npm run test:phase9:acceptance

# Run individual Phase 9 suites:
npm run test:phase9:overview    # Suite 1: Dashboard Overview KPI & Dual-Key Engine (16 tests)
npm run test:phase9:revenue     # Suite 2: Revenue Reports Analytics & Payment Breakdown (13 tests)
npm run test:phase9:top-items   # Suite 3: Top Selling Items & Options Delta (7 tests)
npm run test:phase9:export      # Suite 4: CSV Report Export UTF-8 BOM & RBAC (10 tests)
npm run test:phase9:demo-tables # Suite 5: Public Demo Tables Discovery (7 tests)
npm run test:phase9:e2e         # Suite 6: Browser E2E Dashboard, Reports & UI (4 tests)
npm run test:phase9             # Run all 5 Backend suites sequentially (53 tests)
```

### 🔹 Phase 8 (Payment & Bill) Tests:
```powershell
# Run the entire Phase 8 suite (98 tests):
npm run test:phase8:all
npm run test:phase8:acceptance

# Run individual Phase 8 suites:
npm run test:phase8:request    # Suite 1: Payment Request & VietQR (23 tests)
npm run test:phase8:bills      # Suite 2: Settlement, Bills & Tables (18 tests)
npm run test:phase8:audit      # Suite 3: Financial Audit Log (9 tests)
npm run test:phase8:escpos     # Suite 4: ESC/POS Receipt Encoder (16 tests)
npm run test:phase8:e2e        # Suite E2E: Browser E2E Payment & Bill (5 tests)
npm run test:phase8            # Run all 4 backend suites sequentially (66 tests)
```

### 🔹 Phase 7 (Kitchen / KDS) Tests:
```powershell
# Run the entire Phase 7 suite (50 tests):
npm run test:phase7:all
npm run test:phase7:acceptance

# Run individual Phase 7 suites:
npm run test:phase7:query        # Suite 1: KDS Queue, FIFO & Filters (9 tests)
npm run test:phase7:transitions  # Suite 2: Dish Lifecycle & Guards (10 tests)
npm run test:phase7:concurrency  # Suite 3: Double-click Idempotency & OCC Locks (5 tests)
npm run test:phase7:out-of-stock # Suite 4: 86 Stockout & Realtime (6 tests)
npm run test:phase7:e2e          # Suite E2E: Browser E2E KDS Lifecycle (6 tests)
npm run test:phase7              # Run all 4 Backend suites sequentially (30 tests)
```

### 🔹 Phase 6 (Order & POS) Tests:
```powershell
# Run the entire Phase 6 suite (279 mandatory tests):
npm run test:phase6:all
npm run test:phase6:acceptance

# Run individual Phase 6 suites:
npm run test:phase6:transitions  # Sub-phase 6.2: State Machine (56 tests)
npm run test:phase6:pos          # Sub-phase 6.3: POS Cashier (30 tests)
npm run test:phase6:customer-qr  # Sub-phase 6.4: Customer QR (43 tests)
npm run test:phase6:concurrency  # Sub-phase 6.5: Idempotency (32 tests)
npm run test:phase6:sync         # Sub-phase 6.6: Table Sync & Transfer (38 tests)
npm run test:phase6:query        # Sub-phase 6.7: Order Query & Filters (42 tests)
npm run test:phase6:integration  # Sub-phase 6.8: Frontend Monorepo Integration (29 tests)
npm run test:phase6:e2e          # Sub-phase 6.9: Browser E2E Lifecycle (9 checkpoints)
```

### 🔹 Full Ecosystem Regressions (Phases 2–5):
```powershell
# Phase 2: Auth, Restaurant & Multi-Branch (23 tests)
npm run test:phase2:all

# Phase 3: Staff & Dynamic RBAC (16 tests)
npm run test:phase3

# Phase 4: Menu, Categories & Toppings (17 tests)
npm run test:phase4

# Phase 5: Tables, Orders & Realtime KDS (18 tests)
npm run test:phase5

# Full regression for Phases 2–5 (74 tests):
npm run test:regression:phase2-5
```

---

## 4. 📊 Ecosystem Test Reconciliation Matrix (643 Test Cases)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  IMENU ECOSYSTEM AUTOMATED TEST MATRIX (PHASES 2 -> 10)                                │
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Test Subsystem                 │ Test Scripts / Files         │ Actual Test Cases      │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ Phase 10 Realtime & Ecosystem  │ 6 test files (BE + SDK + E2E)│ 85 (100% PASS)         │
│ Phase 9 Dashboard & Reports    │ 7 test files (BE + SDK + E2E)│ 57                     │
│ Phase 8 Payment & Bill Suites  │ 6 test files (BE + SDK + E2E)│ 98                     │
│ Phase 7 Kitchen / KDS Suites   │ 6 test files (BE + SDK + E2E)│ 50                     │
│ Phase 6 Orders & POS Suites    │ 9 test files (BE + SDK + E2E)│ 279                    │
│ Phases 2–5 Regression Suites   │ 5 test files                 │ 74                     │
├────────────────────────────────┴──────────────────────────────┴────────────────────────┤
│ ECOSYSTEM TOTAL (FULL ECOSYSTEM ROADMAP ACCEPTED)              │ 643 TEST CASES (PASS)  │
│  - Passed in Developer/CI Run:                                 │ 643 / 643 PASS (100%)  │
│  - Failure & Blocked Rates:                                    │ 0 FAIL, 0 BLOCKED      │
│  - Full 10-Phase Roadmap Acceptance Status:                    │ ✅ 10/10 PHASES PASSED │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

