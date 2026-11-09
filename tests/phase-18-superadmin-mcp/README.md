# 🧪 Hướng Dẫn Kiểm Thử Phase 18: Backend MCP Core, 4 Read-Only Platform Tools & AI Orchestrator

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Dự án:** iMenu API (`imenu-api`)  
> **Giai đoạn:** Phase 18 — Trí tuệ Nhân tạo & Giao thức Bối cảnh Mô hình (AI Agent & Model Context Protocol)  
> **Phân hệ:** Sub-phase 18.1 & Sub-phase 18.2 — MCP Core, Platform Tools, AI Orchestrator, Deterministic Fallback & Audit Trail  
> **Trạng thái:** ✅ **ĐÃ NGHIỆM THU — REGRESSION PASS (15/15 TEST CASES PASS - 100%)**

---

## 1. 🎯 Mục Tiêu & Trọng Tâm Kỹ Thuật

Phase 18 thiết lập nền tảng tích hợp trí tuệ nhân tạo (AI Orchestrator) và giao thức Model Context Protocol (MCP) chuẩn hóa tại Backend `imenu-api`, cho phép SuperAdmin và AI Agents tương tác, truy vấn thông minh và nhận báo cáo điều hành toàn sàn theo thời gian thực:

### 1.1. Sub-phase 18.1: MCP Core Registry & 4 Read-Only Platform Tools
1. **Kiến Trúc MCP Registry (`mcp-registry.service.ts`)**:
   - Quản lý danh mục MCP Tools kèm metadata chuẩn JSON Schema: `name`, `description`, `scope: 'PLATFORM' | 'RESTAURANT' | 'BRANCH'`, `isReadOnly: true`, `inputSchema`, và hàm `handler`.
   - **Khóa an toàn Phase 18**: Chỉ kích hoạt và cho phép thực thi các công cụ có `scope: 'PLATFORM'`. Cưỡng chế quy tắc chỉ đọc (`isReadOnly === true`).
2. **Bộ 4 MCP Platform Tools Chuẩn Hóa**:
   - `get_platform_revenue_overview`: Tổng hợp GMV toàn sàn, doanh thu gói cước Subscription SaaS, tốc độ tăng trưởng và danh sách Top nhà hàng đóng góp doanh thu lớn nhất.
   - `detect_restaurant_churn_risk`: Quét các nhà hàng `ACTIVE` có dấu hiệu sụt giảm đơn hàng nghiêm trọng (>40% trong 7-14 ngày) hoặc sắp hết hạn gói cước Subscription để cảnh báo rủi ro rời bỏ kèm liên kết điều hướng `/platform/restaurants`.
   - `diagnose_underperforming_restaurants`: Phân tích nguyên nhân nhà hàng có doanh thu thấp (tỷ lệ hủy món KDS, thời gian chế biến, đánh giá CSAT 1-2 sao).
   - `audit_sales_commissions_anomalies`: Rà soát bảng kê hoa hồng `commission-ledger`, phát hiện các Sales Rep có dấu hiệu bất thường (nhà hàng ma không phát sinh đơn thật - 0 GMV).

### 1.2. Sub-phase 18.2: AI Orchestrator, Deterministic Fallback & Audit Trail
1. **Tầng Điều Phối Thông Minh (`ai-orchestrator.service.ts`)**:
   - Phân tích câu hỏi tự nhiên hoặc mã `promptChipId` (VD: `REVENUE_OVERVIEW`, `CHURN_RISK`, `COMMISSION_AUDIT`, `UNDERPERFORMING_DIAGNOSE`) để tự động kích hoạt 1 hoặc nhiều MCP Tools tương ứng.
2. **Cơ Chế Deterministic Rule-based Fallback (Bắt buộc)**:
   - Khi môi trường kiểm thử/CI hoặc local không có `AI_API_KEY` (hoặc `AI_MCP_PROVIDER=deterministic`), hệ thống tự động tổng hợp câu trả lời dựa trên dữ liệu thật từ các MCP Tools với cấu trúc chuẩn:
     - `summaryMarkdown`: Văn bản Markdown súc tích, định dạng số tiền VND, bảng danh sách nổi bật và khuyến nghị hành động.
     - `kpiCards`: Danh sách thẻ chỉ số KPI nổi bật (tiêu đề, giá trị, độ biến động, trạng thái `positive` / `negative` / `warning`).
     - `toolCallsExecuted`: Nhật ký các MCP Tools đã thực thi kèm thời gian phản hồi.
     - `actionLinks`: Liên kết điều hướng hành động trực tiếp tới các phân hệ Superadmin (`/platform/revenues`, `/platform/restaurants`, `/platform/sales`).
3. **Kết Nối LLM & Timeout Fallback**:
   - Khi có `AI_API_KEY`, kết nối LLM (Gemini / OpenAI) qua Function Calling chuẩn MCP với Timeout 10s. Nếu mạng gián đoạn hoặc quá thời gian chờ, tự động fallback 100% về chế độ Deterministic.
4. **Bảo Mật, Rate Limiting & Prompt Injection Guard**:
   - Giới hạn độ dài câu hỏi tối đa 1000 ký tự.
   - Bộ lọc phát hiện và chặn đứng Prompt Injection (`ignore instructions`, `system prompt`, `<script>`, `drop table` -> `400 Bad Request`).
   - Tích hợp `CompositeRateLimiterService` giới hạn tần suất gọi API theo `AI_RATE_LIMIT_PER_MIN` (-> `429 Too Many Requests`).
   - Bảo vệ nghiêm ngặt bằng cặp Guard: `JwtAuthGuard` và `SuperAdminGuard` (chặn `401` khi thiếu token, chặn `403` với Merchant và Staff).
5. **Kiểm Toán Audit Trail Toàn Diện**:
   - Ghi nhận sự kiện `SUPERADMIN_MCP_INSIGHT_QUERY` vào bộ sưu tập `activity_logs` trong MongoDB (lưu trữ userId, prompt, promptChipId, danh sách MCP Tools đã gọi, thời gian phản hồi).

---

## 2. 📁 Cấu Trúc Thư Mục Triển Khai

```text
src/modules/ai-mcp/
├── dto/
│   ├── ai-query.dto.ts                # DTO xác thực truy vấn AI Prompt & Chip ID
│   └── execute-mcp-tool.dto.ts        # DTO xác thực payload gọi trực tiếp MCP Tool
├── interfaces/
│   └── mcp-tool.interface.ts          # Interface chuẩn MCP Tool & Execution Response
├── services/
│   └── ai-orchestrator.service.ts     # Bộ điều phối AI, Deterministic Fallback & Audit Log
├── tools/
│   └── platform-mcp.tools.ts          # 4 công cụ MCP Platform chỉ đọc
├── ai-mcp.controller.ts               # Controller RESTful ('/platform/mcp' & '/platform/ai-mcp')
├── ai-mcp.module.ts                   # Module NestJS đóng gói dịch vụ AI-MCP
└── mcp-registry.service.ts            # Registry quản lý và kiểm soát quyền MCP Tools

tests/phase-18-superadmin-mcp/
├── README.md                          # Tài liệu hướng dẫn Tiếng Việt
├── README_en.md                       # Test documentation in English
├── mcp-registry-and-tools.test.ts     # Suite 1: MCP Core & 4 Read-Only Platform Tools (7 tests)
├── ai-orchestrator-and-security.test.ts # Suite 2: AI Orchestrator, Fallback & Security (8 tests)
└── run-all-phase18.ts                 # Master Test Runner điều phối toàn bộ Phase 18
```

---

## 3. 🌐 Đặc Tả API Endpoints

| Phương Thức | Đường Dẫn API | Phân Quyền | Chức Năng |
| :---: | :--- | :---: | :--- |
| `POST` | `/api/platform/ai-mcp/query` | SuperAdmin | Truy vấn AI thông minh kết hợp Function Calling & Fallback |
| `GET` | `/api/platform/ai-mcp/tools` | SuperAdmin | Danh sách công cụ MCP nền tảng chuẩn hóa |
| `GET` | `/api/platform/mcp/tools/:name` | SuperAdmin | Lấy chi tiết schema và metadata của 1 tool cụ thể |
| `POST` | `/api/platform/mcp/execute` | SuperAdmin | Thực thi trực tiếp 1 MCP tool nền tảng (Read-Only) |

### Cấu Trúc Payload `POST /api/platform/ai-mcp/query`:
```json
{
  "prompt": "Tổng quan doanh thu sàn và GMV tháng này thế nào?",
  "promptChipId": "REVENUE_OVERVIEW"
}
```

### Cấu Trúc Phản Hồi Chuẩn:
```json
{
  "success": true,
  "mode": "DETERMINISTIC_FALLBACK",
  "provider": "deterministic",
  "query": "Tổng quan doanh thu sàn và GMV tháng này thế nào?",
  "promptChipId": "REVENUE_OVERVIEW",
  "summaryMarkdown": "### 📊 Báo Cáo Tổng Quan Doanh Thu & GMV Nền Tảng\n...",
  "kpiCards": [
    { "title": "Tổng GMV Nền Tảng", "value": "12.400.000 đ", "change": "+15% so với kỳ trước", "status": "positive" },
    { "title": "Doanh Thu Subscription", "value": "4.800.000 đ", "change": "+20%", "status": "positive" },
    { "title": "Đơn Hàng Hoàn Tất", "value": "120", "change": "135 tổng đơn", "status": "neutral" }
  ],
  "toolCallsExecuted": [
    { "tool": "get_platform_revenue_overview", "arguments": {}, "durationMs": 18, "success": true }
  ],
  "actionLinks": [
    { "label": "Xem Báo Cáo Doanh Thu Nền Tảng", "url": "/platform/revenues", "type": "primary" },
    { "label": "Quản Lý Danh Sách Nhà Hàng", "url": "/platform/restaurants", "type": "secondary" }
  ],
  "responseTimeMs": 35
}
```

---

## 4. ⚙️ Cấu Hình Biến Môi Trường (.env)

| Tên Biến | Mặc Định | Mô Tả |
| :--- | :--- | :--- |
| `AI_MCP_PROVIDER` | `deterministic` | Provider AI (`deterministic`, `gemini`, `openai`) |
| `AI_API_KEY` | *(trống)* | API Key dịch vụ AI bên ngoài (để trống khi chạy CI/Test) |
| `AI_MODEL_NAME` | `gemini-1.5-flash` | Tên model LLM khi kết nối cloud provider |
| `AI_RATE_LIMIT_PER_MIN` | `20` | Giới hạn số lượng truy vấn AI tối đa trong 1 phút |

---

## 5. 🧪 Ma Trận Kịch Bản Kiểm Thử (15/15 PASS)

### Suite 1: `mcp-registry-and-tools.test.ts` (Port 3181 - 7 Tests)
- **TEST 1**: Đăng ký 4 MCP Platform Tools (scope: `PLATFORM`, `isReadOnly: true`, JSON Schema).
- **TEST 2**: Thực thi `get_platform_revenue_overview` trả về GMV, SaaS, Top nhà hàng tinh gọn.
- **TEST 3**: Thực thi `detect_restaurant_churn_risk` phát hiện quán rủi ro rời bỏ và link điều hướng.
- **TEST 4**: Thực thi `diagnose_underperforming_restaurants` phân tích tỷ lệ hủy đơn & đánh giá thấp.
- **TEST 5**: Thực thi `audit_sales_commissions_anomalies` phát hiện dấu hiệu bất thường nhà hàng ma.
- **TEST 6**: Phân quyền RBAC chặn `401 Unauthorized` và `403 Forbidden` đối với Merchant/Staff.
- **TEST 7**: Khóa cứng Registry chặn các tool ngoài scope và trả về `404` khi tool không tồn tại.

### Suite 2: `ai-orchestrator-and-security.test.ts` (Port 3182 - 8 Tests)
- **TEST 1**: AI Query phân tích Doanh thu sàn (`REVENUE_OVERVIEW`) -> KPI cards, summary, link `/platform/revenues`.
- **TEST 2**: AI Query phát hiện rủi ro rời bỏ (`CHURN_RISK`) -> churn risk alerts, link `/platform/restaurants`.
- **TEST 3**: AI Query kiểm toán hoa hồng Sales Rep (`COMMISSION_AUDIT`) -> anomalies, link `/platform/sales`.
- **TEST 4**: Tự động nhận diện ý định và điều phối MCP Tool qua từ khóa Prompt không cần chip ID.
- **TEST 5**: Prompt Security Guard chặn prompt >1000 ký tự và phát hiện Prompt Injection (HTTP 400).
- **TEST 6**: Xác nhận bản ghi Audit Log `SUPERADMIN_MCP_INSIGHT_QUERY` lưu thành công vào MongoDB `activity_logs`.
- **TEST 7**: Rate Limiting Guard kích hoạt chặn dồn dập (HTTP 429 Too Many Requests).
- **TEST 8**: RBAC Guard cách ly tuyệt đối: chặn 401 không token, chặn 403 Merchant/Staff, cho phép SuperAdmin.

---

## 6. ⚡ Hướng Dẫn Chạy Kiểm Thử

```powershell
# 1. Chạy toàn bộ 15 kịch bản Phase 18 qua Master Runner:
npm run test:phase18

# 2. Chạy riêng từng sub-phase:
npm run test:phase18:mcp            # Sub-phase 18.1
npm run test:phase18:orchestrator   # Sub-phase 18.2

# 3. Chạy rà quét bảo mật không rò rỉ Secret (Zero-Secret Hardcoding):
npm run test:phase14:secrets

# 4. Chạy kiểm tra tính toàn vẹn tài liệu Master READMEs:
npm run test:phase14:docs
```
