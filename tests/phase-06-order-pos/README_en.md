# 🧪 Phase 6: Order Operations, POS & Table Synchronization (Order & POS Lifecycle)

> **Language:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Phase:** 6 — Order & POS Lifecycle  
> **Current Status:** **FULLY COMPLETED & CLOSED (PHASE 6.6 CLOSED)**  
> **Directory Convention:** `ONE PHASE = ONE TEST DIRECTORY` (All Phase 6 test artifacts are intentionally stored directly in this single directory).

---

## 1. Phase 6 Purpose & Architectural Context

Phase 6 is the mission-critical phase implementing the end-to-end Order Lifecycle, POS Cashier operations, Customer QR ordering, transaction deduplication / race condition control (Idempotency & Concurrency), and table-order state synchronization (Table ↔ Order Synchronization).

Per `imenu-api` repository architecture standard:
> **Repository Convention:** `ONE PHASE = ONE DIRECTORY`  
> Although Phase 6 encompasses multiple functional sub-phases (from 6.1 through 6.6), all Phase 6 automated test files are intentionally and strictly consolidated in this single directory `tests/phase-06-order-pos/`. Sub-phases do **NOT** have their own directories to prevent repository fragmentation.

---

## 2. Phase 6 Scope & Sub-phases

Phase 6 consists of 6 primary functional domains:

1. **Sub-phase 6.1 — Core Order & Table Lifecycle Baseline:** Core order lifecycle foundations, table-order associations, order rounds (`rounds[]`), and line items (`items[]`).
2. **Sub-phase 6.2 — State Machine & Business Invariants:** State machine transitions for orders and tables, immutable state constraints (Single active order per table, Paid is Terminal, RBAC state transition checks).
3. **Sub-phase 6.3 — POS Cashier & Billing Flows:** POS cashier workflows, tax calculations (VAT, service fee, discounts), Cash payments with exact change calculations (`changeAmount`), VietQR payments, and Quick-pay.
4. **Sub-phase 6.4 — Customer QR Ordering:** Table QR scanning, public digital menu access, batch order placement (`WaitingConfirmation`), staff review/confirmation (`Confirmed`), protection against duplicate active order creation.
5. **Sub-phase 6.5 — Idempotency Key & Concurrency Control:** `X-Idempotency-Key` middleware for caching and replaying duplicate requests, atomic multi-threaded POS payment claims (`Atomic Payment Claim`), financial invariant preservation.
6. **Sub-phase 6.6 — Table ↔ Order Synchronization & Transfer/Merge:** Hardened table-order lifecycle synchronization, table transfer (`transferTable`), table merge (`mergeTables`), item movement between tables (`moveItemsBetweenTables`), Split Bill flows, database-level atomic CAS (Compare-And-Swap) locking, and Optimistic Concurrency Control (OCC) Retries.
7. **Sub-phase 6.7 — Order Query, Filters, Search & Multi-Branch Optimization (IMPLEMENTED):** Comprehensive upgrade of `GET /api/orders` query API (date/time range filters `fromDate`/`toDate`, dynamic `dateField`, staff filters `staffId`/`createdBy`/`paidBy`, multi-status filter, payment method filter `paymentMethod`, safe regex search `orderCode`/`tableName`, deterministic sorting with `_id: -1` tie-breaker, pagination with `totalPages`, strict multi-branch scoping and MongoDB compound indexes).

---

## 3. Test Inventory

All 6 Phase 6 test suites reside directly inside this directory:

| Test File | Sub-phase | Verification Scope | Test Count | Status |
| :--- | :---: | :--- | :---: | :---: |
| **`state-machine.test.ts`** | 6.2 | Order state transitions (`WaitingConfirmation` $\rightarrow$ `Preparing` $\rightarrow$ `Ready` $\rightarrow$ `Served` $\rightarrow$ `Paid` / `Cancelled`), round confirmation/cancellation, item cancellations, subtotal recalculations, staff RBAC. | **56** | **PASS** |
| **`pos-cashier.test.ts`** | 6.3 | POS Cashier operations, financial calculation engine (VAT, service fees, discounts), Cash payments (change amount), VietQR payments, quick-pay, immutable Paid orders, tenant/branch isolation. | **30** | **PASS** |
| **`customer-qr.test.ts`** | 6.4 | Customer QR ordering, `WaitingConfirmation` rounds, staff confirmation flow, table binding, QR token validation, multi-tenant and branch boundaries. | **43** | **PASS** |
| **`idempotency-concurrency.test.ts`** | 6.5 | `X-Idempotency-Key` header re-identification (cached replay), concurrent payments via `Promise.all` (exactly 1 succeeds, 1 rejected), zero duplicate charges. | **32** | **PASS** |
| **`table-order-sync.test.ts`** | 6.6 | Table transfer (`transferTable`), table merge (`mergeTables`), item movement (`moveItemsBetweenTables`), split billing, CAS atomic locking against transfer races, OCC retries against Mongoose VersionError, defect regression suite. | **38** | **PASS** |
| **`order-query.test.ts`** | 6.7 | Order query filters (date range, dateField, staff, multi-status, payment method), safe regex search, deterministic pagination with `totalPages`, strict multi-branch isolation, index scan verification. | **42** | **PASS** |

---

## 4. Test Execution Commands

Test suites can be executed individually or collectively via NPM scripts registered in `package.json`:

```powershell
# 1. Run State Machine & Invariants tests (Phase 6.2)
npm run test:phase6:transitions
# Direct command:
npx ts-node tests/phase-06-order-pos/state-machine.test.ts

# 2. Run POS Cashier & Billing tests (Phase 6.3)
npm run test:phase6:pos
# Direct command:
npx ts-node tests/phase-06-order-pos/pos-cashier.test.ts

# 3. Run Customer QR ordering tests (Phase 6.4)
npm run test:phase6:customer-qr
# Direct command:
npx ts-node tests/phase-06-order-pos/customer-qr.test.ts

# 4. Run Idempotency & Concurrency tests (Phase 6.5)
npm run test:phase6:concurrency
# Direct command:
npx ts-node tests/phase-06-order-pos/idempotency-concurrency.test.ts

# 5. Run Table-Order Sync, Transfer & Merge tests (Phase 6.6)
npm run test:phase6:sync
# Direct command:
npx ts-node tests/phase-06-order-pos/table-order-sync.test.ts

# 6. Run Order Query, Filters, Search & Multi-Branch tests (Phase 6.7)
npm run test:phase6:query
# Direct command:
npx ts-node tests/phase-06-order-pos/order-query.test.ts

# 7. Run all Phase 6 tests sequentially (All 6 test files)
npm run test:phase6
```

---

## 5. Current Status

- **Sub-phase 6.7 Status:** **HARDENED & VERIFIED**, with 42/42 automated tests passing 100%.
- **Phase 6 Total:** 241 automated tests passing (100% Passed, Zero Failures).

---

## 6. Regression Coverage

For any subsequent code modifications, the full regression test suite must achieve 100% pass:
- **Phase 5 Integration Suite:** `npm run test:phase5` (18 tests — Tables, Orders, KDS WebSockets).
- **Phase 6.2 State Machine Suite:** `npm run test:phase6:transitions` (56 tests).
- **Phase 6.3 POS Cashier Suite:** `npm run test:phase6:pos` (30 tests).
- **Phase 6.6 Table Sync Suite:** `npm run test:phase6:sync` (38 tests).
- **Total Automated Test Suite:** **142 tests passing (100% Passed, Zero Failures)**.

---

## 7. Architectural & Testing Notes

1. **Process-Isolated Test Servers:** Each test file launches an independent NestJS application instance on a dedicated test port (e.g. `3098`, `3099`, `3100`, `3101`), creates fixtures with unique timestamps, and performs complete teardown (`Zero Garbage`).
2. **Partial Unique Index Guard:** Database constraint `{ restaurantId: 1, tableId: 1 }` with `partialFilterExpression` guarantees that at most one active order exists per table across the restaurant.
3. **Atomic CAS State Transitions:** Table transfers use atomic `tableModel.findOneAndUpdate` with conditional checks on table status and automatic rollback if the target table cannot be claimed.
4. **Optimistic Concurrency Control (OCC):** Item movement and table merge operations are wrapped in retry loops catching `VersionError` with backoff jitter, eliminating unhandled 500 server errors during concurrent access.
