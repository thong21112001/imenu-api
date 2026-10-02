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
5. [Key Feature Highlights (Phase 1 to Phase 5)](#5-key-feature-highlights-phase-1-to-phase-5)
6. [Real-time WebSocket Kitchen Display System (KDS) Hub](#6-real-time-websocket-kitchen-display-system-kds-hub)
7. [Table Lifecycle & Multi-Branch QR Code Generation](#7-table-lifecycle--multi-branch-qr-code-generation)
8. [Core API Endpoints Reference](#8-core-api-endpoints-reference)
9. [Local Installation & Development](#9-local-installation--development)
10. [Automated Testing Suites](#10-automated-testing-suites)

---

## 1. 📖 Overview & Business Scope

**iMenu API** is a high-performance backend system built on **NestJS 11** and **MongoDB (Mongoose)**, powering the entire digital operations of modern restaurant and chain dining establishments:
- **Diners (Customers)**: Scan per-table QR codes to browse dynamic digital menus isolated by branch, customize options and toppings, place orders instantly, request bill settlement, or chime staff.
- **Cashiers / POS Terminal**: Manage table maps visually, execute quick counter orders, transfer/merge tables, apply discounts/taxes, and settle orders automatically via VietQR.
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

## 5. 🚀 Key Feature Highlights (Phase 1 to Phase 5)

- **Phase 1: Foundation & Security**: Modular NestJS setup, JWT Auth, Swagger `/api-docs`, Winston logging, MongoDB schemas.
- **Phase 2: Multi-Restaurant & Branch Lifecycle**: Auto-provisioned main branch, temporary closing/re-opening hours, independent VietQR banking and phone numbers per branch, accounting protection (disallow physical deletion of branches with historical orders).
- **Phase 3: Staff RBAC & Branch Transfers**: User locking/unlocking, staff branch transfers, protection of system default roles.
- **Phase 4: Menu Engineering & Toppings**: Category and dish CRUD, option/topping groups, per-branch price overrides, per-branch out-of-stock toggles, Vietnamese unaccented regex search (`pho bo` matches `Phở bò`), and soft-deletion.
- **Phase 5: Orders, POS, Realtime KDS & QR Lifecycle**: Interactive table maps, table transfer, table merge, POS VietQR payments, two-way WebSocket KDS updates, and dynamic per-branch table QR generation.

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
| **Table Zones** | `GET` | `/api/table-zones` | List table zones | POS.VIEW |
| | `POST` | `/api/table-zones` | Create custom zone | TABLE.UPDATE |
| **Menu** | `GET` | `/api/categories` | Public category listing | Public |
| | `GET` | `/api/menu-items` | Public menu items with branch price | Public |
| **Orders** | `POST` | `/api/orders` | Create order (POS or QR) | POS.ORDER |
| | `POST` | `/api/orders/:id/pay` | Settle bill payment | POS.CONFIRM |
| | `PATCH` | `/api/orders/:id/items/:itemId/status` | Update KDS dish status | KDS.COOK |

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

---

## 10. 🧪 Automated Testing Suites

The repository contains **73 comprehensive automated tests** (with automatic teardown and zero database residue):

```bash
# Phase 5: Orders, Tables & KDS WebSocket Test Suite (18 tests)
npm run test:phase5

# Phase 4: Menu, Toppings & Branch Price Overrides (17 tests)
npm run test:phase4

# Phase 3: Staff RBAC, Roles & Branches (16 tests)
npm run test:phase3

# Phase 2: Tenant & Branch Lifecycle (11 tests)
npm run test:phase2:all
```
