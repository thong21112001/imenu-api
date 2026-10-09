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
│   ├── test-multi-branch.ts           # E2E Scenario Part 2: Multi-Branch Lifecycle & Isolation (10 tests)
│   ├── README.md                      # Detailed Phase 2 test guide (Vietnamese)
│   └── README_en.md                   # Detailed Phase 2 test guide (English)
│
├── phase-03-staff-rbac/               # [COMPLETED] Phase 3: Staff, RBAC & Auto-Redirect
│   ├── test.ts                        # E2E Scenario: Super Admin ENV, Soft Delete, Cross-Tenant Staff, VietQR (16 tests)
│   ├── README.md                      # Detailed Phase 3 test guide (Vietnamese)
│   └── README_en.md                   # Detailed Phase 3 test guide (English)
│
├── phase-04-menu/                     # [COMPLETED] Phase 4: Menu, Categories & Toppings
│   ├── test.ts                        # E2E Scenario: Categories, Items, Toppings, Cashier toggle, QR (13 tests)
│   ├── README.md                      # Detailed Phase 4 test guide (Vietnamese)
│   └── README_en.md                   # Detailed Phase 4 test guide (English)
│
├── phase-05-order-table-kds/          # [COMPLETED] Phase 5: Tables, Orders & Realtime KDS
│   ├── test.ts                        # E2E Scenario: Tables, Zones, Orders, KDS WebSockets, RBAC (18 tests)
│   ├── README.md                      # Detailed Phase 5 test guide (Vietnamese)
│   └── README_en.md                   # Detailed Phase 5 test guide (English)
│
└── phase-06-order-pos/                # [FULLY COMPLETED & CLOSED] Phase 6: Order & POS Lifecycle
    ├── README.md                      # Comprehensive Phase 6 test guide (Vietnamese)
    ├── README_en.md                   # Comprehensive Phase 6 test guide (English)
    ├── state-machine.test.ts          # Sub-phase 6.2: State Machine, Round/Item Cancellation & Invariants (56 tests)
    ├── pos-cashier.test.ts            # Sub-phase 6.3: POS Cashier, Taxes/Fees, Cash Change & VietQR (30 tests)
    ├── customer-qr.test.ts            # Sub-phase 6.4: Customer QR Ordering & Staff Approval (43 tests)
    ├── idempotency-concurrency.test.ts# Sub-phase 6.5: Idempotency Key & Concurrent Payment Claims (32 tests)
    ├── table-order-sync.test.ts       # Sub-phase 6.6: Table Transfer, Merge, Move Items & CAS Locks (38 tests)
    └── order-query.test.ts            # Sub-phase 6.7: Order Query, Filters, Search & Branch Isolation (39 tests)
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
| **6.7 Order Query** | `order-query.test.ts` | Date/time filters, staff, multi-status, safe regex search, branch isolation | 39 | **PASS** |

---

## 3. ⚡ Master Test Commands

All test scripts are registered in `package.json`:

### 🔹 Execute Tests by Phase:
```powershell
# Phase 2: Auth, Restaurant & Multi-Branch
npm run test:phase2:all

# Phase 3: Staff & RBAC Permissions
npm run test:phase3

# Phase 4: Menu, Categories & Toppings
npm run test:phase4

# Phase 5: Tables, Orders & Realtime KDS
npm run test:phase5
```

### 🔹 Execute Phase 6 Tests (Order & POS):
```powershell
# Run all 6 Phase 6 test suites sequentially
npm run test:phase6

# Or run individual sub-phase suites:
npm run test:phase6:transitions  # Sub-phase 6.2: State Machine (state-machine.test.ts)
npm run test:phase6:pos          # Sub-phase 6.3: POS Cashier (pos-cashier.test.ts)
npm run test:phase6:customer-qr  # Sub-phase 6.4: Customer QR (customer-qr.test.ts)
npm run test:phase6:concurrency  # Sub-phase 6.5: Idempotency (idempotency-concurrency.test.ts)
npm run test:phase6:sync         # Sub-phase 6.6: Table Sync & Transfer (table-order-sync.test.ts)
npm run test:phase6:query        # Sub-phase 6.7: Order Query & Filters (order-query.test.ts)
```

---

## 4. 🎯 Architectural Rules for Future Phases

1. **`ONE PHASE = ONE DIRECTORY`**: Every new Phase must create **exactly one directory** named `tests/phase-XX-<phase-name>/`. Sub-phases must NEVER create their own directories.
2. **Descriptive Filenames**: Test files must be descriptively named reflecting their functional domain, formatted as `<subphase-name>.test.ts` or `test.ts` if only one file exists.
3. **Bilingual Documentation**: Each Phase directory must contain both `README.md` (Vietnamese) and `README_en.md` (English).
4. **Master Index Update**: Register the phase directory and test commands in both `tests/README.md` and `tests/README_en.md`.
5. **NPM Script Registration**: Register test scripts in `package.json` following the `test:phaseX:...` naming convention.
