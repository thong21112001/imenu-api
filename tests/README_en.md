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
└── phase-07-kitchen-kds/              # [✅ ACCEPTED] Phase 7: Kitchen Display System (KDS) & Realtime Dish Dispatching
    ├── README.md                      # Comprehensive Phase 7 test guide (Vietnamese)
    ├── README_en.md                   # Comprehensive Phase 7 test guide (English)
    ├── kds-queue-query.test.ts        # P7-01: KDS Queue, FIFO, Filters, Search & Hardening AUD-7.5 (9 tests)
    ├── kds-state-transitions.test.ts  # P7-02: Dish Lifecycle, Order Status Upgrades & Hardening AUD-7.1/7.2 (10 tests)
    ├── kds-concurrency-idempotency.test.ts # P7-03: Double-click Idempotency, OCC Locks & Hardening AUD-7.3 (5 tests)
    ├── kds-out-of-stock.test.ts       # P7-04: 86 Stockout, Branch Isolation, Realtime & Hardening AUD-7.4 (6 tests)
    ├── e2e-kds-runner.test.ts         # P7-E2E: Wrapper calling Browser E2E KDS Lifecycle (6 checkpoints)
    └── run-all-phase7.ts              # P7-MASTER: Master Test Orchestrator Phase 7 (50 tests)
```

---

## 2. 🗺️ Phase 7 Sub-phase Mapping

All Phase 7 functional sub-phases are consolidated inside `tests/phase-07-kitchen-kds/`:

| Sub-phase | Test File | Primary Focus | Test Count | Status |
| :--- | :--- | :--- | :---: | :---: |
| **7.1 KDS Queue Engine** | `kds-queue-query.test.ts` | FIFO Queue (`createdAt ASC`), filters (`zoneId`, `tableId`, `status`), `Paid`/`Cancelled` exclusion, items summary aggregation, hardening AUD-7.5 | 9 | **PASS** |
| **7.2 State Machine & Upgrade**| `kds-state-transitions.test.ts`| `start-cooking`, `mark-ready`, `mark-served`, auto order status upgrades (`Preparing`, `Ready`, `Served`), batch round updates, hardening AUD-7.1/7.2 | 10 | **PASS** |
| **7.3 Concurrency & Idempotency**| `kds-concurrency-idempotency.test.ts`| Double-click idempotency (200 OK idempotent), OCC concurrency resolution, Zero Lost Update, hardening AUD-7.3 (Cashier Pay vs Cook Update race condition) | 5 | **PASS** |
| **7.4 Out-of-Stock (86) & Realtime**| `kds-out-of-stock.test.ts` | Branch-isolated 86 stockout, Blueprint Edge Case #2, 3-way WebSocket synchronization, hardening AUD-7.4 (guest room isolation) | 6 | **PASS** |
| **7.5 Frontend SDK Contract** | `packages/utils/tests/sdk-contract.test.ts` | Frontend SDK contract testing for all KDS API endpoints (`apiClient.kitchen.*`) | 14 | **PASS** |
| **7.6 Cross-App Browser E2E** | `e2e-kds-runner.test.ts`<br>*(with `scripts/e2e-kds-lifecycle.mjs`)* | Real browser E2E automated test verifying the full kitchen dish dispatch lifecycle | 6 | **PASS** |
| **7.6 Master Orchestrator** | `run-all-phase7.ts` | Phase 7 Master Test Orchestrator: Dev mode (50 tests) & Acceptance mode (Closure Gate) | N/A | **READY** |

---

## 3. ⚡ Master Test Commands

All test execution commands are registered in `package.json`:

### 🔹 Phase 7 (Kitchen / KDS) Tests:
```powershell
# Run the entire Phase 7 suite (50 tests):
npm run test:phase7:all

# Run in strict Acceptance mode:
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
# Run the full Phase 6 test suite (288 tests):
npm run test:phase6:all
npm run test:phase6:acceptance

# Run individual Phase 6 subsystems:
npm run test:phase6:transitions  # Sub-phase 6.2: State Machine (56 tests)
npm run test:phase6:pos          # Sub-phase 6.3: POS Cashier (30 tests)
npm run test:phase6:customer-qr  # Sub-phase 6.4: Customer QR (43 tests)
npm run test:phase6:concurrency  # Sub-phase 6.5: Idempotency (32 tests)
npm run test:phase6:sync         # Sub-phase 6.6: Table Sync & Transfer (38 tests)
npm run test:phase6:query        # Sub-phase 6.7: Order Query & Filters (42 tests)
npm run test:phase6:integration  # Sub-phase 6.8: Frontend Monorepo Integration (29 tests)
npm run test:phase6:e2e          # Sub-phase 6.9: Browser E2E Lifecycle (9 checkpoints)
```

### 🔹 Ecosystem Regression Tests (Phases 2–5):
```powershell
# Phase 2: Auth, Restaurant & Multi-Branch (26 tests)
npm run test:phase2:all

# Phase 3: Staff & RBAC (16 tests)
npm run test:phase3

# Phase 4: Menu, Categories & Toppings (17 tests)
npm run test:phase4

# Phase 5: Tables, Orders & Realtime KDS (18 tests)
npm run test:phase5

# Full Phases 2–5 regression (77 tests):
npm run test:regression:phase2-5
```

---

## 4. 📊 415 Ecosystem Automated Tests Reconciliation Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  IMENU TESTING ECOSYSTEM — 415 TOTAL AUTOMATED TESTS RECONCILIATION                    │
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Test Subsystem                 │ Source Files / Location      │ Actual Test Count      │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ Phase 7 Kitchen / KDS Suites   │ 6 test files (BE + SDK + E2E)│ 50                     │
│ Phase 6 Orders & POS Suites    │ 9 test files (BE + SDK + E2E)│ 288                    │
│ Phases 2–5 Regression Suites   │ 5 test files                 │ 77                     │
├────────────────────────────────┴──────────────────────────────┼────────────────────────┤
│ TOTAL ECOSYSTEM TESTS (ACCEPTANCE CLOSURE REQUIREMENT)         │ 415 TESTS              │
└───────────────────────────────────────────────────────────────┴────────────────────────┘
```
