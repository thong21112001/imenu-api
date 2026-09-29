# Phase 4 Integration Testing: Menu Management & Topping Groups

Comprehensive automated test suite for Phase 4 of the **iMenu API** platform, covering: Menu Categories, Menu Items, Option Groups & Toppings (Nested Option Groups & Values), Cashier Fast Toggle (Available/Unavailable), Category Deletion Safety Constraint, Multi-Tenant Data Isolation, and Public QR Menu Access for customers.

---

## 📋 13 Automated Test Cases

| # | Test Case Code | Test Scenario | Objectives & Expectations | Status |
|:---:|:---|:---|:---|:---:|
| 1 | `TC-MENU-01` | Create new menu category | Restaurant owner creates category, automatic SEO-friendly slug generation (`mon-nuong-bbq-dac-sac`), HTTP 201 Created | ✅ PASS |
| 2 | `TC-MENU-02` | Automatic slug collision resolution | Duplicate category names in the same restaurant auto-append a unique random suffix, HTTP 201 Created | ✅ PASS |
| 3 | `TC-MENU-03` | Update category information | Update category name, emoji icon, and display sort order, HTTP 200 OK | ✅ PASS |
| 4 | `TC-MENU-04` | Create menu item with Option Groups & Toppings | Item with multiple option groups (Size, Spicy level, Extra toppings with price deltas), stores nested option structure, HTTP 201 Created | ✅ PASS |
| 5 | `TC-MENU-05` | Filter and paginate menu items | Filter by category, popular status (`isPopular=true`), pagination (`limit=10`), returns accurate item list and total count | ✅ PASS |
| 6 | `TC-MENU-06` | Edit menu item details | Update item name, selling price, and discount pricing, HTTP 200 OK | ✅ PASS |
| 7 | `TC-MENU-07` | Cashier fast status toggle (Available/Unavailable) | Cashier toggles `isAvailable: false -> true` via `/status` endpoint with proper RBAC permission enforcement, HTTP 200 OK | ✅ PASS |
| 8 | `TC-MENU-08` | Safe deletion constraint for categories | Prevents deleting categories that still contain active dishes, returns HTTP 400 Bad Request with a descriptive error message | ✅ PASS |
| 9 | `TC-MENU-09` | Delete menu item | Restaurant owner permanently deletes an item from the menu, HTTP 200 OK | ✅ PASS |
| 10 | `TC-MENU-10` | Delete empty category | Successfully deletes category once all dishes have been removed or re-assigned, HTTP 200 OK | ✅ PASS |
| 11 | `TC-MENU-11` | Multi-Tenant Data Isolation | Cross-tenant access between Restaurant A & B is strictly blocked (HTTP 404/403) | ✅ PASS |
| 12 | `TC-MENU-12` | Public QR Menu Access without Token | Dine-in guests scanning table QR codes can query active categories and dishes publicly without JWT authentication, HTTP 200 OK | ✅ PASS |
| 13 | `TC-MENU-13` | Seed Standard Vietnamese Default Menu via API | Owner invokes `POST /categories/seed-default` to seed 4 standard categories and 8 dishes with toppings into an empty restaurant, HTTP 200 OK | ✅ PASS |

---

## 🚀 How to Run the Tests

### 1. Prerequisites
- Node.js >= 18
- MongoDB Server running on `mongodb://localhost:27017`
- Automated test runs use an isolated database: `imenu-db-test`

### 2. Execution Commands

```bash
# Navigate to backend directory
cd imenu-api

# Run Phase 4 menu test suite
npm run test:phase4

# Run all regression test suites
npm run test:phase2:all
npm run test:phase3
npm run test:phase4
```

---

## 🛡️ Zero Garbage Teardown Guarantee

After test execution completes (whether passing or failing), the `finally` teardown block cleans up all test resources:
- All generated menu categories (`menu_categories`).
- All generated menu items (`menu_items`).
- All test accounts and restaurants (`owner.p4.*`, `cashier.p4.*`).
- Closes HTTP server and MongoDB connections safely, leaving zero leftover test data.
