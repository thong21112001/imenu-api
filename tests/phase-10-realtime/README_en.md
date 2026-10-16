# 🧪 Phase 10: Realtime WebSocket Gateway, Room Security & Ecosystem Finalization

> **Languages:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)<br>
> **Phase:** 10 — Realtime WebSocket Gateway, Room Security & Isolation, Domain Events Matrix, Call Staff Flow, Client Resilience & Multi-Tab Ecosystem E2E<br>
> **Subsystem Status:** **✅ OFFICIALLY ACCEPTED & ROADMAP COMPLETED (PHASE 10 CLOSURE GATE PASSED)**<br>
> **Architectural Convention:** `ONE PHASE = ONE TEST DIRECTORY` (All Phase 10 test artifacts are centrally located in this directory).

---

## 1. Purpose & Business Context (Phase 10 Purpose)

Phase 10 represents the final milestone and the pinnacle integration of the entire iMenu ecosystem roadmap: **Customer table call staff with two-way staff acknowledgment $\rightarrow$ Multi-tenant & multi-branch WebSocket room security and isolation $\rightarrow$ Standardized domain events matrix across 7 operational event groups $\rightarrow$ Client resilience, exponential backoff with jitter & event deduplication $\rightarrow$ Multi-tab browser E2E test synchronization (Customer ↔ Admin POS ↔ Kitchen KDS) $\rightarrow$ Comprehensive adversarial hardening (AUD-10.1 to AUD-10.6)**.

Per `imenu-api` architectural conventions:
> **Convention:** `ONE PHASE = ONE TEST DIRECTORY`  
> All automated test files, test orchestrators, and test documentation for Phase 10 (from 10.1 through 10.6) are stored uniformly within `tests/phase-10-realtime/`. Sub-phases do **not** create separate subdirectories.

---

## 2. Business Scope & Sub-phases (Phase 10 Scope & Sub-phases)

Phase 10 comprises 6 complete operational sub-phases:

1. **Sub-phase 10.1 — Customer Call Staff & Two-Way Acknowledgment Flow:**
   - Public Diner API: `POST /api/tables/:tableId/call-staff` requiring valid `qrToken` or `restaurantSlug`, accepting optional reason (`reason`) and notes (`note`).
   - Protected Staff API: `POST /api/tables/:tableId/acknowledge-call` requiring JWT authentication with `POS.VIEW` or `ORDER.VIEW` permission.
   - Realtime WebSocket emission: Emits `CALL_STAFF` with audio chime trigger to branch room `restaurant_${restaurantId}_branch_${branchId}`; upon staff acceptance, emits `staff_acknowledged` back to table room `table_${tableId}` notifying the diner via a toast notification.
   - Anti-Spam Cooldown & Length Validation: Enforces a 60-second table-level cooldown by `tableId`. Replayed requests within this cooldown window gracefully return `isCooldownReplay: true` without firing duplicate WebSocket events, preventing audible notification spam. Enforces strict length limits on `reason` ($\le 100$ characters) and `note` ($\le 200$ characters).

2. **Sub-phase 10.2 — WebSocket Room Security & Multi-Tenant / Multi-Branch Isolation:**
   - WebSocket Handshake Authentication: Staff connections require a valid JWT Bearer token provided via `auth.token` or `query.token`. Diners connect using table context and validated `qrToken`.
   - Hierarchical Room Isolation:
     * Restaurant chain room: `restaurant_${restaurantId}` (restricted to Restaurant Admin / Super Admin).
     * Branch room: `restaurant_${restaurantId}_branch_${branchId}` (restricted to verified branch staff, kitchen, cashiers).
     * Dining table room: `table_${tableId}` (restricted to active table diners).
   - Guest Room Isolation: Unauthenticated guests are strictly blocked from joining staff rooms (`restaurant_${id}` or `restaurant_${id}_branch_${id}`). Eavesdropping on kitchen tickets or branch revenue events is strictly denied.
   - Dynamic Room Migration: When staff members switch branches (`switch:branch`) or leave a restaurant (`leave:restaurant`), the gateway traverses `client.rooms` and executes `client.leave(r)` to purge all obsolete branch rooms before entering new rooms, eliminating cross-branch notification leaks.

3. **Sub-phase 10.3 — Realtime Domain Events Matrix:**
   - Standardized 7 core realtime event groups covering the full operational F&B lifecycle:
     1. **New Order**: `order:created` / `NEW_ORDER` (Customer places order $\rightarrow$ POS & Kitchen KDS).
     2. **Order Updated**: `order:updated` / `round:confirmed` (POS confirms round $\rightarrow$ Customer & Kitchen).
     3. **Dish Status**: `order:item_status_updated` / `item:cooking` / `item:ready` / `item:served` (Kitchen cooking/ready $\rightarrow$ POS & Customer).
     4. **Table Status**: `table.status_updated` (`Available` $\rightarrow$ `Occupied` $\rightarrow$ `PaymentRequested` $\rightarrow$ `Available`).
     5. **Call Staff & Acknowledgment**: `CALL_STAFF` (Customer calls $\rightarrow$ Admin Header) & `staff_acknowledged` (Staff acknowledges $\rightarrow$ Customer).
     6. **Payment & Bills**: `payment:requested` (Customer requests VietQR) & `payment:completed` (Cashier settles bill $\rightarrow$ Table released).
     7. **86 Out-of-Stock Toggle**: `menu:item_out_of_stock` (Kitchen 86s dish $\rightarrow$ Disabled instantly across POS & Customer Menu).

4. **Sub-phase 10.4 — Frontend SDK Contract & Client Resilience:**
   - Frontend SDK Contract (`@imenu/utils`): Exposes standard client methods `apiClient.tables.callStaff` (SDK-30), `apiClient.tables.acknowledgeCall` (SDK-31), and `apiClient.customerOrders.callStaff` (SDK-32).
   - Reconnection Exponential Backoff with Jitter: Socket client configured with intelligent reconnection policies (`reconnectionDelay: 1000`, `reconnectionDelayMax: 5000`, `randomizationFactor: 0.5`) to eliminate thundering herd connection storms.
   - Canonical Event Deduplication: `CANONICAL_EVENT_MAP` normalizes legacy and canonical event names; single wildcard dispatch eliminates double audio chimes.
   - FIFO State Capping: Caps AdminHeader notification history to the 50 most recent events (`slice(0, 50)`), preventing browser memory leaks during extended unattended sessions.

5. **Sub-phase 10.5 — Browser E2E Multi-Tab Ecosystem:**
   - Real browser Puppeteer script orchestrating simultaneous multi-tab user interactions:
     * **Checkpoint E2E-P10-01**: Customer clicks "Call Staff" ("Need ice") $\rightarrow$ `AdminHeader` in Admin tab immediately displays an audio notification badge with request details without page refresh.
     * **Checkpoint E2E-P10-02**: Staff clicks "Acknowledge" on the notification popup $\rightarrow$ Customer tab receives a confirmation toast acknowledging staff is on the way.
     * **Checkpoint E2E-P10-03**: Zero-reload lifecycle synchronization: Customer submits order $\rightarrow$ POS approves $\rightarrow$ KDS cooks & marks ready $\rightarrow$ Customer requests payment $\rightarrow$ Cashier settles bill.

6. **Sub-phase 10.6 — Adversarial Hardening AUD-10.1 to AUD-10.6:**
   - Thoroughly resolved all 6 adversarial audit findings:
     * `AUD-10.1`: Table-level anti-spam cooldown, note length restrictions, automatic TTL map eviction to prevent memory leaks.
     * `AUD-10.2`: Dynamic room cleanup via `client.leave(r)` upon staff branch switching.
     * `AUD-10.3`: Guest room isolation preventing diner eavesdropping on staff channels.
     * `AUD-10.4`: FIFO ring buffer capping notifications to 50 items on Admin Header.
     * `AUD-10.5`: `CANONICAL_EVENT_MAP` preventing duplicate chimes and events.
     * `AUD-10.6`: Exponential backoff with randomization jitter for socket reconnection.

---

## 3. Test Inventory & Audit Coverage

The automated test suite for Phase 10:

| Suite ID | Test File | Core Verification Focus | Test Cases | Status |
| :---: | :--- | :--- | :---: | :---: |
| **P10-01** | `call-staff-notification.test.ts` (Port 3125) | Two-way call staff & acknowledgment flow, branch isolation, 60s anti-spam cooldown (`isCooldownReplay`), `reason`/`note` length limits, TTL map eviction, RBAC `perm-pos-view`, hardening `TC-10.1.14–16`. | **16** | **PASS** |
| **P10-02** | `websocket-room-security.test.ts` (Port 3126) | JWT Bearer handshake authentication, multi-level room isolation (`restaurant_${id}`, `branch_${id}`, `table_${id}`), guest isolation from staff rooms, room cleanup on `switch:branch` and `leave:restaurant`, hardening `TC-10.2.11–13`. | **13** | **PASS** |
| **P10-03** | `domain-events-matrix.test.ts` (Port 3127) | Realtime domain events matrix across 7 groups (New Order, Order Updated, Item Status, Table Status, Call Staff, Payment & Bill, KDS 86 Out-of-Stock), payload integrity and broadcast verification. | **11** | **PASS** |
| **P10-04A**| `packages/utils/tests/sdk-contract.test.ts`<br>*(in `imenu-menudientu`)* | Frontend SDK Contract verification: `tables.callStaff` (SDK-30), `tables.acknowledgeCall` (SDK-31), `customerOrders.callStaff` (SDK-32) plus 31 inherited contract tests from earlier phases. | **34** | **PASS** |
| **P10-04B**| `subphase-10-4-client-resilience.test.ts` (Port 3128) | Client resilience, Reconnection Jitter Backoff configuration, `CANONICAL_EVENT_MAP` deduplication, FIFO 50-notification ring buffer, hardening `TC-10.4.6–8`. | **8** | **PASS** |
| **P10-05** | `e2e-realtime-runner.test.ts` | Real browser multi-tab E2E test: Diner calls staff $\rightarrow$ Admin Header audio badge displays without reload; Staff acknowledges $\rightarrow$ Diner receives confirmation toast; Order $\rightarrow$ KDS $\rightarrow$ POS $\rightarrow$ Bill lifecycle zero reload. | **3** | **PASS** |
| **MASTER** | `run-all-phase10.ts` | Master Test Orchestrator Phase 10: Dev Mode (Suites 1–5 Backend & SDK) & Acceptance Mode (Full 6 Suites including Browser E2E). | N/A | **READY** |

---

## 4. Test Reconciliation Matrix (Phases 2 -> 10)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  IMENU TEST ECOSYSTEM — 643 VERIFIED AUTOMATED TEST CASES (PHASES 2 -> 10)             │
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Test Subsystem                 │ Location / Test File         │ Actual Test Cases      │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ 1. Phase 10 Realtime & Ecosyst │ tests/phase-10-realtime/     │ 85 (51 BE + 34 SDK+E2E)│
│    - Call Staff & Notification │ tests/phase-10-realtime/     │ 16                     │
│    - WebSocket Room Security   │ tests/phase-10-realtime/     │ 13                     │
│    - Domain Events Matrix      │ tests/phase-10-realtime/     │ 11                     │
│    - Frontend SDK Contract P10 │ packages/utils/tests/        │ 34 (3 new + 31 base)   │
│    - Client Resilience Suite   │ tests/phase-10-realtime/     │ 8                      │
│    - Multi-Tab Browser E2E     │ tests/phase-10-realtime/     │ 3                      │
│ 2. Phase 9 Dashboard & Reports │ tests/phase-09-dashboard-rep/│ 57 (53 BE + 4 E2E)     │
│ 3. Phase 8 Payment & Bill      │ tests/phase-08-payment-bill/ │ 98 (66 BE + 27 SDK + 5 E2E)│
│ 4. Phase 7 Kitchen / KDS       │ tests/phase-07-kitchen-kds/  │ 50 (30 BE + 14 SDK + 6 E2E)│
│ 5. Phase 6 Orders & POS        │ tests/phase-06-order-pos/    │ 279 (270 BE + 9 SDK)   │
│ 6. Phases 2–5 Core Regressions │ tests/phase-02..05/          │ 74                     │
├────────────────────────────────┴──────────────────────────────┴────────────────────────┤
│ ECOSYSTEM TOTAL (ACCEPTANCE CLOSURE REQUIREMENT)               │ 643 TEST CASES (PASS)  │
│  - Passed in Developer/CI Run:                                 │ 643 / 643 PASS (100%)  │
│  - Adversarial Hardening & Regression Status:                  │ 0 FAIL, 0 BLOCKED      │
│  - Full 10-Phase Roadmap Completion Status:                    │ ✅ COMPLETED & ACCEPTED│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. How to Run Phase 10 Tests

### Run the entire Phase 10 suite:
```powershell
# Strict Acceptance mode (Closure Gate):
npm run test:phase10:acceptance

# Standard Developer mode:
npm run test:phase10:all
```

### Run individual Phase 10 test suites:
```powershell
npm run test:phase10:call-staff  # Suite 1: Call Staff & Acknowledgment Flow (16 tests)
npm run test:phase10:security    # Suite 2: WebSocket Room Security & Isolation (13 tests)
npm run test:phase10:events      # Suite 3: Domain Events Matrix 7 Groups (11 tests)
npm run test:phase10:sdk         # Suite 4A: Frontend SDK Contract (34 tests)
npm run test:phase10:resilience  # Suite 4B: Client Resilience & Deduplication (8 tests)
npm run test:phase10:e2e         # Suite 5: Browser E2E Multi-Tab Ecosystem (3 tests)
npm run test:phase10             # Run all 4 Backend suites sequentially (48 tests)
```

### Run Frontend SDK Contract tests independently:
```powershell
# Navigate to packages/utils in imenu-menudientu:
cd ../imenu-menudientu/packages/utils
npx ts-node tests/sdk-contract.test.ts
```
