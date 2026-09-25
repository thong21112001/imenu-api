# 🧪 iMenu Backend Automated Test Suite (Master Index)

> **Language:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Project:** iMenu API Backend  
> **Architecture:** Modular, phase-isolated testing directory structure matching the Blueprint Roadmap.

---

## 1. 📁 Phase-Based Directory Layout

Testing code and documentation are organized into dedicated phase directories. Each phase features its own automated runner and bilingual guides (Vietnamese & English):

```text
tests/
├── README.md                      # Master index & guidelines (Vietnamese)
├── README_en.md                   # Master test documentation (English)
│
├── phase-02-auth-restaurant/       # [COMPLETED] Phase 2: Auth, Restaurant & Multi-Branch
│   ├── test.ts                    # E2E runner Part 1: Auth, Restaurant & Branch CRUD (12 cases)
│   ├── test-multi-branch.ts       # E2E runner Part 2: Multi-Branch Lifecycle & Isolation (10 cases)
│   ├── README.md                  # Vietnamese documentation
│   └── README_en.md               # English documentation
│
├── phase-03-staff-rbac/           # [FULLY COMPLETED] Phase 3: Staff Management, RBAC & Auto-Redirect
│   ├── test.ts                    # E2E runner: Super Admin ENV, Soft Delete, Cross-Tenant Staff & Roles, VietQR Scoping (16 cases)
│   ├── README.md                  # Vietnamese documentation & test log
│   └── README_en.md               # English documentation & test log
│
├── phase-04-menu/                 # [ROADMAP] Phase 4: Menu, Categories & Options
│   ├── README.md
│   └── README_en.md
│
├── phase-05-zone-table-qr/        # [ROADMAP] Phase 5: Tables, Zones & QR Codes
│   ├── README.md
│   └── README_en.md
│
├── phase-06-order-pos/            # [ROADMAP] Phase 6: POS & Order Lifecycle
│   ├── README.md
│   └── README_en.md
│
├── phase-07-kitchen-kds/          # [ROADMAP] Phase 7: Kitchen Display System (KDS)
│   ├── README.md
│   └── README_en.md
│
├── phase-08-payment-bill/         # [ROADMAP] Phase 8: Bills & VietQR Payment
│   ├── README.md
│   └── README_en.md
│
├── phase-09-dashboard-reports/    # [ROADMAP] Phase 9: Dashboard Metrics & Reports
│   ├── README.md
│   └── README_en.md
│
└── phase-10-realtime/             # [ROADMAP] Phase 10: WebSocket & Live Notifications
    ├── README.md
    └── README_en.md
```

---

## 2. ⚡ Quick Commands

Convenient test scripts are registered directly in `imenu-api/package.json`:

| Phase | NPM Script | Direct Command | Scope | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Phase 2 - Part 1** | `npm run test:phase2` | `npx ts-node tests/phase-02-auth-restaurant/test.ts` | Auth, Restaurant & Branch CRUD | **12/12 PASSED** |
| **Phase 2 - Part 2** | `npm run test:multibranch` | `npx ts-node tests/phase-02-auth-restaurant/test-multi-branch.ts` | Multi-Branch Lifecycle & Isolation | **10/10 PASSED** |
| **Phase 2 - Complete** | `npm run test:phase2:all` | Sequentially runs both test files above | All 22 Phase 2 Integration Tests | **22/22 PASSED** |
| **Phase 3 - Staff & RBAC** | `npm run test:phase3` | `npx ts-node tests/phase-03-staff-rbac/test.ts` | Super Admin, Soft Delete, Staff & RBAC | **12/12 PASSED** |
| **Complete System (All)** | `npm test` | `jest` | Global unit tests | In setup |

---

## 3. 🎯 Conventions for Upcoming Phases

Every upcoming phase must adhere to the following conventions:
1. **`test.ts`**: Self-contained runner that boots an isolated test instance (e.g. on port `3099`) and cleans up resources upon completion.
2. **`README.md`**: Vietnamese documentation outlining: Purpose, Test Inventory table, Prerequisites, Execution instructions, and Troubleshooting.
3. **`README_en.md`**: Corresponding English documentation.
4. Register the npm script in `package.json` following the pattern `"test:phaseX": "ts-node tests/phase-XX-.../test.ts"`.
