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
│   ├── test.ts                        # E2E Scenario: Tables, Zones, Orders, KDS WebSockets, RBAC (20 tests)
│   ├── README.md                      # Detailed Phase 5 test guide (Vietnamese)
│   └── README_en.md                   # Detailed Phase 5 test guide (English)
│
└── phase-06-order-pos/                # [SUB-PHASE 6.9 IMPLEMENTED — MASTER CLOSURE GATE READY] Phase 6: Order & POS Lifecycle
    ├── README.md                      # Comprehensive Phase 6 test guide (Vietnamese)
    ├── README_en.md                   # Comprehensive Phase 6 test guide (English)
    ├── thermal-printer-spec.md        # Phase 8 80mm ESC/POS hardware thermal printer architecture spec (Doc only)
    ├── state-machine.test.ts          # Sub-phase 6.2: State Machine, Round/Item Cancellation & Invariants (56 tests)
    ├── pos-cashier.test.ts            # Sub-phase 6.3: POS Cashier, Taxes/Fees, Cash Change & VietQR (30 tests)
    ├── customer-qr.test.ts            # Sub-phase 6.4: Customer QR Ordering & Staff Approval (43 tests)
    ├── idempotency-concurrency.test.ts# Sub-phase 6.5: Idempotency Key & Concurrent Payment Claims (32 tests)
    ├── table-order-sync.test.ts       # Sub-phase 6.6: Table Transfer, Merge, Move Items & CAS Locks (38 tests)
    ├── order-query.test.ts            # Sub-phase 6.7: Order Query, Filters, Search & Branch Isolation (42 tests)
    ├── subphase-6-8-integration.test.ts # Sub-phase 6.8: Frontend Monorepo Integration & Room Auth (29 tests)
    ├── e2e-browser-runner.test.ts     # Sub-phase 6.9: Wrapper calling Puppeteer browser E2E scenario (9 checkpoints)
    └── run-all-phase6.ts              # Sub-phase 6.9: Master Test Orchestrator (Dev 279 tests & Acceptance 365 tests)
```

---

## 2. 🗺️ Phase 6 Sub-phase Mapping

All Phase 6 functional sub-phases are consolidated inside `tests/phase-06-order-pos/`:

| Sub-phase | Test File | Primary Focus | Test Count | Status |
| :--- | :--- | :--- | :---: | :---: |
| **6.2 State Machine** | `state-machine.test.ts` | Order lifecycle state machine, Invariants, item/round cancellations | 56 | **PASS** |
| **6.3 POS Cashier** | `pos-cashier.test.ts` | Cashier workflows, VAT, Service fee, Cash change calculations, VietQR | 30 | **PASS** |
| **6.4 Customer QR** | `customer-qr.test.ts` | Customer QR ordering, `WaitingConfirmation` batches, staff confirmation | 43 | **PASS** |
| **6.5 Idempotency** | `idempotency-concurrency.test.ts` | `X-Idempotency-Key` header, duplicate request replay, concurrency protection | 32 | **PASS** |
| **6.6 Table Sync** | `table-order-sync.test.ts` | Table transfer, merge, move items, split billing, atomic CAS locks | 38 | **PASS** |
| **6.7 Order Query** | `order-query.test.ts` | Date/time filters, staff, multi-status, safe regex search, branch isolation | 42 | **PASS** |
| **6.8 Monorepo Integration** | `subphase-6-8-integration.test.ts` | Frontend monorepo integration, POS QR approval, Room Auth (`AUD-6.8-01`) | 29 | **PASS** |
| **6.9 Cross-App Browser E2E**| `e2e-browser-runner.test.ts`<br>*(with `scripts/e2e-order-lifecycle.mjs`)* | Real browser E2E 9 checkpoints: Customer QR Menu $\leftrightarrow$ POS Cashier Lifecycle | 9 | **READY** |
| **6.9 Master Orchestrator** | `run-all-phase6.ts` | Master Test Runner: Dev mode (279 tests) & Acceptance mode (365 tests) | N/A | **READY** |

---

## 3. ⚡ Master Test Commands

All test scripts are registered in `package.json`:

### 🔹 Master Test Orchestrator Commands:
```powershell
# 1. Developer Test Run (Executes 270 backend + 9 SDK = 279 mandatory tests; allows SKIP for E2E if UI servers down)
npm run test:phase6:all

# 2. Final Acceptance Run (Official Closure Gate: 365 mandatory tests, 0 SKIP, 0 FAIL)
npm run test:phase6:acceptance
```

### 🔹 Execute Tests by Phase & Full Regression:
```powershell
# Phase 2: Auth, Restaurant & Multi-Branch (24 tests)
npm run test:phase2:all

# Phase 3: Staff & RBAC Permissions (16 tests)
npm run test:phase3

# Phase 4: Menu, Categories & Toppings (17 tests)
npm run test:phase4

# Phase 5: Tables, Orders & Realtime KDS (20 tests)
npm run test:phase5

# Entire Phases 2-5 Regression (77 tests):
npm run test:regression:phase2-5
```

### 🔹 Execute Phase 6 Tests (Order & POS):
```powershell
# Run standard 6 backend suites (241 tests):
npm run test:phase6

# Or run individual sub-phase suites:
npm run test:phase6:transitions  # Sub-phase 6.2: State Machine (56 tests)
npm run test:phase6:pos          # Sub-phase 6.3: POS Cashier (30 tests)
npm run test:phase6:customer-qr  # Sub-phase 6.4: Customer QR (43 tests)
npm run test:phase6:concurrency  # Sub-phase 6.5: Idempotency (32 tests)
npm run test:phase6:sync         # Sub-phase 6.6: Table Sync & Transfer (38 tests)
npm run test:phase6:query        # Sub-phase 6.7: Order Query & Filters (42 tests)
npm run test:phase6:integration  # Sub-phase 6.8: Frontend Monorepo Integration (29 tests)
npm run test:phase6:e2e          # Sub-phase 6.9: Browser E2E Lifecycle (9 checkpoints)
```

---

## 4. 📊 Reconciled 365-Case Test Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│  IMENU TESTING ECOSYSTEM — 365 RECONCILED AUTOMATED TEST CASES         │
├────────────────────────────────┬──────────────────────┬────────────────┤
│ Test Domain                    │ Test Suites / Files  │ Case Count     │
├────────────────────────────────┼──────────────────────┼────────────────┤
│ Phase 6 Backend Suites         │ 7 test suites        │ 270            │
│ Frontend SDK Contract Suite    │ 1 test suite         │ 9              │
│ Browser E2E Checkpoints Suite  │ 1 E2E script         │ 9              │
│ Phases 2–5 Regression Suites   │ 5 test suites        │ 77             │
├────────────────────────────────┴──────────────────────┼────────────────┤
│ ECOSYSTEM TOTAL (FINAL ACCEPTANCE CLOSURE REQUIREMENT)│ 365 TESTS      │
└───────────────────────────────────────────────────────┴────────────────┘
```
