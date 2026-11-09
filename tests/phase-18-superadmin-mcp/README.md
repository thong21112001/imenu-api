# 🧪 Hướng Dẫn Kiểm Thử Phase 18 (Sub-phase 18.1): Backend MCP Core & 4 Read-Only Platform Tools

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Dự án:** iMenu API (`imenu-api`)  
> **Giai đoạn:** Phase 18 — Trí tuệ Nhân tạo & Giao thức Bối cảnh Mô hình (AI Agent & Model Context Protocol)  
> **Phân hệ:** Sub-phase 18.1 — Backend MCP Core & 4 Read-Only Platform Tools  
> **Trạng thái:** ✅ **ĐÃ NGHIỆM THU — REGRESSION PASS (7/7 TEST SUITES PASS - 100%)**

---

## 1. 🎯 Mục Tiêu & Trọng Tâm Kỹ Thuật (Sub-phase 18.1)

Sub-phase 18.1 triển khai nền tảng giao thức Model Context Protocol (MCP) chuẩn hóa tại Backend `imenu-api`, tạo cầu nối bảo mật giúp các hệ thống AI Agents và Superadmin tương tác an toàn với dữ liệu vận hành toàn sàn iMenu:

1. **Kiến Trúc MCP Core Registry (`mcp-registry.service.ts`)**:
   - Quản lý danh mục MCP Tools kèm metadata phân quyền chuẩn JSON Schema: `name`, `description`, `scope: 'PLATFORM' | 'RESTAURANT' | 'BRANCH'`, `isReadOnly: true`, `inputSchema`, và hàm `handler`.
   - **Khóa an toàn Phase 18**: Chỉ kích hoạt và cho phép thực thi các công cụ có `scope: 'PLATFORM'`. Các scope khác bị chặn nghiêm ngặt (`403 Forbidden`).
   - Cưỡng chế quy tắc chỉ đọc (`isReadOnly === true`), bảo vệ toàn vẹn trạng thái hệ thống.

2. **Bộ 4 MCP Platform Tools Chuẩn Hóa Chỉ Đọc (Read-Only)**:
   - `get_platform_revenue_overview`: Kết nối `PlatformService` & `ReportsService` tổng hợp GMV toàn sàn, doanh thu gói Subscription SaaS, tốc độ tăng trưởng chu kỳ 30 ngày và danh sách Top nhà hàng đóng góp doanh thu lớn nhất.
   - `detect_restaurant_churn_risk`: Quét các nhà hàng đang `ACTIVE` có dấu hiệu sụt giảm đơn hàng nghiêm trọng (>40% trong 7-14 ngày gần nhất) hoặc sắp hết hạn gói Subscription (trong 7 ngày tới) để cảnh báo rủi ro rời bỏ kèm link điều hướng trực tiếp `/platform/restaurants`.
   - `diagnose_underperforming_restaurants`: Kết nối `ReportsService` & `ReviewsService` phân tích nguyên nhân nhà hàng có doanh thu thấp (tỷ lệ hủy món KDS, thời gian chế biến, hoặc điểm đánh giá CSAT 1-2 sao từ khách hàng).
   - `audit_sales_commissions_anomalies`: Kết nối `SalesService` & `ActivityLogService` rà soát bảng kê sổ cái `commission-ledger`, phát hiện các Sales Rep có dấu hiệu bất thường (nhà hàng giới thiệu không phát sinh đơn thật - 0 GMV hoặc bản ghi hoa hồng trùng lặp).

3. **Bảo Mật & Phân Quyền Đa Tầng (Privilege & Guard Boundary)**:
   - Toàn bộ endpoint `/api/platform/mcp/*` được bảo vệ bằng cặp Guard: `JwtAuthGuard` và `SuperAdminGuard`.
   - Người dùng chưa đăng nhập bị chặn `401 Unauthorized`.
   - Các vai trò Merchant (`restaurant_admin`), Thu ngân (`cashier`), Phục vụ (`waiter`) bị chặn đứng `403 Forbidden`.

4. **Kiến Trúc Zero-Bloat & Zero-Secret**:
   - Dữ liệu trả về ở định dạng JSON tinh gọn (Lean Output), loại bỏ hoàn toàn các thuộc tính Mongoose nội bộ (`_doc`, `$__`) nhằm chống tràn bộ nhớ (OOM).
   - Không hardcode bất kỳ secret/password nào trong mã nguồn và file test, tuân thủ tuyệt đối `secret-scanning-guard.test.ts`.

---

## 2. 📁 Cấu Trúc Thư Mục Triển Khai

```text
src/modules/ai-mcp/
├── interfaces/
│   └── mcp-tool.interface.ts          # Định nghĩa kiểu dữ liệu chuẩn MCP Tool & Execution Response
├── dto/
│   └── execute-mcp-tool.dto.ts        # DTO xác thực payload gọi MCP Tool
├── tools/
│   └── platform-mcp.tools.ts          # 4 công cụ MCP chỉ đọc của Nền tảng (Platform Tools)
├── mcp-registry.service.ts            # Registry quản lý và điều phối thực thi MCP Tools
├── ai-mcp.controller.ts               # Controller API RESTful bảo vệ bởi SuperAdminGuard
└── ai-mcp.module.ts                   # Module NestJS đóng gói dịch vụ AI-MCP

tests/phase-18-superadmin-mcp/
├── README.md                          # Tài liệu kiểm thử chi tiết Tiếng Việt
├── README_en.md                       # Test documentation in English
└── mcp-registry-and-tools.test.ts     # Bộ kiểm thử 7 kịch bản tự động Phase 18
```

---

## 3. 🧪 Ma Trận Kịch Bản Kiểm Thử (7/7 PASS)

File kiểm thử: `tests/phase-18-superadmin-mcp/mcp-registry-and-tools.test.ts` (Port `3181`):

| STT | Kịch Bản Kiểm Thử | Mục Tiêu & Tiêu Chí Nghiệm Thu | Kết Quả |
| :---: | :--- | :--- | :---: |
| **TEST 1** | Đăng ký 4 MCP Platform Tools | Kiểm tra Registry nạp đủ 4 tools với `scope: 'PLATFORM'`, `isReadOnly: true`, và `inputSchema` chuẩn JSON Schema | ✅ **PASS** |
| **TEST 2** | `get_platform_revenue_overview` | Kiểm tra tổng hợp GMV, SaaS revenue, tốc độ tăng trưởng và Top nhà hàng với JSON tinh gọn (chống OOM) | ✅ **PASS** |
| **TEST 3** | `detect_restaurant_churn_risk` | Kiểm tra phát hiện nhà hàng sụt giảm đơn hàng >40% và sắp hết hạn gói cước kèm link `/platform/restaurants` | ✅ **PASS** |
| **TEST 4** | `diagnose_underperforming_restaurants` | Kiểm tra phân tích tỷ lệ hủy đơn/món KDS và phản hồi đánh giá 1-2 sao CSAT tiêu cực | ✅ **PASS** |
| **TEST 5** | `audit_sales_commissions_anomalies` | Kiểm tra phát hiện dấu hiệu bất thường nhà hàng ma (0 đơn thật, 0 VNĐ GMV) và hoa hồng trùng lặp | ✅ **PASS** |
| **TEST 6** | Bảo Mật & Phân Quyền RBAC | Kiểm tra chặn `401 Unauthorized` (chưa đăng nhập), `403 Forbidden` (Merchant, Staff) và chỉ cho phép Superadmin (`200 OK`) | ✅ **PASS** |
| **TEST 7** | Khóa Cứng Registry & Boundaries | Kiểm tra trả về `404 Not Found` khi tool không tồn tại và chặn đứng thực thi các tool ngoài scope `PLATFORM` | ✅ **PASS** |

---

## 4. ⚡ Lệnh Thực Thi Kiểm Thử

```powershell
# Chạy bộ kiểm thử tự động Phase 18:
npm run test:phase18

# Chạy trực tiếp qua ts-node:
npx ts-node tests/phase-18-superadmin-mcp/mcp-registry-and-tools.test.ts

# Chạy kiểm tra rà quét Secret Zero-Leakage:
npm run test:phase14:secrets

# Chạy kiểm tra tính toàn vẹn tài liệu Master READMEs:
npm run test:phase14:docs
```

