# 🧪 Phase 18 Test Documentation (Sub-phase 18.1): Backend MCP Core & 4 Read-Only Platform Tools

> **Languages:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Project:** iMenu API (`imenu-api`)  
> **Phase:** Phase 18 — AI Agent & Model Context Protocol (MCP)  
> **Sub-phase:** Sub-phase 18.1 — Backend MCP Core & 4 Read-Only Platform Tools  
> **Status:** ✅ **ACCEPTED — REGRESSION PASS (7/7 TEST SUITES PASS - 100%)**

---

## 1. 🎯 Objectives & Technical Focus (Sub-phase 18.1)

Sub-phase 18.1 establishes the standardized Model Context Protocol (MCP) Core at the `imenu-api` Backend, providing a secure, structured bridge for AI Agents and Superadmins to interact safely with iMenu platform-wide operations data:

1. **MCP Core Registry Architecture (`mcp-registry.service.ts`)**:
   - Manages MCP Tools registry with standardized JSON Schema authorization metadata: `name`, `description`, `scope: 'PLATFORM' | 'RESTAURANT' | 'BRANCH'`, `isReadOnly: true`, `inputSchema`, and execution `handler`.
   - **Phase 18 Safety Lock**: Activates and permits execution solely for tools scoped to `PLATFORM`. Any non-PLATFORM invocation is strictly rejected with `403 Forbidden`.
   - Strictly enforces read-only operations (`isReadOnly === true`), safeguarding database state against inadvertent mutations.

2. **Standardized Suite of 4 Read-Only Platform Tools**:
   - `get_platform_revenue_overview`: Connects `PlatformService` & `ReportsService` to consolidate platform GMV, SaaS subscription revenue, 30-day period-over-period growth rate, and top revenue-generating restaurants.
   - `detect_restaurant_churn_risk`: Scans active restaurants experiencing significant order drops (>40% over the last 7-14 days) or approaching subscription expiration (within 7 days), generating churn risk alerts with direct deep-links to `/platform/restaurants`.
   - `diagnose_underperforming_restaurants`: Connects `ReportsService` & `ReviewsService` to diagnose operational bottlenecks (KDS kitchen cancellation rates, prep delays, or 1-2 star CSAT reviews).
   - `audit_sales_commissions_anomalies`: Connects `SalesService` & `ActivityLogService` to review the `commission-ledger`, detecting suspicious Sales Rep activities (ghost restaurants with zero real orders / 0 GMV or duplicated commission entries).

3. **Multi-tier Security & RBAC Enforcement (Privilege Boundary)**:
   - All `/api/platform/mcp/*` endpoints are protected by `JwtAuthGuard` and `SuperAdminGuard`.
   - Unauthenticated requests are blocked with `401 Unauthorized`.
   - Merchant (`restaurant_admin`), Cashier (`cashier`), and Waiter (`waiter`) roles are blocked with `403 Forbidden`.

4. **Zero-Bloat & Zero-Secret Architecture**:
   - Responses are formatted as lean JSON structures, stripping Mongoose internal documents (`_doc`, `$__`) to prevent Out-Of-Memory (OOM) errors.
   - Zero hardcoded secrets/passwords across source code and test files, complying 100% with `secret-scanning-guard.test.ts`.

---

## 2. 📁 Folder Structure

```text
src/modules/ai-mcp/
├── interfaces/
│   └── mcp-tool.interface.ts          # MCP Tool and execution response data types
├── dto/
│   └── execute-mcp-tool.dto.ts        # DTO for validating MCP Tool invocation payloads
├── tools/
│   └── platform-mcp.tools.ts          # 4 standardized Read-Only Platform MCP Tools
├── mcp-registry.service.ts            # Registry managing metadata and dispatching tools
├── ai-mcp.controller.ts               # RESTful API Controller secured by SuperAdminGuard
└── ai-mcp.module.ts                   # NestJS module packaging AI-MCP services

tests/phase-18-superadmin-mcp/
├── README.md                          # Detailed test documentation in Vietnamese
├── README_en.md                       # Detailed test documentation in English
└── mcp-registry-and-tools.test.ts     # Automated 7-test suite for Phase 18
```

---

## 3. 🧪 Test Matrix & Verification (7/7 PASS)

Test file: `tests/phase-18-superadmin-mcp/mcp-registry-and-tools.test.ts` (Port `3181`):

| # | Test Scenario | Acceptance Criteria | Result |
| :---: | :--- | :--- | :---: |
| **TEST 1** | Register 4 MCP Platform Tools | Verify registry loads 4 tools with `scope: 'PLATFORM'`, `isReadOnly: true`, and valid `inputSchema` | ✅ **PASS** |
| **TEST 2** | `get_platform_revenue_overview` | Verify platform GMV, SaaS revenue, growth rate, and top restaurants returned in lean JSON format | ✅ **PASS** |
| **TEST 3** | `detect_restaurant_churn_risk` | Verify detection of >40% order drop and expiring subscriptions with deep link `/platform/restaurants` | ✅ **PASS** |
| **TEST 4** | `diagnose_underperforming_restaurants` | Verify operational diagnostics on KDS item cancellations and negative 1-2 star CSAT reviews | ✅ **PASS** |
| **TEST 5** | `audit_sales_commissions_anomalies` | Verify detection of ghost restaurants (0 orders, 0 GMV) and duplicate commission ledger entries | ✅ **PASS** |
| **TEST 6** | Security & RBAC Enforcement | Verify blocking with `401 Unauthorized` (no token), `403 Forbidden` (Merchant, Staff), and `200 OK` for SuperAdmin | ✅ **PASS** |
| **TEST 7** | Registry Hardening & Boundaries | Verify `404 Not Found` for non-existent tools and `403 Forbidden` for non-PLATFORM scopes | ✅ **PASS** |

---

## 4. ⚡ Execution Commands

```powershell
# Run automated Phase 18 test suite:
npm run test:phase18

# Run directly via ts-node:
npx ts-node tests/phase-18-superadmin-mcp/mcp-registry-and-tools.test.ts

# Verify Zero Static Secret leakage:
npm run test:phase14:secrets

# Verify Master README documentation integrity:
npm run test:phase14:docs
```

