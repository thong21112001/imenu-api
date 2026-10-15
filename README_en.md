# 🍽️ iMenu Backend API - Smart Restaurant & Digital Menu Management Platform

<div align="center">

[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongoosejs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime%20KDS-black?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![JWT](https://img.shields.io/badge/Security-JWT%20%26%20RBAC-black?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![Swagger](https://img.shields.io/badge/API%20Docs-Swagger%20OpenAPI-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)](https://swagger.io/)

**Enterprise-grade RESTful API & Realtime WebSocket Backend for the iMenu All-in-One F&B Ecosystem**  
*Read documentation in Vietnamese: [Vietnamese README (README.md)](README.md)*

</div>

---

## 📋 Table of Contents
1. [Overview & Business Scope](#1-overview--business-scope)
2. [Technology Stack & System Architecture](#2-technology-stack--system-architecture)
3. [Multi-Tenant & Multi-Branch Isolation Architecture](#3-multi-tenant--multi-branch-isolation-architecture)
4. [Role-Based Access Control (RBAC) Matrix](#4-role-based-access-control-rbac-matrix)
5. [Key Feature Highlights (Phase 1 to Phase 7)](#5-key-feature-highlights-phase-1-to-phase-7)
6. [Real-time WebSocket Kitchen Display System (KDS) Hub](#6-real-time-websocket-kitchen-display-system-kds-hub)
7. [Table Lifecycle & Multi-Branch QR Code Generation](#7-table-lifecycle--multi-branch-qr-code-generation)
8. [Core API Endpoints Reference](#8-core-api-endpoints-reference)
9. [Local Installation & Development](#9-local-installation--development)
10. [Automated Testing Suites](#10-automated-testing-suites)
11. [Project Status & Acceptance](#11-project-status--acceptance)

---

## 1. 📖 Overview & Business Scope

**iMenu API** is a high-performance backend system built on **NestJS 11** and **MongoDB (Mongoose)**, powering the entire digital operations of modern restaurant and chain dining establishments:
- **Diners (Customers)**: Scan per-table QR codes to browse dynamic digital menus isolated by branch, customize options and toppings, place orders instantly across multiple rounds (multi-round ordering), request bill settlement, or chime staff.
- **Cashiers / POS Terminal**: Manage table maps visually, execute quick counter orders, transfer/merge tables, move items between tables, split billing, approve QR orders, apply discounts/taxes/service fees, settle orders with cash (with change calculation) or VietQR.
- **Kitchen Display System (KDS)**: Instant real-time order receipt via WebSockets, prioritize prep items, toggle dish statuses (`Cooking` ➔ `Ready` ➔ `Served`), and trigger sound alerts.
- **Managers & Restaurant Owners**: Manage staff accounts with granular RBAC permissions, configure per-branch menu pricing and dish availability, create tables and generate printable A6 Standee / Sticker QR codes, and view aggregated branch revenue analytics.

---

## 2. 🛠️ Technology Stack & System Architecture

### Tech Stack
| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | NestJS 11 | Modular architecture, Inversion of Control & Dependency Injection |
| **Language** | TypeScript 5 | Strict typing, robust interfaces, zero compile-time regressions |
| **Database** | MongoDB & Mongoose 8 | NoSQL with compound indexes, autopopulation, and soft-delete filters |
| **Realtime** | Socket.IO Gateway | Low-latency WebSockets for KDS order events and table status broadcasts |
| **Auth & Security** | Passport JWT & bcryptjs | Access Tokens (1d), Refresh Tokens (7-30d), hashed password storage |
| **Defensive Layer** | Helmet, CORS, DTO Validation | XSS prevention, Clickjacking guards, automatic DTO validation pipes |
| **Documentation** | Swagger OpenAPI 3.0 | Interactive API documentation accessible at `/api-docs` |
| **Logging** | Winston & Morgan | Structured HTTP request logs and daily rotating disk files |

### Request Lifecycle Diagram
```text
HTTP / WebSocket Request
  │
  ├──► Morgan Logger & Helmet Security Headers
  ├──► CORS Origin Filter (Whitelisting localhost ports)
  ├──► ValidationPipe (Sanitization, type casting, and validation)
  ├──► JwtAuthGuard (Bearer token validation - skipped on @Public())
  ├──► PermissionsGuard (Resource x Action permission checks)
  │
  ▼
[Controller] ➔ [Service] ➔ [Mongoose Model] ➔ [MongoDB Database]
                         │
                         └──► [EventEmitter2 / SocketGateway] ➔ Realtime Clients
```

---

## 3. 🏢 Multi-Tenant & Multi-Branch Isolation Architecture

The system enforces strict multi-tenant and multi-branch data isolation:
1. **Multi-Tenant Isolation**:
   - Every entity (`Table`, `TableZone`, `MenuCategory`, `MenuItem`, `Order`, `User`) is bound to a `restaurantId`.
   - All database queries filter strictly by `restaurantId` derived from the verified JWT payload. Tenant A can never read or mutate Tenant B's data (HTTP 404/403).
2. **Multi-Branch Isolation**:
   - Each restaurant owns a default **Main Branch** and can expand to multiple **Sub-Branches**.
   - **Tables & Zones**: Each branch manages independent tables, zones, and QR codes. Different branches within the same restaurant can share internal table codes (`B01`, `B02`) without conflict (Compound index `{ restaurantId: 1, branchId: 1, code: 1 }`).
   - **Branch Staff Guard**: Sub-branch staff (Manager, Cashier, Kitchen, Waiter) are strictly constrained to their designated `branchId`. They are blocked with HTTP 403 Forbidden if attempting to view or modify other branches' data.
   - **Chain Owners**: Can view unified chain analytics or switch seamlessly between branches.

---

## 4. 👥 Role-Based Access Control (RBAC) Matrix

Standardized role matrix:

| Role | Slug | Tables & POS | Kitchen KDS | Menu | Staff & Roles | Revenue Reports |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Super Admin** | `super_admin` | Full | Full | Full | System-wide | Global analytics |
| **Restaurant Owner** | `restaurant_admin` | Full | Full | Full | Chain-wide | Aggregated & per-branch |
| **Branch Manager** | `restaurant_manager` | Full | Full | View & Out-of-Stock | Own branch only | Own branch only |
| **Cashier** | `cashier` | View, Create, Settle | View | View & Out-of-Stock | None | Current shift |
| **Kitchen Staff** | `kitchen` | None | View & Update items | None | None | None |
| **Waiter** | `waiter` | View & Add items | None | View | None | None |

---

## 5. 🚀 Key Feature Highlights (Phase 1 to Phase 7)

- **Phase 1: Foundation & Security**: Modular NestJS setup, JWT Auth, Swagger `/api-docs`, Winston logging, MongoDB schemas.
- **Phase 2: Multi-Restaurant & Branch Lifecycle**: Auto-provisioned main branch, temporary closing/re-opening hours, independent VietQR banking and phone numbers per branch, accounting protection (disallow physical deletion of branches with historical orders).
- **Phase 3: Staff RBAC & Branch Transfers**: User locking/unlocking, staff branch transfers, protection of system default roles.
- **Phase 4: Menu Engineering & Toppings**: Category and dish CRUD, option/topping groups, per-branch price overrides, per-branch out-of-stock toggles, Vietnamese unaccented regex search (`pho bo` matches `Phở bò`), and soft-deletion.
- **Phase 5: Orders, POS, Realtime KDS & QR Lifecycle**: Interactive table maps, table transfer, table merge, POS VietQR payments, two-way WebSocket KDS updates, and dynamic per-branch table QR generation.
- **Phase 6: Order Operations & POS ✅ (ACCEPTED — OFFICIALLY CLOSED)**: Complete order lifecycle with state machine transitions, multi-round customer QR ordering, POS order approval and management, VAT/service-fee/discount billing, cash payment (with change calculation) and VietQR settlement, idempotency key protection against duplicate payments, atomic concurrent payment claims, table-order synchronization with CAS locks and OCC retry, advanced order querying, Frontend Monorepo integration with bill preview and WebSocket room security, and cross-app browser E2E validation.
- **Phase 7: Kitchen Display System (KDS) & Realtime Dish Dispatching ✅ (ACCEPTED — OFFICIALLY CLOSED)**: Industrial-grade high-contrast Dark Mode KDS interface, strict FIFO queue ordering (`createdAt ASC`), items summary aggregation (`GET /api/kitchen/items-summary`), granular item status transitions (`WaitingConfirmation` → `Waiting` → `Cooking` → `Ready` → `Served`) with automatic order status upgrades (`Preparing`, `Ready`, `Served`), batch round updates, branch-isolated 86 out-of-stock management, 3-way real-time WebSocket pairing (KDS ↔ POS ↔ Customer QR Menu) with audible Chime alerts, and adversarial security hardening preventing cross-branch IDOR, race conditions, and unauthenticated WebSocket room leakage.

### Phase 7 — Detailed 6 Sub-phase Scope

| Sub-phase | Name | Description |
| :---: | :--- | :--- |
| 7.1 | KDS Queue Engine & FIFO Ordering | Strict FIFO queue (`createdAt ASC`), branch/zone/status filtering, exclusion of `Paid`/`Cancelled` orders, item count aggregation |
| 7.2 | Item Status State Machine & Auto Upgrade | Granular item status transitions (`start-cooking`, `mark-ready`, `mark-served`), batch updates, automatic order status progression to `Preparing`, `Ready`, `Served`, negative guards |
| 7.3 | Out-of-Stock (86) Management & Branch Isolation | Kitchen menu queries, branch-isolated 86 stockout toggles, Blueprint Edge Case #2 (active orders proceed, new QR orders blocked 400) |
| 7.4 | Cross-App Realtime WebSocket Pairing | 3-way sync between KDS ↔ POS ↔ Diner, real-time tracking drawer, audible chime notifications on new order / completion |
| 7.5 | Modern KDS User Interface | High-contrast Dark Mode screen, visual order cards, elapsed timers with 15-minute delay alerts, one-touch 86 modal |
| 7.6 | Hardening, Adversarial Audit & Closure | Full resolution of AUD-7.1 to AUD-7.6: Cross-branch cook IDOR sealed, `perm-kds-cook` vs `perm-kds-out` separation, Atomic OCC updates against race conditions, guest WebSocket room isolation, UI rollback |

### Known Limitations & Architecture Boundaries

- **Hardware thermal printer**: Phase 6 provides an architecture specification document (`thermal-printer-spec.md`). No hardware driver, WebUSB/WebSerial transport, or ESC/POS binary builder has been implemented. Hardware integration is planned for **Phase 8**.
- **Redis Pub/Sub & multi-node distributed messaging**: Not implemented. The current realtime system uses EventEmitter2 + Socket.IO on a single process combined with `BroadcastChannel` for browsers. Distributed multi-node messaging remains a future scaling scope.

---

## 6. ⚡ Real-time WebSocket Kitchen Display System (KDS) Hub

Realtime events broadcast over Socket.IO:
- `order:created` / `NEW_ORDER`: Dispatched to KDS when orders are placed via POS or Customer QR.
- `order:item_status_updated`: Synchronizes dish progress (`Cooking` ➔ `Ready` ➔ `Served`) across KDS, POS, and Diner views.
- `table.status_updated`: Updates table occupancy colors in real-time (`Available` ➔ `Occupied` ➔ `PaymentRequested`).
- `CALL_STAFF`: Triggers audible alerts when a customer rings for service.

---

## 7. 🪑 Table Lifecycle & Multi-Branch QR Code Generation

### QR Token & Dynamic URL:
- Each table is generated with a secure random `qrToken` (8 chars).
- Canonical Table QR URL format:
  ```text
  http://localhost:3005/menu/:restaurantSlug/:tableCode?t=:qrToken&branch=:branchId
  ```
- **QR Code Revocation**: Administrators can revoke a compromised table QR (`qrStatus: 'revoked'`) or regenerate a new `qrToken` with one click without altering the table number.
- **Printing Presets**: Standard A6 Standee format (105mm x 148mm) and compact table sticker format (70mm x 70mm).

---

## 8. 📡 Core API Endpoints Reference

Interactive documentation available at: `http://localhost:3001/api-docs`

| Group | Method | Endpoint | Description | Permissions |
| :--- | :---: | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/register` | Register new restaurant & owner | Public |
| | `POST` | `/api/auth/login` | Staff / Owner login | Public |
| | `GET` | `/api/auth/profile` | Current authenticated profile | Bearer Token |
| **Branches** | `GET` | `/api/branches` | List branches | POS.VIEW |
| | `POST` | `/api/branches` | Create sub-branch | RESTAURANT.UPDATE |
| | `PATCH` | `/api/branches/:id/close` | Temporarily close branch | RESTAURANT.UPDATE |
| **Tables** | `GET` | `/api/tables` | List tables by branch/zone | POS.VIEW |
| | `POST` | `/api/tables` | Create table with QR token | TABLE.UPDATE |
| | `PUT` | `/api/tables/:id` | Update table / QR status | TABLE.UPDATE |
| | `POST` | `/api/tables/seed-default` | Seed 12 sample tables & 4 zones | TABLE.UPDATE |
| | `POST` | `/api/tables/transfer` | Transfer active order to table | POS.VIEW |
| | `POST` | `/api/tables/merge` | Merge multiple tables | POS.VIEW |
| | `POST` | `/api/tables/move-items` | Move items between tables | POS.VIEW |
| **Table Zones** | `GET` | `/api/table-zones` | List table zones | POS.VIEW |
| | `POST` | `/api/table-zones` | Create custom zone | TABLE.UPDATE |
| **Menu** | `GET` | `/api/categories` | Public category listing | Public |
| | `GET` | `/api/menu-items` | Public menu items with branch price | Public |
| **Orders** | `POST` | `/api/orders` | Create order (POS) | POS.ORDER |
| | `GET` | `/api/orders` | Query orders (filters, search, pagination) | POS.VIEW |
| | `GET` | `/api/orders/:id` | View order details | POS.VIEW |
| | `GET` | `/api/orders/:id/bill-preview` | Preview bill (VAT, fees, discounts) | POS.VIEW |
| | `POST` | `/api/orders/:id/pay` | Settle bill payment (Cash / VietQR) | POS.CONFIRM |
| | `PATCH` | `/api/orders/:id/items/:itemId/status` | Update KDS dish status | KDS.COOK |
| | `POST` | `/api/orders/:id/rounds/:roundNumber/confirm` | Approve QR order round | POS.ORDER |
| | `POST` | `/api/orders/:id/rounds/:roundNumber/cancel` | Cancel QR order round | POS.ORDER |
| | `GET` | `/api/orders/public/table-context` | Public table context for QR menus | Public |
| | `POST` | `/api/orders/customer` | Customer QR order placement | Public |
| | `POST` | `/api/orders/customer/items` | Customer add items (subsequent rounds) | Public |
| **Kitchen / KDS** | `GET` | `/api/kitchen/orders` | Active order queue for KDS (FIFO ordered) | KITCHEN.VIEW |
| | `GET` | `/api/kitchen/items-summary` | Summary of waiting & cooking items by branch | KITCHEN.VIEW |
| | `GET` | `/api/kitchen/menu-items` | Dish list with per-branch stockout status | KITCHEN.VIEW |
| | `PATCH` | `/api/kitchen/menu-items/:id/availability` | Kitchen 86 stockout toggle per branch | KITCHEN.UPDATE (perm-kds-out) |
| | `POST` | `/api/order-items/:id/start-cooking` | Start cooking order item (Cooking) | KITCHEN.UPDATE (perm-kds-cook) |
| | `POST` | `/api/order-items/:id/mark-ready` | Mark order item cooked (Ready) | KITCHEN.UPDATE (perm-kds-cook) |
| | `POST` | `/api/order-items/:id/mark-served` | Mark order item delivered to table (Served) | KITCHEN.UPDATE (perm-kds-cook) |
| | `POST` | `/api/orders/:id/kitchen/batch-update` | Batch update items by round or order | KITCHEN.UPDATE (perm-kds-cook) |

---

## 9. 💻 Local Installation & Development

### Prerequisites
- Node.js `>= 18.0.0`
- MongoDB `>= 6.0` (running at `mongodb://localhost:27017`)

### Setup Instructions:
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start development server (Port 3001)
npm run start:dev

# 4. Build for production
npm run build
```

### Environment Configuration & Credentials Security

Core authentication environment variables configured in `.env`:

| Environment Variable | Purpose | Value in `.env.example` | Local Development Value (`.env`) |
| :--- | :--- | :--- | :--- |
| `SUPERADMIN_EMAIL` | Highest-level system administrator email | `superadmin@imenu.vn` | `superadmin@imenu.vn` |
| `SUPERADMIN_PASSWORD` | Super Admin account password | `your_superadmin_password_here` | *(Set your secure local password)* |
| `DEMO_USER_PASSWORD` | Seed password for 5 demo accounts (`owner`, `manager`, `cashier`, `kitchen`, `waiter`) | `your_demo_password_here` | *(Set your local demo password)* |

> [!IMPORTANT]
> **Credentials Security & Main Branch Merge Compliance**:
> - All Git-tracked codebase files **strictly contain NO hardcoded passwords**.
> - All `.env.example` template files contain placeholder values only (`your_demo_password_here`), ensuring 100% security when committing to Git and avoiding automated Secret Scanning alerts (GitHub Secret Scanning, TruffleHog, SonarQube).
> - Active passwords must only be stored in your local `.env` file, which is strictly guarded by `.gitignore`.

---

## 10. 🧪 Automated Testing Suites

The iMenu test ecosystem comprises **365 comprehensive automated tests** (with automatic fixture teardown and zero database residue), covering the full Phase 2 through Phase 6 scope.

### Master Test Orchestrator

```bash
# Developer Test Run (270 backend + 9 SDK = 279 mandatory tests; allows SKIP for E2E if UI servers are down)
npm run test:phase6:all

# Final Acceptance Run (365 mandatory tests: 0 FAIL, 0 SKIP, 0 BLOCKED)
npm run test:phase6:acceptance
```

> **Important:** `test:phase6:all` (runs with `--mode=dev`) and `test:phase6:acceptance` (runs with `--mode=acceptance`) both use the Master Test Orchestrator (`run-all-phase6.ts`). Acceptance mode requires all 365 test cases to achieve 100% PASS. Dev mode allows E2E SKIP when UI servers are not running.

### Per-Phase Test Commands (Regression)

```bash
# Phase 2: Auth, Restaurant & Multi-Branch (24 tests)
npm run test:phase2:all

# Phase 3: Staff RBAC, Roles & Branches (16 tests)
npm run test:phase3

# Phase 4: Menu, Toppings & Branch Price Overrides (17 tests)
npm run test:phase4

# Phase 5: Tables, Orders & Realtime KDS WebSocket (20 tests)
npm run test:phase5

# Full Phase 2–5 Regression Suite (77 tests):
npm run test:regression:phase2-5
```

### Phase 6 Test Commands (Order & POS)

```bash
# Run 6 core backend suites (241 tests — excludes sub-phase 6.8 Integration):
npm run test:phase6

# Run individual sub-phase suites:
npm run test:phase6:transitions  # Sub-phase 6.2: State Machine (56 tests)
npm run test:phase6:pos          # Sub-phase 6.3: POS Cashier (30 tests)
npm run test:phase6:customer-qr  # Sub-phase 6.4: Customer QR (43 tests)
npm run test:phase6:concurrency  # Sub-phase 6.5: Idempotency (32 tests)
npm run test:phase6:sync         # Sub-phase 6.6: Table Sync (38 tests)
npm run test:phase6:query        # Sub-phase 6.7: Order Query (42 tests)
npm run test:phase6:integration  # Sub-phase 6.8: Frontend Monorepo Integration (29 tests)

# Phase 7 (Kitchen / KDS - 50 tests):
npm run test:phase7:all

# Cross-app browser E2E tests:
npm run test:phase6:e2e
npm run test:phase7:e2e
```

### 415-Test Ecosystem Reconciliation Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│  IMENU TEST ECOSYSTEM — 415 VERIFIED AUTOMATED TEST CASES                │
├────────────────────────────────┬──────────────────────┬────────────────┤
│ Test Group                      │ Source Location       │ Test Count     │
├────────────────────────────────┼──────────────────────┼────────────────┤
│ 1. Phase 7 Kitchen / KDS       │ tests/phase-07-kitch │ 50             │
│ 2. Phase 6 Orders & POS        │ tests/phase-06-order │ 288            │
│ 3. Phases 2–5 Regression       │ tests/phase-02..05   │ 77             │
├────────────────────────────────┴──────────────────────┼────────────────┤
│ TOTAL ECOSYSTEM (ACCEPTANCE CLOSURE REQUIREMENT)       │ 415 TESTS      │
└───────────────────────────────────────────────────────┴────────────────┘
```

### Detailed Test Documentation

- **Master test index:** [tests/README.md](tests/README.md) (Vietnamese) | [tests/README_en.md](tests/README_en.md) (English)
- **Phase 7 detailed documentation:** [tests/phase-07-kitchen-kds/README.md](tests/phase-07-kitchen-kds/README.md) (Vietnamese) | [tests/phase-07-kitchen-kds/README_en.md](tests/phase-07-kitchen-kds/README_en.md) (English)
- **Phase 6 detailed documentation:** [tests/phase-06-order-pos/README.md](tests/phase-06-order-pos/README.md) (Vietnamese) | [tests/phase-06-order-pos/README_en.md](tests/phase-06-order-pos/README_en.md) (English)
- **Thermal printer spec (Phase 8):** [tests/phase-06-order-pos/thermal-printer-spec.md](tests/phase-06-order-pos/thermal-printer-spec.md)

---

## 11. 📊 Project Status & Acceptance

### Phase 7 Status: ✅ ACCEPTED — OFFICIALLY CLOSED

Phase 7 (Kitchen Display System & Realtime Dish Dispatching) has completed all 6 sub-phases (7.1 through 7.6) and has been officially accepted through the Master Phase 7 Closure Gate verification process.

**Phase 7 Acceptance Results:**

| Test Group | Test Count | Result |
| :--- | :---: | :---: |
| Phase 7 Backend Suites (4 suites) | 30 | ✅ PASS |
| Frontend SDK Contract Suite | 14 | ✅ PASS |
| Browser E2E KDS Lifecycle | 6 | ✅ PASS |
| Phase 6 Full Regression | 288 | ✅ PASS |
| Phases 2–5 Core Regression | 77 | ✅ PASS |
| **TOTAL ECOSYSTEM** | **415** | **415/415 PASS (100%)** |

- **FAIL:** 0
- **SKIP:** 0
- **BLOCKED:** 0

### Overall Roadmap

| Phase | Status |
| :--- | :--- |
| Phase 1: Foundation API & Security | ✅ Completed |
| Phase 2: Multi-Restaurant & Branch Lifecycle | ✅ Completed |
| Phase 3: Staff RBAC & Branch Transfers | ✅ Completed |
| Phase 4: Menu Engineering & Toppings | ✅ Completed |
| Phase 5: Orders, POS & Realtime KDS | ✅ Completed |
| Phase 6: Order Operations & POS | ✅ Accepted & Officially Closed |
| Phase 7: Kitchen Display System (KDS) | ✅ Accepted & Officially Closed |
| Phase 8+: Hardware Integration & Thermal Printing | 🔜 Next Milestone |
