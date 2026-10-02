# Phase 4 Integration Tests: Multi-Branch Menu, Vietnamese Regex Search, POS & Soft Delete

Comprehensive automated test suite for Phase 4 of **iMenu API**, including: Categories, Menu Items, Option Groups & Toppings, Fast Availability Toggle for Cashiers, Category Deletion Safety Constraints, Multi-Tenant Data Isolation, Public QR Menu Access, Branch Price/Deal Overrides, Smart Vietnamese Regex Search, and System-Wide Soft Delete.

---

## 📋 List of 17 Test Cases

| No. | Test Case ID | Test Case Name | Objective & Expected Outcome | Status |
|:---:|:---|:---|:---|:---:|
| 1 | `TC-MENU-01` | Create new menu category | Owner creates category, auto-generates clean SEO slug (`mon-nuong-bbq-dac-sac`), HTTP 201 Created | ✅ PASS |
| 2 | `TC-MENU-02` | Automatic slug collision resolution | When creating duplicate category names in the same restaurant, system appends unique suffix, HTTP 201 Created | ✅ PASS |
| 3 | `TC-MENU-03` | Update category information | Update category name, emoji icon, and display order, HTTP 200 OK | ✅ PASS |
| 4 | `TC-MENU-04` | Create dish with Option Groups & Toppings | Create dish with nested options (Size, Spiciness, Toppings with delta pricing), HTTP 201 Created | ✅ PASS |
| 5 | `TC-MENU-05` | Query menu items with filter & pagination | Filter by category, popular status (`isPopular=true`), pagination (`limit=10`), HTTP 200 OK | ✅ PASS |
| 6 | `TC-MENU-06` | Edit menu item details | Update dish name, price, and original promotional price, HTTP 200 OK | ✅ PASS |
| 7 | `TC-MENU-07` | Cashier fast availability toggle | Cashier toggles `isAvailable: false -> true` via `/status`, RBAC permissions verified, HTTP 200 OK | ✅ PASS |
| 8 | `TC-MENU-08` | Safe deletion constraint for categories | Prevents deleting categories containing items, returns HTTP 400 Bad Request with descriptive message | ✅ PASS |
| 9 | `TC-MENU-09` | Delete dish from menu | Owner deletes a dish, HTTP 200 OK | ✅ PASS |
| 10 | `TC-MENU-10` | Delete empty category | Allows deleting empty categories, HTTP 200 OK | ✅ PASS |
| 11 | `TC-MENU-11` | Multi-Tenant data isolation | Restaurant B cannot access, modify, or delete Restaurant A's menu data (HTTP 404/403) | ✅ PASS |
| 12 | `TC-MENU-12` | Public QR customer menu access | Customers scanning QR code can view active categories and dishes without JWT authentication, HTTP 200 OK | ✅ PASS |
| 13 | `TC-MENU-13` | Seed default Vietnamese menu via API | Owner invokes `POST /categories/seed-default`, auto-generates 4 categories and 8 dishes with toppings, HTTP 200 OK | ✅ PASS |
| 14 | `TC-MENU-14` | Branch-specific pricing & promotional deals | Allows sub-branches to have custom prices and deals (`branchOverrides`). Resolves `effectivePrice` and `effectiveOriginalPrice` when queried with `branchId`, HTTP 200 OK | ✅ PASS |
| 15 | `TC-MENU-15` | Branch-isolated cashier availability toggle | Branch cashier toggles availability via `/status?branchId=...`, flipping `effectiveIsAvailable` only for their branch, other branches remain unaffected, HTTP 200 OK | ✅ PASS |
| 16 | `TC-MENU-16` | Smart Vietnamese & English regex search | Unaccented typing (`pho bo`, `tra dao`) matches accented Vietnamese titles via regex character class mapping, HTTP 200 OK | ✅ PASS |
| 17 | `TC-MENU-17` | Comprehensive soft delete & slug collision prevention | Replaces hard delete with soft delete (`isDeleted: true`, `deletedAt`). Renames slug to `${slug}_deleted_${timestamp}` to allow re-creating dishes with identical names without MongoDB unique key errors, HTTP 200 OK | ✅ PASS |

---

## 🚀 Execution Instructions

### 1. Requirements
- Node.js >= 18
- MongoDB Server running at `mongodb://localhost:27017`
- Automated test runs against isolated database: `imenu-db-test`

### 2. Commands

```bash
cd imenu-api

# Run Phase 4 suite
npm run test:phase4

# Run regression test suites
npm run test:phase2:all
npm run test:phase3
npm run test:phase4
```

---

## 🛡️ Zero Garbage Teardown

Upon test suite completion, the `finally` teardown block automatically removes:
- All generated menu categories (`menu_categories`).
- All generated menu items (`menu_items`).
- All test branches (`branches`).
- Test accounts and restaurants (`owner.p4.*`, `cashier.p4.*`).
- Closes HTTP and database connections cleanly.
