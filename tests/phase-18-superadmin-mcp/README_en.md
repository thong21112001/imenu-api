# 🧪 Phase 18 Test Documentation: Backend MCP Core, 4 Read-Only Platform Tools & AI Orchestrator

> **Language:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Project:** iMenu API (`imenu-api`)  
> **Phase:** Phase 18 — AI Agent & Model Context Protocol (MCP)  
> **Sub-phases:** Sub-phase 18.1 & Sub-phase 18.2 — MCP Core, Platform Tools, AI Orchestrator, Deterministic Fallback & Audit Trail  
> **Status:** ✅ **ACCEPTED — REGRESSION PASS (15/15 TEST CASES PASS - 100%)**

---

## 1. 🎯 Objectives & Technical Focus

Phase 18 establishes a standardized Model Context Protocol (MCP) and intelligent AI Orchestrator foundation at Backend `imenu-api`, allowing SuperAdmin and external AI Agents to securely query system data and receive executive insights in real time:

### 1.1. Sub-phase 18.1: MCP Core Registry & 4 Read-Only Platform Tools
1. **MCP Registry Architecture (`mcp-registry.service.ts`)**:
   - Manages MCP Tools registry with standardized JSON Schema metadata: `name`, `description`, `scope: 'PLATFORM' | 'RESTAURANT' | 'BRANCH'`, `isReadOnly: true`, `inputSchema`, and `handler`.
   - **Phase 18 Safety Lock**: Only activates and permits execution for tools with `scope: 'PLATFORM'`. Enforces read-only safety (`isReadOnly === true`).
2. **Four Standardized Platform Read-Only Tools**:
   - `get_platform_revenue_overview`: Aggregates platform GMV, SaaS subscription revenue, growth rate, and top contributing restaurants.
   - `detect_restaurant_churn_risk`: Scans active restaurants experiencing sharp order drops (>40% drop in 7-14 days) or expiring subscriptions, providing direct navigation link `/platform/restaurants`.
   - `diagnose_underperforming_restaurants`: Analyzes operational bottlenecks (KDS dish cancellation rate, preparation delay, negative 1-2 star CSAT reviews).
   - `audit_sales_commissions_anomalies`: Audits `commission-ledger` entries, flagging suspicious Sales Rep transactions (e.g. ghost restaurant referrals with 0 real orders).

### 1.2. Sub-phase 18.2: AI Orchestrator, Deterministic Fallback & Audit Trail
1. **Intelligent Orchestration Layer (`ai-orchestrator.service.ts`)**:
   - Analyzes natural language prompts or predefined `promptChipId` values (`REVENUE_OVERVIEW`, `CHURN_RISK`, `COMMISSION_AUDIT`, `UNDERPERFORMING_DIAGNOSE`) to dispatch matching MCP Tools.
2. **Deterministic Rule-based Fallback (Mandatory)**:
   - When running in Test/CI or local environments without `AI_API_KEY` (or `AI_MCP_PROVIDER=deterministic`), automatically synthesizes structured executive answers directly from live MCP Tool output:
     - `summaryMarkdown`: Formatted Markdown with VND currency, bullet highlights, and strategic recommendations.
     - `kpiCards`: Array of executive KPI cards (`title`, `value`, `change`, `status`: positive/negative/neutral/warning).
     - `toolCallsExecuted`: Audit list of executed MCP Tools and response latency.
     - `actionLinks`: Actionable navigation links to Superadmin modules (`/platform/revenues`, `/platform/restaurants`, `/platform/sales`).
3. **LLM Function Calling with 10s Timeout Fallback**:
   - When `AI_API_KEY` is present, connects to LLMs (Gemini / OpenAI) via function calling with an AbortController timeout of 10s. Automatically falls back to deterministic synthesizer upon any network or timeout failure.
4. **Security, Rate Limiting & Prompt Injection Guard**:
   - Strict 1000-character prompt limit.
   - Prompt injection detector patterns (`ignore instructions`, `system prompt`, `<script>`, `drop table` -> `400 Bad Request`).
   - Rate limiting via `CompositeRateLimiterService` based on `AI_RATE_LIMIT_PER_MIN` (-> `429 Too Many Requests`).
   - Dual-guard security: `JwtAuthGuard` & `SuperAdminGuard` (blocks `401` unauthorized and `403` Merchant/Staff).
5. **Comprehensive Audit Trail**:
   - Persists `SUPERADMIN_MCP_INSIGHT_QUERY` events into MongoDB `activity_logs` collection (recording userId, prompt, promptChipId, tools called, response time).

---

## 2. 📁 Directory Structure

```text
src/modules/ai-mcp/
├── dto/
│   ├── ai-query.dto.ts                # DTO for prompt validation & chip ID
│   └── execute-mcp-tool.dto.ts        # DTO for direct tool execution
├── interfaces/
│   └── mcp-tool.interface.ts          # MCP Tool and execution response interfaces
├── services/
│   └── ai-orchestrator.service.ts     # AI Orchestrator, Fallback & Audit Trail service
├── tools/
│   └── platform-mcp.tools.ts          # 4 Platform Read-Only MCP Tools
├── ai-mcp.controller.ts               # RESTful Controller ('/platform/mcp' & '/platform/ai-mcp')
├── ai-mcp.module.ts                   # NestJS Module packaging AI-MCP features
└── mcp-registry.service.ts            # MCP Tool Registry service

tests/phase-18-superadmin-mcp/
├── README.md                          # Vietnamese documentation
├── README_en.md                       # English documentation
├── mcp-registry-and-tools.test.ts     # Suite 1: MCP Core & 4 Read-Only Tools (7 tests)
├── ai-orchestrator-and-security.test.ts # Suite 2: AI Orchestrator & Security (8 tests)
└── run-all-phase18.ts                 # Master Test Runner orchestrating Phase 18
```

---

## 3. 🌐 API Endpoints Specification

| Method | Endpoint | RBAC Guard | Description |
| :---: | :--- | :---: | :--- |
| `POST` | `/api/platform/ai-mcp/query` | SuperAdmin | Intelligent AI Query with Function Calling & Deterministic Fallback |
| `GET` | `/api/platform/ai-mcp/tools` | SuperAdmin | List all standardized platform MCP Tools |
| `GET` | `/api/platform/mcp/tools/:name` | SuperAdmin | Retrieve tool schema and metadata by tool name |
| `POST` | `/api/platform/mcp/execute` | SuperAdmin | Directly execute an MCP platform tool (Read-Only) |

### Sample Request Payload (`POST /api/platform/ai-mcp/query`):
```json
{
  "prompt": "How is our platform revenue and GMV performing this month?",
  "promptChipId": "REVENUE_OVERVIEW"
}
```

### Standard JSON Response:
```json
{
  "success": true,
  "mode": "DETERMINISTIC_FALLBACK",
  "provider": "deterministic",
  "query": "How is our platform revenue and GMV performing this month?",
  "promptChipId": "REVENUE_OVERVIEW",
  "summaryMarkdown": "### 📊 Platform Revenue & GMV Executive Overview\n...",
  "kpiCards": [
    { "title": "Total Platform GMV", "value": "12,400,000 đ", "change": "+15% vs previous period", "status": "positive" },
    { "title": "Subscription SaaS Revenue", "value": "4,800,000 đ", "change": "+20%", "status": "positive" },
    { "title": "Completed Orders", "value": "120", "change": "135 total orders", "status": "neutral" }
  ],
  "toolCallsExecuted": [
    { "tool": "get_platform_revenue_overview", "arguments": {}, "durationMs": 18, "success": true }
  ],
  "actionLinks": [
    { "label": "View Platform Revenue Report", "url": "/platform/revenues", "type": "primary" },
    { "label": "Manage Restaurants", "url": "/platform/restaurants", "type": "secondary" }
  ],
  "responseTimeMs": 35
}
```

---

## 4. ⚙️ Environment Variables (.env)

| Variable Name | Default | Description |
| :--- | :--- | :--- |
| `AI_MCP_PROVIDER` | `deterministic` | Provider mode (`deterministic`, `gemini`, `openai`) |
| `AI_API_KEY` | *(empty)* | External LLM API key (leave empty for CI/Tests) |
| `AI_MODEL_NAME` | `gemini-1.5-flash` | Target LLM model name |
| `AI_RATE_LIMIT_PER_MIN` | `20` | Maximum queries allowed per minute |

---

## 5. 🧪 Test Matrix (15/15 PASS)

### Suite 1: `mcp-registry-and-tools.test.ts` (Port 3181 - 7 Tests)
- **TEST 1**: Registers 4 Platform MCP Tools (scope: `PLATFORM`, `isReadOnly: true`, JSON Schema).
- **TEST 2**: Executes `get_platform_revenue_overview` returning lean JSON GMV, SaaS, and Top restaurants.
- **TEST 3**: Executes `detect_restaurant_churn_risk` detecting churning restaurants with `/platform/restaurants` link.
- **TEST 4**: Executes `diagnose_underperforming_restaurants` analyzing KDS cancellations & low CSAT.
- **TEST 5**: Executes `audit_sales_commissions_anomalies` detecting ghost referral anomalies.
- **TEST 6**: Enforces RBAC blocking 401 Unauthorized and 403 Forbidden for Merchant/Staff.
- **TEST 7**: Registry safety bounds blocking unauthorized scopes and returning 404 for unknown tools.

### Suite 2: `ai-orchestrator-and-security.test.ts` (Port 3182 - 8 Tests)
- **TEST 1**: AI Query revenue scenario (`REVENUE_OVERVIEW`) -> KPI cards, summary markdown, `/platform/revenues`.
- **TEST 2**: AI Query churn scenario (`CHURN_RISK`) -> churn risk alerts, `/platform/restaurants`.
- **TEST 3**: AI Query sales audit scenario (`COMMISSION_AUDIT`) -> commission anomalies, `/platform/sales`.
- **TEST 4**: Intent keyword matching automatically dispatches MCP tools without prompt chip ID.
- **TEST 5**: Prompt Security Guard rejects prompts >1000 characters and blocks injection attacks (HTTP 400).
- **TEST 6**: Verifies Audit Log persistence in MongoDB collection `activity_logs` (`SUPERADMIN_MCP_INSIGHT_QUERY`).
- **TEST 7**: Rate Limiting Guard triggers on request bursts (HTTP 429 Too Many Requests).
- **TEST 8**: Strict RBAC Guard blocks unauthenticated users (401) and non-SuperAdmins (403).

---

## 6. ⚡ Test Execution Commands

```powershell
# 1. Run all 15 tests via Master Runner:
npm run test:phase18

# 2. Run individual test suites:
npm run test:phase18:mcp            # Sub-phase 18.1
npm run test:phase18:orchestrator   # Sub-phase 18.2

# 3. Verify Zero-Secret Hardcoding compliance:
npm run test:phase14:secrets

# 4. Verify Master README Documentation integrity:
npm run test:phase14:docs
```
