# 🧪 Trung Tâm Kiểm Thử Tự Động iMenu Backend (Test Suite Master Index)

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Dự án:** iMenu API Backend  
> **Quy ước kiến trúc kiểm thử:** `ONE PHASE = ONE TEST DIRECTORY` (Mỗi Phase sở hữu đúng một thư mục kiểm thử duy nhất. Tất cả test file của các Sub-phase nằm trực tiếp trong thư mục Phase đó).

---

## 1. 📁 Cấu Trúc Thư Mục Kiểm Thử (Phase Directory Layout)

Hệ thống kiểm thử của dự án `imenu-api` được tổ chức theo quy tắc nghiêm ngặt: **Mỗi Phase tương ứng với một thư mục kiểm thử độc lập**. Tất cả các tệp kiểm thử tự động thuộc Phase đó (kể cả khi chia thành nhiều Sub-phase nghiệp vụ) đều nằm trực tiếp bên trong thư mục của Phase, đi kèm tài liệu hướng dẫn song ngữ:

```text
tests/
├── README.md                          # Mục lục & Quy ước kiểm thử tổng thể (Tiếng Việt)
├── README_en.md                       # Master testing index & conventions (English)
│
├── phase-02-auth-restaurant/           # [HOÀN THÀNH] Phase 2: Xác thực, Nhà hàng & Multi-Branch
│   ├── test.ts                        # Kịch bản E2E Phần 1: Auth, Restaurant & Branch CRUD (12 ca)
│   ├── test-multi-branch.ts           # Kịch bản E2E Phần 2: Multi-Branch Lifecycle & Isolation (12 ca)
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 2 chi tiết (Tiếng Việt)
│   └── README_en.md                   # Detailed Phase 2 test guide (English)
│
├── phase-03-staff-rbac/               # [HOÀN THÀNH] Phase 3: Nhân sự, Phân quyền RBAC & Auto-Redirect
│   ├── test.ts                        # Kịch bản E2E: Super Admin ENV, Soft Delete, Cross-Tenant Staff, VietQR (16 ca)
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 3 chi tiết (Tiếng Việt)
│   └── README_en.md                   # Detailed Phase 3 test guide (English)
│
├── phase-04-menu/                     # [HOÀN THÀNH] Phase 4: Thực đơn, Danh mục & Topping
│   ├── test.ts                        # Kịch bản E2E: Danh mục, Món ăn, Toppings, Thu ngân toggle, QR (17 ca)
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 4 chi tiết (Tiếng Việt)
│   └── README_en.md                   # Detailed Phase 4 test guide (English)
│
├── phase-05-order-table-kds/          # [HOÀN THÀNH] Phase 5: Quản lý Bàn, Đơn hàng & Realtime KDS
│   ├── test.ts                        # Kịch bản E2E: Bàn, Khu vực, Đơn hàng, KDS WebSocket, RBAC (18 ca)
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 5 chi tiết (Tiếng Việt)
│   └── README_en.md                   # Detailed Phase 5 test guide (English)
│
├── phase-06-order-pos/                # [HOÀN THÀNH] Phase 6: Vận hành Order & POS
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 6 toàn diện (Tiếng Việt)
│   ├── README_en.md                   # Comprehensive Phase 6 test guide (English)
│   ├── thermal-printer-spec.md        # Đặc tả kiến trúc máy in nhiệt ESC/POS 80mm cho Phase 8 (Doc only)
│   ├── state-machine.test.ts          # Sub-phase 6.2: State Machine, Round/Item Cancellation & Invariants (56 ca)
│   ├── pos-cashier.test.ts            # Sub-phase 6.3: POS Cashier, Thuế/Phí, Cash Change & VietQR (30 ca)
│   ├── customer-qr.test.ts            # Sub-phase 6.4: Customer QR Ordering & Staff Approval (43 ca)
│   ├── idempotency-concurrency.test.ts# Sub-phase 6.5: Idempotency Key & Concurrent Payment Protection (32 ca)
│   ├── table-order-sync.test.ts       # Sub-phase 6.6: Table Transfer, Merge, Move Items & CAS Locks (38 ca)
│   ├── order-query.test.ts            # Sub-phase 6.7: Order Query, Filters, Search & Branch Isolation (42 ca)
│   ├── subphase-6-8-integration.test.ts # Sub-phase 6.8: Frontend Monorepo Integration & Realtime Room Auth (29 ca)
│   ├── e2e-browser-runner.test.ts     # Sub-phase 6.9: Wrapper gọi kịch bản Browser E2E Puppeteer (9 checkpoints)
│   └── run-all-phase6.ts              # Sub-phase 6.9: Master Test Orchestrator (288 ca test)
│
├── phase-07-kitchen-kds/              # [HOÀN THÀNH] Phase 7: Màn Hình Bếp KDS & Điều Phối Món Ăn
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 7 toàn diện (Tiếng Việt)
│   ├── README_en.md                   # Comprehensive Phase 7 test guide (English)
│   ├── kds-queue-query.test.ts        # P7-01: Hàng đợi KDS, FIFO, Filters, Search & Hardening AUD-7.5 (9 ca)
│   ├── kds-state-transitions.test.ts  # P7-02: Vòng đời món ăn, Nâng cấp đơn, Guards, Hardening AUD-7.1/7.2 (10 ca)
│   ├── kds-concurrency-idempotency.test.ts # P7-03: Double-click Idempotency, OCC Locks & Hardening AUD-7.3 (5 ca)
│   ├── kds-out-of-stock.test.ts       # P7-04: Báo hết món (86), Phân lập chi nhánh, Realtime & Hardening AUD-7.4 (6 ca)
│   ├── e2e-kds-runner.test.ts         # P7-E2E: Wrapper gọi kịch bản Browser E2E KDS Lifecycle (6 checkpoints)
│   └── run-all-phase7.ts              # P7-MASTER: Master Test Orchestrator Phase 7 (50 ca test)
├── phase-08-payment-bill/             # [HOÀN THÀNH] Phase 8: Thanh Toán, Hóa Đơn & Đối Soát Tài Chính
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 8 toàn diện (Tiếng Việt)
│   ├── README_en.md                   # Comprehensive Phase 8 test guide (English)
│   ├── payment-request-vietqr.test.ts # P8-01: Yêu cầu thanh toán & Server-side VietQR (23 ca)
│   ├── bills-complete-payment.test.ts # P8-02: Chốt thanh toán cố đẳng, Hóa đơn & Bàn ăn (18 ca)
│   ├── financial-audit-log.test.ts    # P8-03: Nhật ký kiểm toán tài chính & Bảo mật dữ liệu (9 ca)
│   ├── escpos-receipt-encoder.test.ts # P8-04: Bộ mã hóa hóa đơn nhiệt ESC/POS 80mm/58mm (16 ca)
│   ├── e2e-payment-bill-runner.test.ts# P8-E2E: Kịch bản Browser E2E Payment & Bill (5 ca)
│   └── run-all-phase8.ts              # P8-MASTER: Master Test Orchestrator Phase 8 (98 ca test)
│
└── phase-09-dashboard-reports/        # [✅ ĐÃ NGHIỆM THU] Phase 9: Dashboard, Báo Cáo Doanh Thu & Tối Ưu UI/UX
    ├── README.md                      # Hướng dẫn kiểm thử Phase 9 toàn diện (Tiếng Việt)
    ├── README_en.md                   # Comprehensive Phase 9 test guide (English)
    ├── dashboard-overview.test.ts     # P9-01: Chỉ số KPI tổng quan & Dual-Key Engine (16 ca)
    ├── reports-revenue-analytics.test.ts # P9-02: Báo cáo Doanh thu & Phân rã thanh toán (13 ca)
    ├── reports-top-items.test.ts      # P9-03: Món ăn bán chạy & Options Price Delta (7 ca)
    ├── reports-export-rbac.test.ts    # P9-04: Xuất CSV UTF-8 BOM cho Excel & Phân quyền RBAC (10 ca)
    ├── customer-demo-tables.test.ts   # P9-05: Khám phá bàn ăn thực tế & QR Resolution (7 ca)
    ├── e2e-dashboard-reports-runner.test.ts # P9-06: Browser E2E Dashboard, Reports & UI (4 ca)
    └── run-all-phase9.ts              # P9-MASTER: Master Test Orchestrator Phase 9 (57 ca test)
```

---

## 2. 🗺️ Ánh Xạ Các Sub-phase Của Phase 9 (Phase 9 Sub-phase Mapping)

Toàn bộ các phân hệ của Phase 9 được tích hợp tập trung vào thư mục `tests/phase-09-dashboard-reports/`:

| Phân hệ / Sub-phase | Tệp Kiểm Thử | Trọng Tâm Nghiệp Vụ | Số Ca Test | Trạng Thái |
| :--- | :--- | :--- | :---: | :---: |
| **9.1 Realtime Dashboard Overview** | `dashboard-overview.test.ts` | Chỉ số KPI doanh thu hôm nay/hôm qua, tăng trưởng, tỷ lệ lấp đầy bàn, Dual-Key Engine, phân lập chi nhánh, loại trừ bàn xóa mềm (`isDeleted: true`), hardening TC-9.1-AUD-01 | 16 | **PASS** |
| **9.2 Revenue Analytics Engine** | `reports-revenue-analytics.test.ts` | Báo cáo doanh thu thời gian (`day`, `week`, `month`), phân rã 4 phương thức (`Cash`, `VietQR`, `Card`, `Transfer`), phân rã chi nhánh, fallback rỗng an toàn, hardening TC-9.2-AUD-01 | 13 | **PASS** |
| **9.3 Top Selling Items Analytics** | `reports-top-items.test.ts` | Món ăn bán chạy nhất, tính chính xác giá món kèm tùy chọn (`options.priceModifier`), loại bỏ 100% món bị hủy (`Cancelled`), hardening TC-9.3-AUD-01 | 7 | **PASS** |
| **9.4 CSV Export & RBAC Security** | `reports-export-rbac.test.ts` | Xuất báo cáo CSV UTF-8 BOM cho Excel, tiêu đề cột chuẩn, phân quyền nghiêm ngặt (`perm-rep-export`), chặn Manager & Cashier (403), hardening TC-9.4-AUD-01 | 10 | **PASS** |
| **9.5 Customer Demo Tables & QR** | `customer-demo-tables.test.ts` | API công khai lấy danh sách bàn ăn thực tế theo slug nhà hàng (`/api/tables/public/by-restaurant/:restaurantSlug`), kiểm tra token QR, nhóm khu vực bàn | 7 | **PASS** |
| **9.6 Browser E2E & Hardening** | `e2e-dashboard-reports-runner.test.ts` | Kịch bản kiểm thử E2E trình duyệt thật kiểm chứng 4 trạm: Admin Sidebar 4 nhóm, Dashboard KPI, Báo cáo Doanh thu & Top Items kèm xuất CSV, Thực đơn Responsive 3 viewports | 4 | **PASS** |
| **9.6 Frontend SDK Contract** | `packages/utils/tests/sdk-contract.test.ts` | Hợp đồng API Frontend SDK đầy đủ cho các endpoint Phase 9: `dashboard.getOverview` (SDK-26), `reports.getRevenue` (SDK-27), `reports.getTopItems` (SDK-28), `tables.listPublicBySlug` (SDK-29) | 31 | **PASS** |
| **9.6 Master Orchestrator** | `run-all-phase9.ts` | Master Test Orchestrator Phase 9: Chế độ Dev (57 ca) & Chế độ Acceptance (Closure Gate) | N/A | **READY** |

---

## 3. ⚡ Danh Mục Lệnh Thực Thi Kiểm Thử (Master Test Commands)

Tất cả các lệnh kiểm thử được đăng ký tại `package.json`:

### 🔹 Kiểm Thử Phase 9 (Dashboard & Reports):
```powershell
# Chạy toàn bộ 6 suite Phase 9 (57 ca test):
npm run test:phase9:all

# Chạy ở chế độ Acceptance khắt khe (Closure Gate):
npm run test:phase9:acceptance

# Chạy riêng lẻ từng suite Phase 9:
npm run test:phase9:overview    # Suite 1: Dashboard Overview KPI & Dual-Key Engine (16 ca)
npm run test:phase9:revenue     # Suite 2: Báo cáo Doanh thu & Phân rã thanh toán (13 ca)
npm run test:phase9:top-items   # Suite 3: Món ăn bán chạy & Options Price Delta (7 ca)
npm run test:phase9:export      # Suite 4: Xuất báo cáo CSV UTF-8 BOM cho Excel & RBAC (10 ca)
npm run test:phase9:demo-tables # Suite 5: Khám phá bàn ăn thực tế có mã QR (7 ca)
npm run test:phase9:e2e         # Suite 6: Kịch bản Browser E2E Dashboard, Reports & UI (4 ca)
npm run test:phase9             # Chạy cả 5 suite Backend liên tiếp (53 ca)
```

### 🔹 Kiểm Thử Phase 8 (Payment & Bill):
```powershell
# Chạy toàn bộ 6 suite Phase 8 (98 ca test):
npm run test:phase8:all
npm run test:phase8:acceptance

# Chạy riêng lẻ từng suite Phase 8:
npm run test:phase8:request    # Suite 1: Yêu cầu thanh toán & VietQR (23 ca)
npm run test:phase8:bills      # Suite 2: Chốt thanh toán, Hóa đơn & Bàn (18 ca)
npm run test:phase8:audit      # Suite 3: Nhật ký kiểm toán tài chính (9 ca)
npm run test:phase8:escpos     # Suite 4: Bộ mã hóa hóa đơn ESC/POS (16 ca)
npm run test:phase8:e2e        # Suite E2E: Kịch bản Browser E2E Payment & Bill (5 ca)
npm run test:phase8            # Chạy cả 4 suite Backend liên tiếp (66 ca)
```

### 🔹 Kiểm Thử Phase 7 (Kitchen / KDS):
```powershell
# Chạy toàn bộ 6 suite Phase 7 (50 ca test):
npm run test:phase7:all
npm run test:phase7:acceptance

# Chạy riêng lẻ từng suite Phase 7:
npm run test:phase7:query        # Suite 1: Hàng đợi KDS, FIFO & Filters (9 ca)
npm run test:phase7:transitions  # Suite 2: Vòng đời món ăn & Guards (10 ca)
npm run test:phase7:concurrency  # Suite 3: Chống click đúp & OCC Locks (5 ca)
npm run test:phase7:out-of-stock # Suite 4: Báo hết món (86) & Realtime (6 ca)
npm run test:phase7:e2e          # Suite E2E: Kịch bản Browser E2E KDS (6 ca)
npm run test:phase7              # Chạy cả 4 suite Backend liên tiếp (30 ca)
```

### 🔹 Kiểm Thử Phase 6 (Order & POS):
```powershell
# Chạy toàn bộ suite Phase 6 (288 ca test):
npm run test:phase6:all
npm run test:phase6:acceptance

# Chạy riêng lẻ từng phân hệ Phase 6:
npm run test:phase6:transitions  # Sub-phase 6.2: State Machine (56 ca)
npm run test:phase6:pos          # Sub-phase 6.3: POS Cashier (30 ca)
npm run test:phase6:customer-qr  # Sub-phase 6.4: Customer QR (43 ca)
npm run test:phase6:concurrency  # Sub-phase 6.5: Idempotency (32 ca)
npm run test:phase6:sync         # Sub-phase 6.6: Table Sync & Transfer (38 ca)
npm run test:phase6:query        # Sub-phase 6.7: Order Query & Filters (42 ca)
npm run test:phase6:integration  # Sub-phase 6.8: Frontend Monorepo Integration (29 ca)
npm run test:phase6:e2e          # Sub-phase 6.9: Browser E2E Lifecycle (9 checkpoints)
```

### 🔹 Hồi Quy Toàn Hệ Sinh Thái (Phases 2–5):
```powershell
# Phase 2: Auth, Nhà hàng & Multi-Branch (26 ca)
npm run test:phase2:all

# Phase 3: Nhân sự & Phân quyền RBAC (16 ca)
npm run test:phase3

# Phase 4: Thực đơn, Danh mục & Toppings (17 ca)
npm run test:phase4

# Phase 5: Bàn ăn, Đơn hàng & Realtime KDS (18 ca)
npm run test:phase5

# Toàn bộ hồi quy Phases 2–5 (77 ca):
npm run test:regression:phase2-5
```

---

## 4. 📊 Đối Chiếu 570 Ca Test Hệ Sinh Thái (Test Reconciliation Matrix)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  TỔNG HỢP 570 CA TEST TỰ ĐỘNG HỆ SINH THÁI IMENU (PHASES 2 -> 9)                       │
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Phân Hệ Kiểm Thử               │ Số Tệp / Kịch Bản            │ Số Ca Test Thực Tế     │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ Phase 9 Dashboard & Reports    │ 7 tệp kiểm thử (BE + SDK+E2E)│ 57 (88 ca cả SDK)      │
│ Phase 8 Payment & Bill Suites  │ 6 tệp kiểm thử (BE + SDK+E2E)│ 98                     │
│ Phase 7 Kitchen / KDS Suites   │ 6 tệp kiểm thử (BE + SDK+E2E)│ 50                     │
│ Phase 6 Orders & POS Suites    │ 9 tệp kiểm thử (BE + SDK+E2E)│ 288                    │
│ Phases 2–5 Regression Suites   │ 5 tệp kiểm thử               │ 77                     │
├────────────────────────────────┴──────────────────────────────┴────────────────────────┤
│ TỔNG CỘNG HỆ SINH THÁI (ACCEPTANCE CLOSURE REQUIREMENT)        │ 570 CA TEST (RUNNERS)  │
│  - Số ca test đã vượt qua tuyệt đối (Developer/CI Run):        │ 548 / 548 PASS (100%)  │
│  - Số ca test E2E trình duyệt chờ bật full dev server:         │ 22 Checkpoints         │
│  - Tổng số ca kiểm chứng độc lập tính cả Frontend SDK Suite:   │ 583 CA TEST TOÀN DIỆN  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

