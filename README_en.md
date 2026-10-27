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
5. [Key Feature Highlights (Phase 1 to Phase 9)](#5-key-feature-highlights-phase-1-to-phase-9)
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

## 5. 🚀 Key Feature Highlights (Phase 1 to Phase 10)

- **Phase 1: Foundation & Security**: Modular NestJS setup, JWT Auth, Swagger `/api-docs`, Winston logging, MongoDB schemas.
- **Phase 2: Multi-Restaurant & Branch Lifecycle**: Auto-provisioned main branch, temporary closing/re-opening hours, independent VietQR banking and phone numbers per branch, accounting protection (disallow physical deletion of branches with historical orders).
- **Phase 3: Staff RBAC & Branch Transfers**: User locking/unlocking, staff branch transfers, protection of system default roles.
- **Phase 4: Menu Engineering & Toppings**: Category and dish CRUD, option/topping groups, per-branch price overrides, per-branch out-of-stock toggles, Vietnamese unaccented regex search (`pho bo` matches `Phở bò`), and soft-deletion.
- **Phase 5: Orders, POS, Realtime KDS & QR Lifecycle**: Interactive table maps, table transfer, table merge, POS VietQR payments, two-way WebSocket KDS updates, and dynamic per-branch table QR generation.
- **Phase 6: Order Operations & POS ✅ (ACCEPTED — OFFICIALLY CLOSED)**: Complete order lifecycle with state machine transitions, multi-round customer QR ordering, POS order approval and management, VAT/service-fee/discount billing, cash payment (with change calculation) and VietQR settlement, idempotency key protection against duplicate payments, atomic concurrent payment claims, table-order synchronization with CAS locks and OCC retry, advanced order querying, Frontend Monorepo integration with bill preview and WebSocket room security, and cross-app browser E2E validation.
- **Phase 7: Kitchen Display System (KDS) & Realtime Dish Dispatching ✅ (ACCEPTED — OFFICIALLY CLOSED)**: Industrial-grade high-contrast Dark Mode KDS interface, strict FIFO queue ordering (`createdAt ASC`), items summary aggregation (`GET /api/kitchen/items-summary`), granular item status transitions (`WaitingConfirmation` → `Waiting` → `Cooking` → `Ready` → `Served`) with automatic order status upgrades (`Preparing`, `Ready`, `Served`), batch round updates, branch-isolated 86 out-of-stock management, 3-way real-time WebSocket pairing (KDS ↔ POS ↔ Customer QR Menu) with audible Chime alerts, and adversarial security hardening preventing cross-branch IDOR, race conditions, and unauthenticated WebSocket room leakage.
- **Phase 8: Payment, Bill, ESC/POS Thermal Printing & Financial Audit ✅ (ACCEPTED — OFFICIALLY CLOSED)**: Full financial settlement and auditing lifecycle: Customer QR payment requests (`PaymentRequested`), server-side independent dynamic VietQR recalculation, Bills engine with Natural Idempotency and `E11000` handling guaranteeing exactly 1 Bill per Order, accurate cash change calculation (`changeAmount`), atomic table release to `Available`, immutable financial audit logging in `activity_logs`, industrial binary ESC/POS 80mm/58mm thermal receipt compilation (100% ASCII sanitization, cash drawer kick pulse, partial cut), upgraded `/bills` management interface and thermal print modal on Admin POS, and adversarial security hardening (`AUD-8.1` to `AUD-8.6`).
- **Phase 9: Dashboard, Revenue Reports, CSV Export, Demo Tables & UI/UX Overhaul ✅ (ACCEPTED — OFFICIALLY CLOSED)**: Business intelligence and comprehensive user experience overhaul: Realtime KPI indicators with Dual-Key Engine, multi-dimensional revenue analytics (`day`, `week`, `month`) broken down across 4 payment methods (`Cash`, `VietQR`, `Card`, `Transfer`), top-selling dish analytics including options price delta (`options.priceModifier`), secure UTF-8 BOM CSV export for Microsoft Excel protected under `REPORT.EXPORT` (`perm-rep-export`), public discovery API for dining tables with valid QR tokens, Admin Sidebar restructured into 4 logical groups, and full Customer Menu Responsive overhaul across Mobile, Tablet, and Desktop.
- **Phase 10: Realtime WebSocket Gateway, Room Security & Ecosystem Finalization ✅ (ACCEPTED — FULL ROADMAP COMPLETED 10/10 PHASES)**: Realtime infrastructure and collaborative multi-tab operations: Customer table call staff with 60-second table cooldown and TTL memory eviction, two-way staff acknowledgment flow emitting `staff_acknowledged` to table rooms, standardized domain events matrix across 7 operational event groups (New Order, Order Updated, Item Status, Table Status, Call Staff, Payment & Bills, 86 Out-of-Stock), hierarchical room isolation (`restaurant_${id}`, `branch_${id}`, `table_${id}`) with guest isolation from staff rooms, dynamic room cleanup via `client.leave(r)` upon branch switching, Frontend SDK methods (SDK-30, SDK-31, SDK-32), Socket client resilience with exponential backoff and jitter, canonical event deduplication eliminating double chimes, FIFO 50-notification buffer on Admin Header, and multi-tab browser E2E test synchronization.

### Phase 10 — Detailed 6 Sub-phase Scope

| Sub-phase | Name | Description |
| :---: | :--- | :--- |
| 10.1 | Customer Call Staff & Two-Way Acknowledgment | Table-side call staff, two-way acknowledgment flow, branch isolation, 60s cooldown, note length restrictions |
| 10.2 | WebSocket Room Security & Multi-Branch Isolation | JWT Bearer handshake auth, hierarchical room isolation, guest room isolation, clean room exit on branch switch |
| 10.3 | Domain Events Matrix Across 7 Realtime Groups | Standardized matrix across 7 operational event groups (New Order, Order Updated, Item Status, Table Status, Call Staff, Payment, 86 Stockout) |
| 10.4 | Frontend SDK Contract & Client Resilience | Call staff SDK client methods (SDK-30/31/32), Reconnection Backoff with Jitter, CANONICAL_EVENT_MAP deduplication, FIFO 50 buffer |
| 10.5 | Multi-Tab Browser E2E Ecosystem | Real browser Puppeteer multi-tab test: Customer calls staff $\rightarrow$ Admin Header audio badge zero reload; Order $\rightarrow$ KDS $\rightarrow$ POS $\rightarrow$ Bill |
| 10.6 | Realtime Adversarial Hardening (AUD-10.1–10.6) | Full audit hardening: Table-level cooldown, dynamic room cleanup, guest isolation, FIFO capping, double chime block, jitter backoff |

### Known Limitations & Architecture Boundaries

- **Hardware thermal printer**: Provides industrial-grade ESC/POS 80mm/58mm binary compilation (buffer Uint8Array, base64, hex) and CSS `@media print` layout at `/bills`. WebUSB/WebSerial or local Print Bridge hardware agents connect directly to the standardized payloads generated by `thermalPrinterService`.
- **Redis Pub/Sub & multi-node distributed messaging**: The current realtime system uses EventEmitter2 + Socket.IO on a single process combined with `BroadcastChannel` for browsers. Multi-node distributed messaging via Redis/Kafka is planned for large-scale horizontal clustering in future expansions.

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
| | `GET` | `/api/tables/public/by-restaurant/:restaurantSlug` | Public table discovery with active QR tokens | Public |
| | `POST` | `/api/tables/:tableId/call-staff` | Diner table request to call staff / assistance | Public (Requires QR/Slug) |
| | `POST` | `/api/tables/:tableId/acknowledge-call` | Staff acknowledges table assistance request | POS.VIEW (perm-pos-view) |
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
| | `POST` | `/api/orders/customer/:id/request-payment` | Customer requests payment via QR | Public |
| | `GET` | `/api/orders/customer/:id/vietqr` | Fetch dynamic server-calculated VietQR | Public |
| | `GET` | `/api/orders/customer/:id/receipt` | Customer electronic receipt view | Public |
| | `GET` | `/api/orders/customer/:id/download-bill` | Customer digital bill download (24h token) | Public (receiptAccessToken) |
| | `POST` | `/api/orders/:id/complete-payment` | Natural idempotent settlement & table release | POS.CONFIRM (perm-pos-pay) |
| **Reviews & CSAT** | `POST` | `/api/reviews/customer` | Customer meal quality review submission (Atomic CAS 1x) | Public (QR / Token) |
| | `GET` | `/api/reviews/customer/by-order/:orderId` | Customer review lookup by order | Public (QR / Token) |
| | `GET` | `/api/reviews` | Paginated reviews list with branch & rating filters | REVIEW.VIEW (perm-review-view) |
| | `GET` | `/api/reviews/summary` | Overall CSAT KPIs & multi-branch analytics breakdown | REVIEW.VIEW (perm-review-view) |
| | `POST` | `/api/reviews/:id/reply` | Staff response to customer review | REVIEW.REPLY (perm-review-reply) |
| | `PATCH` | `/api/reviews/:id/toggle-hidden` | Moderation toggle review visibility | RESTAURANT.ADMIN (Restaurant Owner) |
| **Bills & Invoicing** | `GET` | `/api/bills` | List generated bills (filters, search, pagination) | BILL.VIEW (perm-pos-pay) |
| | `GET` | `/api/bills/:id` | View bill details by Bill ID | BILL.VIEW (perm-pos-pay) |
| | `GET` | `/api/bills/by-order/:orderId` | View bill details by Order ID | BILL.VIEW (perm-pos-pay) |
| | `POST` | `/api/bills/:id/print` | Track bill print count | BILL.PRINT (perm-pos-pay) |
| **Audit Logs** | `GET` | `/api/activity-logs` | Query financial audit log history | SETTING.VIEW |
| **Kitchen / KDS** | `GET` | `/api/kitchen/orders` | Active order queue for KDS (FIFO ordered) | KITCHEN.VIEW |
| | `GET` | `/api/kitchen/items-summary` | Summary of waiting & cooking items by branch | KITCHEN.VIEW |
| | `GET` | `/api/kitchen/menu-items` | Dish list with per-branch stockout status | KITCHEN.VIEW |
| | `PATCH` | `/api/kitchen/menu-items/:id/availability` | Kitchen 86 stockout toggle per branch | KITCHEN.UPDATE (perm-kds-out) |
| | `POST` | `/api/order-items/:id/start-cooking` | Start cooking order item (Cooking) | KITCHEN.UPDATE (perm-kds-cook) |
| | `POST` | `/api/order-items/:id/mark-ready` | Mark order item cooked (Ready) | KITCHEN.UPDATE (perm-kds-cook) |
| | `POST` | `/api/order-items/:id/mark-served` | Mark order item delivered to table (Served) | KITCHEN.UPDATE (perm-kds-cook) |
| | `POST` | `/api/orders/:id/kitchen/batch-update` | Batch update items by round or order | KITCHEN.UPDATE (perm-kds-cook) |
| **Dashboard** | `GET` | `/api/dashboard/overview` | Realtime KPI overview indicators (Dual-Key) | REPORT.VIEW / DASHBOARD.VIEW / POS.VIEW |
| **Reports & Analytics** | `GET` | `/api/reports/revenue` | Period revenue report & payment breakdown | REPORT.VIEW |
| | `GET` | `/api/reports/top-items` | Top selling dishes ranking & options delta | REPORT.VIEW |
| | `GET` | `/api/reports/export` | UTF-8 BOM CSV export for Microsoft Excel | REPORT.EXPORT (perm-rep-export) |

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

The iMenu test ecosystem comprises **643 comprehensive automated tests** (with automatic fixture teardown and zero database residue), covering the full scope from Phase 2 through Phase 10.

### Master Test Orchestrator

```bash
# Phase 10: Developer Test Run (82 automated tests across Backend & SDK)
npm run test:phase10:all

# Phase 10: Final Acceptance Run (85 mandatory tests: 0 FAIL, 0 SKIP, 0 BLOCKED)
npm run test:phase10:acceptance
```

### Per-Phase Test Commands (Regression)

```bash
# Phase 2: Auth, Restaurant & Multi-Branch (23 tests)
npm run test:phase2:all

# Phase 3: Staff RBAC, Roles & Branches (16 tests)
npm run test:phase3

# Phase 4: Menu, Toppings & Branch Price Overrides (17 tests)
npm run test:phase4

# Phase 5: Tables, Orders & Realtime KDS WebSocket (18 tests)
npm run test:phase5

# Full Phase 2–5 Regression Suite (74 tests):
npm run test:regression:phase2-5

# Phase 6: Order & POS (279 tests):
npm run test:phase6:all

# Phase 7: Kitchen / KDS (50 tests):
npm run test:phase7:all

# Phase 8: Payment & Bill (98 tests):
npm run test:phase8:all

# Phase 9: Dashboard & Reports (57 tests):
npm run test:phase9:all

# Phase 10: Realtime & Ecosystem (85 tests):
npm run test:phase10:all

# Phase 11: Review & Digital Bill (67 tests):
npm run test:phase11:all
```

### Phase 11 Test Commands (Review & Digital Bill)

```bash
# Run all 3 backend suites sequentially (27 tests):
npm run test:phase11

# Run individual sub-phase suites:
npm run test:phase11:submission # Suite 1: Customer Review Submission & Atomic CAS (11 tests)
npm run test:phase11:isolation  # Suite 2: Branch Isolation & Moderation RBAC (9 tests)
npm run test:phase11:bill       # Suite 3: Digital Bill Access Token & 24h Expiration (7 tests)

# Run full master acceptance Phase 11 (67 tests):
npm run test:phase11:acceptance
```

### 710-Test Ecosystem Reconciliation Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│  IMENU TEST ECOSYSTEM — 710 VERIFIED AUTOMATED TEST CASES                │
├────────────────────────────────┬──────────────────────┬────────────────┤
│ Test Group                      │ Source Location       │ Test Count     │
├────────────────────────────────┼──────────────────────┼────────────────┤
│ 1. Phase 11 Review & Bill      │ tests/phase-11-revie │ 67 (100% PASS) │
│ 2. Phase 10 Realtime & Ecosyst │ tests/phase-10-realt │ 85             │
│ 3. Phase 9 Dashboard & Reports │ tests/phase-09-dashb │ 57             │
│ 4. Phase 8 Payment & Bill      │ tests/phase-08-payme │ 98             │
│ 5. Phase 7 Kitchen / KDS       │ tests/phase-07-kitch │ 50             │
│ 6. Phase 6 Orders & POS        │ tests/phase-06-order │ 279            │
│ 7. Phases 2–5 Regression       │ tests/phase-02..05   │ 74             │
├────────────────────────────────┴──────────────────────┼────────────────┤
│ TOTAL ECOSYSTEM (FULL ROADMAP ACCEPTANCE REQUIREMENT)  │ 710 TESTS      │
│  - Passed in Developer/CI Run:                         │ 710 / 710 PASS │
│  - Adversarial Hardening & Regression:                 │ 0 FAIL, 0 BLOCK│
│  - Full 15-Phase Roadmap Acceptance Status:            │ ✅ 15/15 PHASES│
└───────────────────────────────────────────────────────┴────────────────┘
```

### Detailed Test Documentation

- **Master test index:** [tests/README.md](tests/README.md) (Vietnamese) | [tests/README_en.md](tests/README_en.md) (English)
- **Phase 15 detailed documentation:** [tests/phase-15-superadmin-completion/README.md](tests/phase-15-superadmin-completion/README.md) (Vietnamese) | [tests/phase-15-superadmin-completion/README_en.md](tests/phase-15-superadmin-completion/README_en.md) (English)
- **Phase 14 detailed documentation:** [tests/phase-14-superadmin-ux-secret-zero-docs/README.md](tests/phase-14-superadmin-ux-secret-zero-docs/README.md) (Vietnamese) | [tests/phase-14-superadmin-ux-secret-zero-docs/README_en.md](tests/phase-14-superadmin-ux-secret-zero-docs/README_en.md) (English)
- **Phase 11 detailed documentation:** [tests/phase-11-review-digital-bill/README.md](tests/phase-11-review-digital-bill/README.md) (Vietnamese) | [tests/phase-11-review-digital-bill/README_en.md](tests/phase-11-review-digital-bill/README_en.md) (English)
- **Phase 10 detailed documentation:** [tests/phase-10-realtime/README.md](tests/phase-10-realtime/README.md) (Vietnamese) | [tests/phase-10-realtime/README_en.md](tests/phase-10-realtime/README_en.md) (English)
- **Phase 9 detailed documentation:** [tests/phase-09-dashboard-reports/README.md](tests/phase-09-dashboard-reports/README.md) (Vietnamese) | [tests/phase-09-dashboard-reports/README_en.md](tests/phase-09-dashboard-reports/README_en.md) (English)
- **Phase 8 detailed documentation:** [tests/phase-08-payment-bill/README.md](tests/phase-08-payment-bill/README.md) (Vietnamese) | [tests/phase-08-payment-bill/README_en.md](tests/phase-08-payment-bill/README_en.md) (English)
- **Phase 7 detailed documentation:** [tests/phase-07-kitchen-kds/README.md](tests/phase-07-kitchen-kds/README.md) (Vietnamese) | [tests/phase-07-kitchen-kds/README_en.md](tests/phase-07-kitchen-kds/README_en.md) (English)
- **Phase 6 detailed documentation:** [tests/phase-06-order-pos/README.md](tests/phase-06-order-pos/README.md) (Vietnamese) | [tests/phase-06-order-pos/README_en.md](tests/phase-06-order-pos/README_en.md) (English)

---

## 11. 📊 Project Status & Acceptance

### Full Project Status: ✅ ACCEPTED — FULL 15/15 PHASES ROADMAP COMPLETED

Phase 15 (Superadmin Completion, Support Impersonation Mode & Multi-Role RBAC Synchronization) has completed all technical pillars and has been officially accepted. The full 15-Phase roadmap of the iMenu ecosystem is 100% complete.

### Phase 15: Superadmin Completion, Impersonation Support Mode & Multi-Role RBAC Sync
- **4 Dedicated Platform Management Modules (`/platform/*`)**: Real-time KPI dashboard tracking dual revenue streams, Restaurant Lifecycle Management (suspension, reactivation with `$unset`, plan extensions/upgrades with custom expiration and audit notes), Dual-Revenue reconciliation by custom date ranges (From Date - To Date), Sales Rep administration with interactive policy modals, candidate application approvals, and atomic commission payout batches.
- **Superadmin Impersonation Support Mode**: Enables Superadmin to select any partner restaurant from the Header, displaying an amber Sticky Support Banner with "Exit Support", expanding Sidebar navigation to access operational `/branches` and `/settings` pages to assist owners without permission barriers.
- **Strict RBAC Boundaries & Double-Payout Prevention**: Enforces 100% privilege boundary isolation between Superadmin, Sales Reps, Restaurant Owners, and Staff; immediate token revocation for staff of suspended restaurants; atomic conditional updates guaranteeing zero double payouts.
- **Strict Secret-Zero Compliance**: All test credentials and secrets dynamically resolved at runtime from the environment.

### Phase 14: Superadmin Workspace Purification, Zero Test-Password Leakage & Docs Sync
- **100% Superadmin Workspace Isolation (Platform Control Center)**: Completely hides all store-scoped routes (`/tables`, `/pos`, `/kitchen`, `/bills`, `/menu`, `/qr-codes`, `/reviews`, `/branches`, `/settings`, `/sales/*`), hides branch switcher, hides store open/close toggle, mutes store and kitchen chimes, enforces instant redirect to `/platform/dashboard` via RouteAccessGuard.
- **Zero Static Test-Password Leakage & Secret Scanning Guard (AUD-14.1)**: Permanently eradicated all hardcoded static password literals and sensitive strings across all codebases, tests, configs, and `.env.example`; backed by dynamic runtime Base64 credential helpers.
- **Platform RBAC & Security Hardening (AUD-14.2 to AUD-14.4)**: Strictly enforces SuperAdminGuard on `/api/platform/*`, rejecting store staff tokens (403 Forbidden) and eliminating accidental cross-scope operations.
- **Master README Synchronization (AUD-14.5)**: Full bilingual synchronization across all 6 documentation files, test reconciliation matrix, and `test:phase14` scripts.

### Phase 13: Superadmin Platform Control Center & Enterprise Governance
- **Platform Management Modules (`/api/platform/*`)**: Multi-restaurant partner catalog, tenant activation/suspension toggles, multi-channel GMV analytics across 4 payment methods.
- **Sales Rep Management & Bulk Payouts**: Sales rep roster administration, accumulated commission audit, and batch payouts protected with CAS atomic idempotency locks.
- **Adversarial Hardening (AUD-13.1 to AUD-13.6)**: SuperAdminGuard, Composite Rate Limiter (IP + Email) mitigating brute force attacks without impacting colleagues sharing office Wi-Fi.

### Phase 12: Sales Partner Network & Multi-tier Commission Engine
- **iMenu Business Partner Portal (`/sales/*`)**: Referral code generation, tracking links, automated restaurant onboarding attribution.
- **Automated Commission Ledger (`commission_ledgers`)**: Real-time 5% GMV commission computation on bill settlement, standardized `COM-` idempotent transaction codes.

**Full Ecosystem Acceptance Results:**

| Test Group | Test Count | Result |
| :--- | :---: | :---: |
| Phase 15 Superadmin Completion & RBAC Sync | 75 | ✅ PASS |
| Phase 14 Superadmin Purification & Zero Secrets | 10 | ✅ PASS |
| Phase 13 Superadmin Platform Control Center | 28 | ✅ PASS |
| Phase 12 Sales Affiliate & Commission Engine | 26 | ✅ PASS |
| Phase 11 Review & Digital Bill (4 suites) | 67 | ✅ PASS |
| Phase 10 Realtime & Ecosystem Full Regression | 85 | ✅ PASS |
| Phase 9 Dashboard & Reports Full Regression | 57 | ✅ PASS |
| Phase 8 Payment & Bill Full Regression | 98 | ✅ PASS |
| Phase 7 Kitchen / KDS Full Regression | 50 | ✅ PASS |
| Phase 6 Orders & POS Full Regression | 279 | ✅ PASS |
| Phases 2–5 Core Regressions | 74 | ✅ PASS |
| **TOTAL ECOSYSTEM** | **849** | **849/849 PASS (100%)** |

- **FAIL:** 0
- **SKIP:** 0
- **BLOCKED:** 0

### Overall 15/15 Phases Roadmap

| Phase | Status |
| :--- | :--- |
| Phase 1: Foundation API & Security | ✅ Completed |
| Phase 2: Multi-Restaurant & Branch Lifecycle | ✅ Completed |
| Phase 3: Staff RBAC & Branch Transfers | ✅ Completed |
| Phase 4: Menu Engineering & Toppings | ✅ Completed |
| Phase 5: Orders, POS & Realtime KDS | ✅ Completed |
| Phase 6: Order Operations & POS | ✅ Accepted & Officially Closed |
| Phase 7: Kitchen Display System (KDS) | ✅ Accepted & Officially Closed |
| Phase 8: Payment, Bill & Financial Audit | ✅ Accepted & Officially Closed |
| Phase 9: Dashboard, Revenue Reports & UI/UX Overhaul | ✅ Accepted & Officially Closed |
| Phase 10: Realtime WebSocket Gateway, Room Security & Ecosystem Finalization | ✅ Accepted & Officially Closed |
| Phase 11: Customer Review Per Branch & Digital Bill Download | ✅ Accepted & Officially Closed |
| Phase 12: Sales Partner Network (Sales Rep) & Affiliate Engine | ✅ Accepted & Officially Closed |
| Phase 13: Superadmin Platform Control Center & Enterprise Governance | ✅ Accepted & Officially Closed |
| Phase 14: Superadmin Workspace Purification, Zero Test-Password Leakage & Docs Sync | ✅ Accepted & Officially Closed |
| Phase 15: Superadmin Completion, Impersonation Support Mode & Multi-Role RBAC Sync | ✅ **ACCEPTED & FULL ROADMAP COMPLETED (15/15 PHASES)** |
