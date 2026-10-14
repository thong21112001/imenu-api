# Comprehensive Automated Test Suite Phase 7: Kitchen / KDS

Comprehensive automated test suite for Phase 7 of the **iMenu API** ecosystem, covering: Kitchen Display System (KDS) queue management (FIFO ordering, filtering by zone, table, status, search), RBAC permissions (`KITCHEN` vs `WAITER`), Dish state lifecycle (`Waiting` -> `Cooking` -> `Ready` -> `Served`), Auto Order Status Upgrades, Batch actions (`start-cooking-all`, `mark-ready-all`), Negative Guards, Idempotent double-click protection, OCC retry concurrency protection (Zero Lost Updates), Multi-branch out-of-stock isolation (86 items), and 3-way Realtime WebSocket synchronization.

---

## 1. Directory Structure (`ONE PHASE = ONE TEST DIRECTORY`)

```
imenu-api/tests/phase-07-kitchen-kds/
├── kds-queue-query.test.ts             # Suite 1: KDS Queue, FIFO, Filters & Multi-Tenant Isolation (Port 3110)
├── kds-state-transitions.test.ts       # Suite 2: State Transitions, Auto Upgrade & Guards (Port 3111)
├── kds-concurrency-idempotency.test.ts # Suite 3: Double-Click Idempotency & OCC Concurrency (Port 3112)
├── kds-out-of-stock.test.ts            # Suite 4: Out-of-Stock (86), Branch Isolation & WebSockets (Port 3113)
├── e2e-kds-runner.test.ts              # Suite 6: Puppeteer E2E Runner Wrapper
├── run-all-phase7.ts                   # Master Test Orchestrator
├── README.md                           # Vietnamese Documentation
└── README_en.md                        # English Documentation
```

---

## 2. Test Execution Commands

```bash
# Run individual test suites
npm run test:phase7:query
npm run test:phase7:transitions
npm run test:phase7:concurrency
npm run test:phase7:out-of-stock

# Run Browser E2E Scenario
npm run test:phase7:e2e

# Run Master Orchestrator (Developer Mode)
npm run test:phase7:all

# Run Master Orchestrator (Strict Acceptance Mode)
npm run test:phase7:acceptance
```
