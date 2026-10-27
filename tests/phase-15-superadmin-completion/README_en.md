# 🧪 Phase 15 Test Guide: Superadmin Completion, Impersonation Support Mode & Full RBAC Synchronization

> **Language:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Project:** iMenu API & Frontend Monorepo  
> **Phase:** Phase 15 — Superadmin Completion & RBAC Sync  
> **Status:** ✅ **FULLY IMPLEMENTED & TESTED 100% PASS (75/75 TEST CASES)**

---

## 1. 🎯 Objectives & Business Scope

Phase 15 focuses on completing the Superadmin platform control center and synchronizing multi-workspace RBAC permissions across Superadmin, Sales Reps, Restaurant Owners, and Operations Staff:

1. **Complete 4 Platform Control Modules (Core Platform Center)**:
   - **Platform Dashboard (`/platform/dashboard`)**: Unified system KPIs, dual-revenue tracking (F&B GMV vs SaaS Fees), point-of-sale growth, and partner commissions in real time.
   - **Restaurant Lifecycle (`/platform/restaurants`)**: Search and status filtering, temporary suspension with violation reason (`isSuspended: true`), reactivation with full reason `$unset`, subscription extension/upgrade with custom expiration dates and auditable transaction notes.
   - **Dual-Revenue Analytics (`/platform/revenues`)**: Date range selector (Start Date - End Date) integrated with dual-revenue API queries to provide transparent audit parity between restaurant GMV and platform software fees.
   - **Sales & Commission Engine (`/platform/sales`)**: Sales Rep profile management; interactive modal for editing Setup/Renewal commission rates and beneficiary bank details; public candidate application review and automatic account provisioning; platform-wide commission ledger queries and atomic payout batch approval (`payout-batch`).

2. **Superadmin Impersonation Support Mode**:
   - Allows Superadmin to select a target restaurant directly from the Header (`AdminHeader.tsx`) to enter technical support mode.
   - Displays a prominent amber Sticky Support Banner with a dedicated "Exit Support" button.
   - Expands the Sidebar menu (`AdminSidebar.tsx`) to allow Superadmin to manage operational pages (`/branches`, `/settings`) on behalf of the owner without account switching or permission blocks.
   - Eliminates `400 Bad Request` errors when no specific restaurant is selected (`effectiveRestaurantId`).

3. **Strict RBAC Isolation Boundaries & Privilege Escalation Prevention**:
   - `SuperAdminGuard` strictly shields all `/api/platform/*` endpoints: Blocks Sales Reps (403), Owners (403), Cashiers/Kitchen staff (403), and Anonymous callers (401).
   - Instant token revocation (`$inc: { tokenVersion: 1 }`) and multi-layer validation in `jwt.strategy.ts` immediately block restaurant staff when a restaurant is suspended (`isSuspended: true`).
   - Atomic conditional updates on MongoDB prevent double commission payouts (Double-Payout Prevention).

4. **Strict Secret-Zero Compliance**:
   - 100% of test credentials and secrets are retrieved dynamically from the environment via `test-credentials.helper.ts` and `test-credentials.mjs`.

---

## 2. 📁 Phase 15 Test Directory Structure

```text
tests/phase-15-superadmin-completion/
├── README.md                                 # Detailed test guide (Vietnamese)
├── README_en.md                              # Detailed test guide (English)
├── superadmin-restaurant-lifecycle.test.ts   # Suite 1: Restaurant lifecycle, plans & audit notes (P15-01) (5 tests)
├── superadmin-sales-management.test.ts       # Suite 2: Sales rep management, policies & applications (P15-02) (4 tests)
├── superadmin-payout-and-commissions.test.ts # Suite 3: Platform commission ledger & atomic payout batch (P15-03) (4 tests)
├── superadmin-impersonation-rbac.test.ts     # Suite 4: Support impersonation & strict RBAC isolation (P15-04) (5 tests)
└── run-all-phase15.ts                        # Master Test Orchestrator Phase 15 (75 tests)
```

---

## 3. ⚡ Execution Commands

```powershell
# Run all 5 Phase 15 test suites in Developer mode:
npm run test:phase15:all

# Run Phase 15 in strict Acceptance Quality Gate mode:
npm run test:phase15:acceptance

# Run individual Backend test suites:
npm run test:phase15:lifecycle  # Suite 1: Restaurant lifecycle & subscriptions (Port 3151)
npm run test:phase15:sales      # Suite 2: Sales rep management & commission policies (Port 3152)
npm run test:phase15:payout     # Suite 3: Commission ledger & atomic payout batch (Port 3153)
npm run test:phase15:rbac       # Suite 4: Impersonation support & RBAC isolation (Port 3154)
npm run test:phase15            # Run all 4 backend suites sequentially

# Run Frontend SDK Contract Verification:
npx ts-node ../imenu-menudientu/packages/utils/tests/sdk-contract.test.ts
```

---

## 4. 📊 Acceptance Test Matrix & Results

| # | Test Suite | Test File | Cases | Status | Verification Details |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **1** | **Restaurant Lifecycle & Plans** | `superadmin-restaurant-lifecycle.test.ts` | 5 | ✅ PASS (100%) | Status filter, suspension (`isSuspended: true`), reactivation with `$unset`, Enterprise upgrade with audit note, support update via `PUT /restaurants/:id`. |
| **2** | **Sales Reps & Commission Policies** | `superadmin-sales-management.test.ts` | 4 | ✅ PASS (100%) | Create sales rep with rates and bank details, update policies, lock/unlock sales rep, online candidate application review and automatic provisioning. |
| **3** | **Commission Ledger & Payout Batch** | `superadmin-payout-and-commissions.test.ts` | 4 | ✅ PASS (100%) | Superadmin ledger query by period and status, batch approval (`APPROVE`), payout confirmation (`PAY`) with bank reference, atomic double-payout prevention. |
| **4** | **Support Impersonation & RBAC** | `superadmin-impersonation-rbac.test.ts` | 5 | ✅ PASS (100%) | Empty `GET /branches` without 400 error, create branch in support mode, close/reopen branch, custom role creation, multi-role RBAC barriers (403/401). |
| **5** | **Frontend SDK Contract Verification** | `sdk-contract.test.ts` | 57 | ✅ PASS (100%) | Synchronized SDK-53 (`platform.getCommissions`), SDK-54 (`restaurant.updateById`), SDK-55 (`branches.create` with optional `restaurantId`). |
| **Total**| **All Phase 15 Suites** | `run-all-phase15.ts` | **75** | **75/75 PASS (100%)** | All 5 test suites achieved 100% PASS with 0 errors and 0 skipped tests. |
