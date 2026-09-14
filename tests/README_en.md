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
├── phase-02-auth-restaurant/       # [COMPLETED] Phase 2: Auth, Restaurant & Branches
│   ├── test.ts                    # E2E test runner (12 scenarios)
│   ├── README.md                  # Vietnamese documentation
│   └── README_en.md               # English documentation
│
├── phase-03-staff-rbac/           # [ROADMAP] Phase 3: Staff & Role-Based Access Control
│   ├── README.md
│   └── README_en.md
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

| Phase | NPM Script | Direct Command | Status |
| :--- | :--- | :--- | :---: |
| **Phase 2: Auth + Restaurant** | `npm run test:phase2` | `npx ts-node tests/phase-02-auth-restaurant/test.ts` | **12/12 PASSED** |
| **Complete System (All)** | `npm test` | `jest` | In setup |

---

## 3. 🎯 Conventions for Upcoming Phases

Every upcoming phase must adhere to the following conventions:
1. **`test.ts`**: Self-contained runner that boots an isolated test instance (e.g. on port `3099`) and cleans up resources upon completion.
2. **`README.md`**: Vietnamese documentation outlining: Purpose, Test Inventory table, Prerequisites, Execution instructions, and Troubleshooting.
3. **`README_en.md`**: Corresponding English documentation.
4. Register the npm script in `package.json` following the pattern `"test:phaseX": "ts-node tests/phase-XX-.../test.ts"`.
