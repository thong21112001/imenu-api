# 🧪 Phase 8: Payment, Bill, ESC/POS Thermal Printing & Financial Audit

> **Languages:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)<br>
> **Phase:** 8 — Payment, Bill, ESC/POS Thermal Printing & Financial Audit<br>
> **Subsystem Status:** **✅ OFFICIALLY ACCEPTED & CLOSED (PHASE 8 CLOSURE GATE PASSED)**<br>
> **Architectural Convention:** `ONE PHASE = ONE TEST DIRECTORY` (All Phase 8 test artifacts are centrally located in this directory).

---

## 1. Purpose & Business Context (Phase 8 Purpose)

Phase 8 is the core financial module completing the entire F&B business cycle: **Customer requests payment (QR Menu) $\rightarrow$ Cashier reviews & prints 80mm pre-bill $\rightarrow$ Multi-method settlement (Dynamic Server-side VietQR, Cash with change calculation, Card, Transfer) $\rightarrow$ Natural Idempotent unique `Bill` generation $\rightarrow$ Atomic table release $\rightarrow$ 80mm/58mm ESC/POS thermal printing compilation $\rightarrow$ Immutable financial audit logging (`activity_logs`)**.

Per `imenu-api` architectural conventions:
> **Convention:** `ONE PHASE = ONE TEST DIRECTORY`  
> All automated test files, orchestrators, and test documentation for Phase 8 (from 8.1 to 8.6) are stored uniformly within `tests/phase-08-payment-bill/`. Sub-phases do **not** create separate subdirectories.

---

## 2. Business Scope & Sub-phases (Phase 8 Scope)

Phase 8 consists of 6 complete operational sub-phases:

1. **Sub-phase 8.1 — Customer Payment Request Flow & Dynamic Server-side VietQR:**
   - Public customer APIs: `POST /api/orders/customer/:id/request-payment`, `GET /api/orders/customer/:id/vietqr`, and `GET /api/orders/customer/:id/receipt`.
   - Strict QR session authentication verifying `restaurantSlug`, `tableCode`, and `qrToken` (must be `active`).
   - Order transition to `PaymentRequested` and table status synchronization via WebSocket `order:payment_requested` and `table:status_updated`.
   - Independent server-side VietQR amount recalculation from active items (`status !== 'Cancelled'`), completely ignoring client query `amount`.
   - Revert payment request support (`POST /api/orders/:id/revert-payment-request`).

2. **Sub-phase 8.2 — Bills Engine, Natural Idempotent Settlement & Table Release:**
   - Idempotent settlement API: `POST /api/orders/:id/complete-payment` (or `POST /api/orders/:id/pay`).
   - Natural Idempotency: Reuses the same `Idempotency-Key` across network retries; if the order is already `Paid`, returns the existing bill with `X-Idempotent-Replay: true`.
   - Atomic CAS (`findOneAndUpdate` with `$setOnInsert` and `upsert: true`) combined with `E11000` handling guarantees that in extreme concurrency, each `Order` generates exactly 1 `Bill`.
   - Full payment method support: `Cash` (change calculation: `changeAmount = receivedAmount - finalAmount`), `VietQR`, `Card`, `Transfer`.
   - Immediate automatic release of tables to `Available` (`currentOrderId: null`) upon payment success.

3. **Sub-phase 8.3 — Financial Activity Logs & Audit Reconciliation:**
   - Immutable audit logging of sensitive financial actions in `activity_logs`: `PAYMENT_COMPLETED`, `PAYMENT_REVERTED`, `BILL_PRINTED`, `ORDER_CANCELLED`.
   - Complete financial snapshot: `subTotal`, `discountAmount`, `serviceFee`, `vatAmount`, `finalAmount`, `paymentMethod`, `cashReceived`, `cashChange`.
   - Audit trail query API: `GET /api/activity-logs` with filters for `branchId`, `action`, `startDate`, `endDate`, and `search`.
   - Strict RBAC: Restricted to managerial roles (`restaurant_admin`, `restaurant_manager`, `system_admin`).

4. **Sub-phase 8.4 — ESC/POS 80mm/58mm Thermal Receipt Encoder & Frontend SDK:**
   - Built `buildReceiptData(order, restaurant, options)` standardizing print data and sanitizing Vietnamese diacritics to 100% safe ASCII.
   - Binary compilation layer `EscPosEncoder` generating industry-standard ESC/POS command sequences:
     * Printer initialization: `1B 40` (ESC @)
     * Alignment: Left (`1B 61 00`), Center (`1B 61 01`), Right (`1B 61 02`)
     * Text sizing & Bold: `1B 45 01`, `1D 21 01` / `1D 21 11`
     * Native 2D QR Code: `1D 28 6B` (GS ( k)
     * Cash Drawer Kick pulse: `1B 70 00 19 FA` (triggered only on `Cash` payments)
     * Partial Paper Cut: `1D 56 42 00` (GS V B 0)
   - `thermalPrinterService` producing multi-format outputs: `buffer` (Uint8Array), `base64`, `hex`, and `textPreview`.
   - Extended Frontend SDK `apiClient` supporting: `orders.completePayment`, `orders.getReceipt`, `orders.getVietQr`, `customerOrders.requestPayment`, `bills.*`, and `activityLogs.*`.

5. **Sub-phase 8.5 — Admin POS Bill Management Interface & Cross-App Thermal Modal:**
   - Upgraded Bill Management page at `/bills` in `imenu-admin`:
     * Multi-field search (`orderCode`, `billCode`, `tableName`) and status / payment method filters.
     * Paginated bill table showing itemized breakdown, discounts, taxes, fees, and cashier details.
   - 80mm Thermal Receipt preview modal conforming to `@media print` CSS with direct ESC/POS print integration.
   - Automatic bill print logging via `POST /api/bills/:id/print`.

6. **Sub-phase 8.6 — Adversarial System Hardening (AUD-8.1 to AUD-8.6):**
   - `AUD-8.1`: Order ownership verification on public endpoints (`request-payment`, `vietqr`, `receipt`); eliminates Cross-Table / Cross-Tenant IDOR attacks (HTTP 404/403).
   - `AUD-8.2`: Bill uniqueness via atomic upsert and `E11000` handling; syncs table status back to `Occupied` and order to `Preparing` if new items are approved mid-payment.
   - `AUD-8.3`: Refined RBAC permissions for `perm-pos-pay` / `perm-bill-view` / `perm-bill-print`; empowers cashier roles while blocking waiters and kitchen staff (`403 Forbidden`).
   - `AUD-8.4`: Server-side recalculation of VietQR amounts, ignoring any fraudulent client-supplied `amount`.
   - `AUD-8.5`: Masked bank account numbers (`***4567`) and mapped `E11000` duplicate errors cleanly to `409 Conflict`.
   - `AUD-8.6`: UI double-submit lock and stabilized `checkoutIdempotencyKeyRef` across network retries.

---

## 3. Test Inventory & Audit Coverage

The automated test suite for Phase 8:

| Suite ID | Test File | Core Verification Focus | Test Cases | Status |
| :---: | :--- | :--- | :---: | :---: |
| **P8-01** | `payment-request-vietqr.test.ts` | QR payment request, server-side VietQR, revert request, table/order status sync, AUD-8.1 (cross-table 404), AUD-8.4 (query amount ignored), AUD-8.2 (sync to `Occupied` on item add). | **23** | **PASS** |
| **P8-02** | `bills-complete-payment.test.ts` | Natural Idempotency settlement, cash change calculation, atomic table release, unique `Bill` generation (`upsert` + `E11000`), AUD-8.3 (block kitchen 403, permit `perm-pos-pay`), concurrency 5 parallel calls. | **18** | **PASS** |
| **P8-03** | `financial-audit-log.test.ts` | Immutable audit logging in `activity_logs`, filter & search payment/print history, financial privacy, AUD-8.3 (block waiter 403), AUD-8.5 (sanitize E11000 to 409 Conflict). | **9** | **PASS** |
| **P8-04** | `escpos-receipt-encoder.test.ts` | ESC/POS 80mm & 58mm compilation, ASCII Vietnamese sanitization, 48/32-col wrapping, native QR `GS ( k`, cash drawer `ESC p`, partial cut `GS V B 0`, buffer / base64 output. | **16** | **PASS** |
| **P8-SDK**| `packages/utils/tests/sdk-contract.test.ts`<br>*(in `imenu-menudientu`)* | Frontend SDK Contract verification for Phase 8 endpoints: `orders.completePayment`, `orders.getReceipt`, `orders.getVietQr`, `customerOrders.requestPayment`, `bills.*`, `activityLogs.*`, `buildReceiptData`, `EscPosEncoder`, `thermalPrinterService`. | **27** | **PASS** |
| **P8-E2E**| `e2e-payment-bill-runner.test.ts`<br>*(with `scripts/e2e-payment-bill-lifecycle.mjs`)* | Real browser E2E test verifying complete payment lifecycle: Customer QR request $\rightarrow$ VietQR displayed $\rightarrow$ POS Cash settlement & change $\rightarrow$ Bill created & table freed $\rightarrow$ 80mm print. | **5** | **PASS** |
| **MASTER**| `run-all-phase8.ts` | Master Test Orchestrator coordinating all 6 suites: Dev Mode (98 cases) & Acceptance Mode (Closure Gate). | N/A | **READY** |

---

## 4. Test Reconciliation Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  IMENU ECOSYSTEM TEST RECONCILIATION — 513 AUTOMATED TEST CASES                        │
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Test Subsystem                 │ Location / Test File         │ Actual Test Cases      │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ 1. Phase 8 Payment & Bill      │ tests/phase-08-payment-bill/ │ 98 (66 BE + 27 SDK + 5 E2E)│
│ 2. Phase 7 Kitchen / KDS       │ tests/phase-07-kitchen-kds/  │ 50 (30 BE + 14 SDK + 6 E2E)│
│ 3. Phase 6 Orders & POS        │ tests/phase-06-order-pos/    │ 288 (270 BE + 9 SDK + 9 E2E)│
│ 4. Phases 2–5 Core Regressions │ tests/phase-02..05/          │ 77                     │
├────────────────────────────────┴──────────────────────────────┴────────────────────────┤
│ ECOSYSTEM TOTAL (ACCEPTANCE CLOSURE REQUIREMENT)               │ 513 TEST CASES         │
│  - Passed in Developer/CI Run:                                 │ 491 / 491 PASS (100%)  │
│  - Browser E2E Checkpoints awaiting full local dev servers:    │ 22 Checkpoints         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Test Execution Guide

### Run all Phase 8 tests:
```powershell
# Phase Closure Gate (Acceptance Run):
npm run test:phase8:acceptance

# Standard Developer Run:
npm run test:phase8:all
```

### Run individual Phase 8 suites:
```powershell
npm run test:phase8:request    # Suite 1: Payment Request & VietQR (23 cases)
npm run test:phase8:bills      # Suite 2: Settlement, Bills & Tables (18 cases)
npm run test:phase8:audit      # Suite 3: Financial Audit Log (9 cases)
npm run test:phase8:escpos     # Suite 4: ESC/POS Receipt Encoder (16 cases)
npm run test:phase8:e2e        # Suite E2E: Browser E2E Payment & Bill (5 cases)
npm run test:phase8            # Run all 4 backend suites sequentially (66 cases)
```

### Run Frontend SDK Contract tests independently:
```powershell
cd ../imenu-menudientu/packages/utils
npx ts-node tests/sdk-contract.test.ts
```
