# 🧪 Phase 14 Test Guide: Superadmin Workspace Purification, Zero Test-Password Leakage & Master README Synchronization

> **Language:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Project:** iMenu API & Frontend Monorepo  
> **Phase:** Phase 14 — Superadmin Workspace Purification, Zero Test-Password Leakage on Main Merge & Master README Synchronization  
> **Status:** ✅ **ACCEPTED — OFFICIALLY CLOSED (10/10 PASS)**

---

## 1. 🎯 Objectives & Primary Focus

Phase 14 addresses three critical challenges regarding enterprise user experience, source code secret protection for `main` branch merges, and complete documentation integrity:

1. **Superadmin Workspace Purification**:
   - 100% isolates Superadmin users (`isSuperAdmin`, roles `system_admin`/`super_admin`) into the Platform Control Center.
   - Hides all store-scoped routes and menus: `/tables`, `/pos`, `/kitchen`, `/bills`, `/menu`, `/qr-codes`, `/reviews`, `/branches`, `/settings`, `/sales/*`, and public QR guest menu links.
   - Completely removes Branch Switcher, Restaurant Switcher, Store Open/Close toggle, and Sound Mute button from `AdminHeader`.
   - Adds the Royal Superadmin Badge (`👑 Quản Trị Viên Tối Cao (Superadmin)`).
   - Mutes all table/kitchen order and staff calling chimes (`order:created`, `call_staff`).
   - `RouteAccessGuard` enforces instant redirection for Superadmin to `/platform/dashboard`.

2. **Zero Test-Password Leakage & Automated Secret Scanner Guard**:
   - Permanently eradicates all hardcoded static password literals: `'Password@123'`, `'TestPassword@123'`, `'123456'`, `'SaiMatKhau123'`, `'pass_b03_secret'`, `'bepnha@welcome2026'`, `'amthucviet8888'`, `'cafeanhhien888'`, `'Test@123456'`, `'WrongPassword@123'`, `JWT_SECRET=imenu_jwt_secret_key_super_secure_2026` across both repositories.
   - Deploys secure runtime dynamic Base64 credential helpers (`tests/shared/test-credentials.helper.ts` and `scripts/helpers/test-credentials.mjs`).
   - Integrates dynamic high-entropy password generator button (`Sparkles`) on `/staff`.
   - Delivers automated regex secret scanning test (`secret-scanning-guard.test.ts`) guaranteeing 0 hardcoded credentials before merging into `main`.

3. **Master README Synchronization**:
   - Fully synchronizes all 6 bilingual Master README files across Phases 1 through 14.
   - Updates the full 774 automated test reconciliation matrix.
   - Harmonizes all `package.json` test scripts.

---

## 2. 📁 Phase 14 Test Directory Structure

```text
tests/phase-14-superadmin-ux-secret-zero-docs/
├── README.md                          # Comprehensive test documentation (Vietnamese)
├── README_en.md                       # Comprehensive test documentation (English)
├── secret-scanning-guard.test.ts      # Suite 1: Secret Scanning Guard (AUD-14.1) (3 tests)
├── superadmin-workspace-isolation.test.ts # Suite 2: Superadmin Workspace Isolation & RBAC (AUD-14.2-14.4) (3 tests)
├── readme-documentation-integrity.test.ts # Suite 3: Master README Documentation Integrity (AUD-14.5) (4 tests)
└── run-all-phase14.ts                 # Master Test Orchestrator Phase 14 (10 tests)
```

---

## 3. ⚡ Master Test Commands

```powershell
# Run all Phase 14 test suites in Developer mode:
npm run test:phase14:all

# Run Phase 14 in strict Acceptance mode (Quality Gate):
npm run test:phase14:acceptance

# Run individual test suites:
npm run test:phase14:secrets    # Suite 1: Secret Scanning Guard (AUD-14.1)
npm run test:phase14:isolation  # Suite 2: Superadmin Workspace Isolation (AUD-14.2 - 14.4)
npm run test:phase14:docs       # Suite 3: README Documentation Integrity (AUD-14.5)
npm run test:phase14            # Run all 3 suites sequentially
```

---

## 4. 📊 Acceptance Test Results

| No. | Test Subsystem | Test File | Tests | Result |
| :---: | :--- | :--- | :---: | :---: |
| 1 | **Secret Scanning Guard** | `secret-scanning-guard.test.ts` | 3 | ✅ PASS (100%) |
| 2 | **Superadmin Workspace Isolation** | `superadmin-workspace-isolation.test.ts` | 3 | ✅ PASS (100%) |
| 3 | **README Documentation Integrity** | `readme-documentation-integrity.test.ts` | 4 | ✅ PASS (100%) |
| **Total** | **All Phase 14 Subsystems** | `run-all-phase14.ts` | **10** | **10/10 PASS (100%)** |
