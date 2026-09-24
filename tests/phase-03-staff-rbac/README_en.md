# 🧪 Phase 3 Testing Documentation: Staff Management & RBAC

> **Language:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Testing Module:** Staff Management + Soft Delete + Permission Matrix (RBAC & Permission Mapping) + Global Multi-Tenant Super Admin  
> **Specification:** Based on iMenu Backend API Phase 3 Architecture & System RBAC Blueprint.

---

## 1. 📁 Test Directory Structure

The End-to-End Integration Test Suite for Phase 3 is organized inside:

| Test File | Test Suite Name | Test Count | Command | Business Focus |
| :--- | :--- | :---: | :--- | :--- |
| [`test.ts`](test.ts) | **Phase 3: Staff Management & RBAC Test Suite** | 16 cases | `npm run test:phase3` | Super Admin env credentials synchronization, multi-restaurant visibility & management, staff onboarding assistance, Soft Delete, system role immutability, 2-way permission mapping, sub-branch data scoping, branch staff protection, and independent VietQR branch accounts |

---

## 2. 📋 16 Detailed Test Scenarios

| # | Test Scenario | Endpoint & Method | Business Purpose & Expected Results |
| :---: | :--- | :--- | :--- |
| **1** | **Super Admin Initialization & Password Overwrite** | `POST /api/auth/login` | Successfully logs in using credentials defined in `.env` (`SUPERADMIN_EMAIL` & `SUPERADMIN_PASSWORD`). The password hash is always regenerated and overwritten on server boot. |
| **2** | **Verify JWT Payload & Super Admin Permissions** | `GET /api/auth/me` | Super Admin token contains `role: SYSTEM_ADMIN`, all 17 system permissions, `restaurantId: undefined`, granting unrestricted platform-level access. |
| **3** | **Super Admin Global Restaurant List** | `GET /api/restaurants` | `200 OK`, returns all restaurants across the platform along with real-time aggregated metrics (`branchCount` and `staffCount`). |
| **4** | **Super Admin Global Staff Directory** | `GET /api/users` | `200 OK`, when no `restaurantId` filter is provided, Super Admin retrieves all staff members across all restaurants with populated tenant references. |
| **5** | **Filter Staff by Target Restaurant** | `GET /api/users?restaurantId=X` | `200 OK`, staff list is filtered accurately by the specified restaurant ID. |
| **6** | **Super Admin Creates Staff for Restaurant** | `POST /api/users` | Allows Super Admin to assist restaurant owners by creating staff for a specified target restaurant (`restaurantId`), automatically attaching to the main branch if unspecified. |
| **7** | **Staff Soft Delete Mechanism** | `DELETE /api/users/:id` | `200 OK`, applies soft deletion: sets `isDeleted: true`, `status: DELETED`, and records `deletedAt`. Soft-deleted staff are immediately excluded from standard queries. |
| **8** | **Block Login for Soft-Deleted Staff** | `POST /api/auth/login` | `401 Unauthorized`, system rejects authentication attempts even with valid passwords for accounts marked as soft-deleted. |
| **9** | **Self-Deactivation & Self-Deletion Protection** | `DELETE & PATCH /users/:id` | `400 Bad Request`, safety guard prevents authenticated callers from deleting or deactivating their own account. |
| **10** | **Super Admin Account Absolute Protection** | `DELETE & PATCH /users/:superAdminId` | `403 Forbidden`, other users or tenant owners are strictly prohibited from deleting or modifying Super Admin accounts. |
| **11** | **Custom Role CRUD & Bidirectional Permission Mapping** | `/api/roles` (POST, GET, PUT, DELETE) | Creates role with flat permission string IDs (`['perm-pos-view', 'perm-pos-create']`), MongoDB persists normalized `PermissionSubdocument[]`, API returns mapped `permissionIds`, role deletion succeeds. |
| **12** | **System Role Immutability & Demo Block Guard** | `DELETE /api/roles/:id` | `400 Bad Request` when attempting to delete predefined system roles (`isSystem: true`); Demo accounts (`owner@sample.vn`) receive `403 Forbidden` for mutating requests via `DemoBlockGuard`. |
| **13** | **Sub-Branch Data Scoping & Permission Isolation** | `GET /api/users` & `GET /api/branches` | `isMainBranch = false` for sub-branch users; staff queries and branch queries automatically restrict results to the caller's sub-branch only. |
| **14** | **Branch Staff Integrity & Cross-Branch Protection** | `/api/users` (POST, PUT, PATCH, DELETE) | `403 Forbidden` when a sub-branch user attempts to create staff for another branch, assign admin roles, mutate/lock/delete staff outside their branch, or transfer staff across branches. Sub-branch cashier creation succeeds with `201 Created`. |
| **15** | **Branch Management Scoping & Independent VietQR Configuration** | `/api/branches` (POST, PUT) | `403 Forbidden` when a sub-branch admin attempts to create branches, modify another branch, or escalate `isMainBranch`. Sub-branch successfully updates its own hotline, operating hours, and independent VietQR account (`200 OK`). |
| **16** | **SaaS System Role Immutability & RBAC Scoping** | `/api/roles` (POST, PUT) | `403 Forbidden` when sub-branch accounts attempt to create or modify roles; `403 Forbidden` when restaurant owners attempt to alter SaaS default roles; Only Super Admin can modify system roles (`200 OK`). |

---

## 3. 🚀 Test Execution Guide

### Prerequisites:
- Dependencies installed: `npm install`
- MongoDB running on standard port (`mongodb://localhost:27017`) or configured via `TEST_MONGODB_URL`.

### Run Commands:
```bash
# Run Phase 3 test suite individually
npm run test:phase3

# Run all integration suites sequentially
npm run test:phase2:all && npm run test:phase3
```

---

## 4. 📊 Automated Teardown Mechanism (Zero Garbage)

Upon completion, `test.ts` executes automated cleanup in its `finally` block:
1. Spawns isolated test records with unique timestamps (`timestamp`).
2. Cleans up test restaurants, branches, users with prefix `owner.p3.`, `staff.p3.`, `subadmin.`, `cashier.q7.`, and custom roles with prefix `custom_pos_`.
3. Assures zero database residue after test suite completion.
