# 🧪 Phase 11: Customer Review Per Branch & Digital Bill Download

> **Languages:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)<br>
> **Phase:** 11 — Customer Review Per Branch, Atomic CAS Concurrency, Multi-Tenant Isolation, CSAT Analytics, Digital Bill Access Token Lifecycle & Canvas 2D Thermal Receipt Exporter<br>
> **Subsystem Status:** **✅ OFFICIALLY ACCEPTED & SUBSYSTEM CLOSED (PHASE 11 CLOSURE GATE PASSED)**<br>
> **Architectural Convention:** `ONE PHASE = ONE TEST DIRECTORY` (All Phase 11 test artifacts are centrally located in this directory).

---

## 1. Purpose & Business Context (Phase 11 Purpose)

Phase 11 delivers a vital milestone that closes the end-to-end F&B customer journey: **Diner table ordering $\rightarrow$ Kitchen cooking $\rightarrow$ Table serving $\rightarrow$ Payment settlement $\rightarrow$ Post-settlement digital bill download $\rightarrow$ Multi-branch customer review & CSAT feedback collection**.

The subsystem addresses critical operational, concurrency, and security requirements:
1. **Authentic CSAT Collection & Double-Review Prevention (Atomic CAS Guard)**: Enforces that each order can be reviewed **exactly once**, only allows reviews when an order has requested payment or completed payment, and completely eliminates race conditions via atomic Compare-And-Swap (CAS) locks.
2. **Access Control & Anti-Tampering (Anti-IDOR & Session Validation)**: Diners at Table A cannot submit reviews for or eavesdrop on reviews from Table B.
3. **Post-Settlement Digital Bill Retrieval (24-Hour Access Token Lifecycle)**: Generates a cryptographically secure 48-hex random `receiptAccessToken`, allowing customers to look up and download their digital bills within a **24-hour** post-settlement window after the dining table has already been cleared and released for the next guests.
4. **Multi-Tenant Branch Review Isolation**: Reviews are strictly scoped to `branchId`. Sub-branch managers can only access and respond to reviews belonging to their assigned branch; cross-branch data leaks are strictly blocked. HQ owners and Super Admins retain full visibility and cross-branch CSAT aggregation capabilities.
5. **Content Moderation & Audit Trails (Moderation & Activity Logs)**: Only Restaurant Admins (Owners) and Super Admins are privileged to toggle review visibility (`toggleHidden`); all replies and moderation actions emit audit trails to `activity-logs`.
6. **2D Canvas Thermal Receipt Exporter on Frontend**: Provides an HTML5 Canvas 2D 80mm thermal receipt generator in `@imenu/utils` outputting crisp Retina PNG Data URLs (640px, scale=2), fully compatible with Safari iOS and in-app browsers like Zalo.

Per `imenu-api` architectural conventions:
> **Convention:** `ONE PHASE = ONE TEST DIRECTORY`  
> All automated test files, test orchestrators, and test documentation for Phase 11 are stored uniformly within `tests/phase-11-review-digital-bill/`.

---

## 2. Business Scope & Subsystems (Phase 11 Scope & Subsystems)

Phase 11 comprises 4 core operational subsystems:

1. **Subsystem 11.1 — Customer Review Submission & Atomic CAS Concurrency:**
   - Public Customer API: `POST /api/reviews/customer` supporting 2 authentication mechanisms:
     * Mechanism 1: Table QR triplet `(restaurantSlug, tableCode, qrToken)` when diners are still seated at the table.
     * Mechanism 2: Digital bill access token `receiptAccessToken` when diners have left the table or the table has been released.
   - State Machine Guard (`AUD-11.2`): Submissions are permitted only when order status is `PaymentRequested` or `Paid` (`isPaid: true`). Open or cancelled orders are rejected immediately.
   - Anti-Race Condition CAS Lock (`AUD-11.1`): Executes atomic CAS on MongoDB `Order.findOneAndUpdate({ _id, isReviewed: { $ne: true } }, { $set: { isReviewed: true } })` backed by unique index `{ restaurantId: 1, orderId: 1 }`. Under 10 concurrent requests, exactly 1 succeeds and 9 are rejected with 409 Conflict.
   - Anti-IDOR Protection (`AUD-11.3`): Validates table and restaurant ownership, blocking forged order IDs.
   - Input Range & Length Validation (`AUD-11.6`): `overallRating` (1–5 integer stars), `foodRating`, `serviceRating`, `ambianceRating`, `quickTags` ($\le 10$ items), `comment` ($\le 500$ characters).
   - Realtime WebSocket Notification: Emits `review:created` event to branch room `restaurant_${restaurantId}_branch_${branchId}`; automatically triggers `isLowRatingAlert: true` for reviews with $\le 2$ stars.

2. **Subsystem 11.2 — Multi-Branch Isolation, CSAT Analytics & Moderation RBAC:**
   - Paginated Review Query: `GET /api/reviews` supporting filters by `branchId`, `rating`, `hasReply`, `fromDate`, `toDate`, and keyword search.
   - Enforced Branch Isolation (`AUD-11.5`): Sub-branch managers are strictly restricted to `user.branchId`. Bypassing branch filters via query parameters is blocked. HQ owners maintain multi-branch filtering privileges.
   - Comprehensive CSAT Summary: `GET /api/reviews/summary` calculates total reviews, average overall rating, food, service, ambiance scores, 5-star percentage, response rate, 1–5 star distribution, top tags, and per-branch breakdowns.
   - Merchant Reply Flow: `POST /api/reviews/:id/reply` requiring `perm-review-reply` permission. Blocks sub-branch managers from replying to reviews from other branches (403 Forbidden). Tracks responder identity and emits `activity.log`.
   - Moderation Toggle Hidden (`AUD-11.7`): `PATCH /api/reviews/:id/toggle-hidden` restricted exclusively to Restaurant Admins (`owner`) and Super Admins. Regular branch managers are rejected with 403 Forbidden.

3. **Subsystem 11.3 — 24-Hour Digital Bill Access Token Lifecycle & Download:**
   - Token Generation: Automatically generates a 48-hex secure random `receiptAccessToken` upon order creation, payment request, or completion. Indexed via `{ restaurantId: 1, receiptAccessToken: 1 }`.
   - Bill Data Download: `GET /api/orders/customer/:id/download-bill?receiptAccessToken=...` and `GET /api/orders/customer/:id/receipt?receiptAccessToken=...`.
   - 24-Hour Expiration Rule (`AUD-11.4`): Tokens are valid strictly within 24 hours from settlement (`closedAt` / `paidAt`). Expired tokens are rejected with HTTP 400 Bad Request.
   - Anti-Forgery: Forged or mismatched tokens return HTTP 404 Not Found.

4. **Subsystem 11.4 — Frontend SDK Contract & 2D Canvas Thermal Receipt Exporter:**
   - `@imenu/types` additions: `ReviewItem`, `ReviewSummaryResult`, `CreateCustomerReviewPayload`, `QueryReviewsParams`, and notification type `'REVIEW'`.
   - `@imenu/utils` additions:
     * `apiClient.reviews`: `createCustomerReview`, `getCustomerReviewByOrder`, `list`, `getSummary`, `reply`, `toggleHidden`.
     * `apiClient.customerOrders.downloadBill`: Fetches structured receipt payload using `receiptAccessToken`.
     * `renderReceiptToPngDataUrl`: HTML5 Canvas 2D 80mm thermal receipt generator producing high-res Retina PNG Data URLs (640px, scale=2), supporting both Node.js and browser environments.
   - User Interface Components:
     * `apps/imenu-customer-menu`: Diner CSAT review modal with star selector and quick tags, PNG receipt preview modal optimized for Safari iOS and Zalo in-app browser.
     * `apps/imenu-admin`: Full-featured `/reviews` dashboard with CSAT KPI cards, 1–5 star breakdown, branch filters, quick reply dialog, and moderation toggle; sidebar navigation link and realtime audio chime alerts.

---

## 3. Test Inventory & Automated Suites (Test Inventory)

Automated test suites for Phase 11:

| Suite ID | Test File | Primary Verification Focus | Test Cases | Status |
| :---: | :--- | :--- | :---: | :---: |
| **P11-01** | `customer-review-submission.test.ts` (Port 3129) | Customer review submission, State Machine Guard (`PaymentRequested`/`Paid`), `isReviewed` flag & `reviewId` linkage, duplicate review prevention, Atomic CAS Concurrency under 10 concurrent requests (`AUD-11.1`), anti-IDOR (`AUD-11.3`), validation bounds ($\le 5$ stars, $\le 500$ chars), order review reading. | **11** | **PASS** |
| **P11-02** | `branch-review-isolation.test.ts` (Port 3130) | Multi-branch review isolation (`AUD-11.5`), branch filter bypass guard, HQ owner cross-branch visibility, CSAT aggregation (`/reviews/summary`), merchant reply flow, cross-branch reply prevention (403), moderation toggle hidden restricted to Owner (`AUD-11.7`), RBAC `perm-review-view`. | **9** | **PASS** |
| **P11-03** | `digital-bill-download.test.ts` (Port 3131) | 48-hex random `receiptAccessToken` issuance, compound indexing, forged token rejection (404), post-settlement 24-hour expiration (`AUD-11.4` -> 400 Bad Request), valid download within 24h, customer receipt endpoint compatibility. | **7** | **PASS** |
| **P11-SDK**| `packages/utils/tests/sdk-contract.test.ts`<br>*(at `imenu-menudientu`)* | Frontend SDK Contract: `customerOrders.downloadBill` (SDK-33), `reviews.createCustomerReview` (SDK-34), `reviews.getCustomerReviewByOrder` (SDK-35), `reviews.list` (SDK-36), `reviews.getSummary & reply` (SDK-37), `renderReceiptToPngDataUrl` 80mm Retina PNG output (SDK-38) alongside 32 inherited tests. | **40** | **PASS** |
| **MASTER** | `run-all-phase11.ts` | Master Test Orchestrator Phase 11: Automatically dispatches all 4 test suites (67 test cases) in Developer Run and Final Acceptance Run modes. | N/A | **READY** |

---

## 4. Full Ecosystem Test Reconciliation Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  IMENU TESTING ECOSYSTEM — 710 AUTOMATED TEST CASES RECONCILIATION (PHASES 2 -> 11)   │
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Test Subsystem / Phase         │ Source File / Location       │ Verified Test Cases    │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ 1. Phase 11 Review & Bill      │ tests/phase-11-review-digital│ 67 (27 BE + 40 SDK)    │
│    - Customer Review Submission│ tests/phase-11-review-digital│ 11                     │
│    - Branch Review Isolation   │ tests/phase-11-review-digital│ 9                      │
│    - Digital Bill Download     │ tests/phase-11-review-digital│ 7                      │
│    - Frontend SDK Contract P11 │ packages/utils/tests/        │ 40 (6 new + 34 inher.) │
│ 2. Phase 10 Realtime & Ecosyst │ tests/phase-10-realtime/     │ 85 (51 BE + 34 SDK+E2E)│
│ 3. Phase 9 Dashboard & Reports │ tests/phase-09-dashboard-rep/│ 57 (53 BE + 4 E2E)     │
│ 4. Phase 8 Payment & Bill      │ tests/phase-08-payment-bill/ │ 98 (66 BE + 27 SDK+5E2E│
│ 5. Phase 7 Kitchen / KDS       │ tests/phase-07-kitchen-kds/  │ 50 (30 BE + 14 SDK+6E2E│
│ 6. Phase 6 Orders & POS        │ tests/phase-06-order-pos/    │ 279 (270 BE + 9 SDK)   │
│ 7. Phases 2–5 Core Regressions │ tests/phase-02..05/          │ 74                     │
├────────────────────────────────┴──────────────────────────────┴────────────────────────┤
│ FULL ECOSYSTEM ROADMAP TOTAL (ACCEPTANCE CLOSURE REQUIREMENT)  │ 710 TEST CASES (RUNNER)│
│  - Total passing test cases (Developer/CI Run):                │ 710 / 710 PASS (100%)  │
│  - Adversarial & regression failure rate:                      │ 0 FAIL, 0 BLOCKED      │
│  - Official acceptance status across 11 Phases:                │ ✅ FULLY ACCEPTED      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. How to Run Phase 11 Tests

### Run all Phase 11 suites:
```powershell
# Official Acceptance Mode (Closure Gate):
npm run test:phase11:acceptance

# Developer Mode:
npm run test:phase11:all
```

### Run individual Phase 11 suites:
```powershell
npm run test:phase11:submission # Suite 1: Customer Review Submission & Atomic CAS (11 cases)
npm run test:phase11:isolation  # Suite 2: Branch Isolation & Moderation RBAC (9 cases)
npm run test:phase11:bill       # Suite 3: Digital Bill Access Token & 24h Expiration (7 cases)
npm run test:phase11            # Run all 3 Backend suites sequentially (27 cases)
```

### Run Frontend SDK Contract independently:
```powershell
# Navigate to packages/utils in imenu-menudientu:
cd ../imenu-menudientu/packages/utils
npx ts-node tests/sdk-contract.test.ts
```
