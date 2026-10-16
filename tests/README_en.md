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
│
└── phase-08-payment-bill/             # [✅ ACCEPTED] Phase 8: Payment, Bill, ESC/POS & Financial Audit
    ├── README.md                      # Comprehensive Phase 8 test guide (Vietnamese)
    ├── README_en.md                   # Comprehensive Phase 8 test guide (English)
    ├── payment-request-vietqr.test.ts # P8-01: Payment Request & Server-side VietQR (23 tests)
    ├── bills-complete-payment.test.ts # P8-02: Settlement, Bills & Atomic Table Release (18 tests)
    ├── financial-audit-log.test.ts    # P8-03: Financial Audit Log & Data Sanitization (9 tests)
    ├── escpos-receipt-encoder.test.ts # P8-04: ESC/POS Thermal Receipt Encoder 80mm/58mm (16 tests)
    ├── e2e-payment-bill-runner.test.ts# P8-E2E: Browser E2E Payment & Bill Lifecycle (5 tests)
    └── run-all-phase8.ts              # P8-MASTER: Master Test Orchestrator Phase 8 (98 tests)
```

---

## 2. 🗺️ Phase 8 Sub-phase Mapping

All Phase 8 functional sub-phases are consolidated inside `tests/phase-08-payment-bill/`:

| Sub-phase | Test File | Primary Focus | Test Count | Status |
| :--- | :--- | :--- | :---: | :---: |
| **8.1 Payment Request & VietQR** | `payment-request-vietqr.test.ts` | QR payment request, server-side VietQR, revert request, table/order status sync, AUD-8.1 (cross-table 404), AUD-8.4 (query amount ignored), AUD-8.2 (sync to `Occupied` on item add) | 23 | **PASS** |
| **8.2 Bills Engine & Idempotency**| `bills-complete-payment.test.ts`| Natural Idempotency settlement, cash change calculation, atomic table release, unique `Bill` generation (`upsert` + `E11000`), AUD-8.3 (block kitchen 403, permit `perm-pos-pay`), concurrency 5 parallel calls | 18 | **PASS** |
| **8.3 Financial Audit Logs** | `financial-audit-log.test.ts` | Immutable audit logging in `activity_logs`, filter & search payment/print history, financial privacy, AUD-8.3 (block waiter 403), AUD-8.5 (sanitize E11000 to 409 Conflict) | 9 | **PASS** |
| **8.4 ESC/POS Thermal Encoder** | `escpos-receipt-encoder.test.ts` | ESC/POS 80mm & 58mm compilation, ASCII Vietnamese sanitization, 48/32-col wrapping, native QR `GS ( k`, cash drawer `ESC p`, partial cut `GS V B 0`, buffer / base64 output | 16 | **PASS** |
| **8.5 Frontend SDK Contract** | `packages/utils/tests/sdk-contract.test.ts` | Frontend SDK Contract verification for Phase 8 endpoints: `orders.completePayment`, `orders.getReceipt`, `orders.getVietQr`, `customerOrders.requestPayment`, `bills.*`, `activityLogs.*`, `buildReceiptData`, `EscPosEncoder`, `thermalPrinterService` | 27 | **PASS** |
| **8.6 Cross-App Browser E2E** | `e2e-payment-bill-runner.test.ts`<br>*(with `scripts/e2e-payment-bill-lifecycle.mjs`)* | Real browser E2E test verifying complete payment lifecycle: Customer QR request $\rightarrow$ VietQR displayed $\rightarrow$ POS Cash settlement & change $\rightarrow$ Bill created & table freed $\rightarrow$ 80mm print | 5 | **PASS** |
| **8.6 Master Orchestrator** | `run-all-phase8.ts` | Master Test Orchestrator coordinating all 6 suites: Dev Mode (98 cases) & Acceptance Mode (Closure Gate) | N/A | **READY** |

---

## 3. ⚡ Master Test Commands

All test execution commands are registered in `package.json`:

### 🔹 Phase 8 (Payment & Bill) Tests:
```powershell
# Run the entire Phase 8 suite (98 tests):
npm run test:phase8:all

# Run in strict Acceptance mode (Closure Gate):
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
# Run the entire Phase 6 suite (288 tests):
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
# Phase 2: Auth, Restaurant & Multi-Branch (26 tests)
npm run test:phase2:all

# Phase 3: Staff & Dynamic RBAC (16 tests)
npm run test:phase3

# Phase 4: Menu, Categories & Toppings (17 tests)
npm run test:phase4

# Phase 5: Tables, Orders & Realtime KDS (18 tests)
npm run test:phase5

# Full regression for Phases 2–5 (77 tests):
npm run test:regression:phase2-5
```

---

## 4. 📊 Ecosystem Test Reconciliation Matrix (513 Test Cases)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  IMENU ECOSYSTEM AUTOMATED TEST MATRIX (PHASES 2 -> 8)                                 │
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Test Subsystem                 │ Test Scripts / Files         │ Actual Test Cases      │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ Phase 8 Payment & Bill Suites  │ 6 test files (BE + SDK + E2E)│ 98                     │
│ Phase 7 Kitchen / KDS Suites   │ 6 test files (BE + SDK + E2E)│ 50                     │
│ Phase 6 Orders & POS Suites    │ 9 test files (BE + SDK + E2E)│ 288                    │
│ Phases 2–5 Regression Suites   │ 5 test files                 │ 77                     │
├────────────────────────────────┴──────────────────────────────┴────────────────────────┤
│ ECOSYSTEM TOTAL (ACCEPTANCE CLOSURE REQUIREMENT)               │ 513 TEST CASES         │
│  - Passed in Developer/CI Run:                                 │ 491 / 491 PASS (100%)  │
│  - Browser E2E Checkpoints awaiting full local dev servers:    │ 22 Checkpoints         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
