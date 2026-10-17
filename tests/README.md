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
├── phase-09-dashboard-reports/        # [HOÀN THÀNH] Phase 9: Dashboard, Báo Cáo Doanh Thu & Tối Ưu UI/UX
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 9 toàn diện (Tiếng Việt)
│   ├── README_en.md                   # Comprehensive Phase 9 test guide (English)
│   ├── dashboard-overview.test.ts     # P9-01: Chỉ số KPI tổng quan & Dual-Key Engine (16 ca)
│   ├── reports-revenue-analytics.test.ts # P9-02: Báo cáo Doanh thu & Phân rã thanh toán (13 ca)
│   ├── reports-top-items.test.ts      # P9-03: Món ăn bán chạy & Options Price Delta (7 ca)
│   ├── reports-export-rbac.test.ts    # P9-04: Xuất CSV UTF-8 BOM cho Excel & Phân quyền RBAC (10 ca)
│   ├── customer-demo-tables.test.ts   # P9-05: Khám phá bàn ăn thực tế & QR Resolution (7 ca)
│   ├── e2e-dashboard-reports-runner.test.ts # P9-06: Browser E2E Dashboard, Reports & UI (4 ca)
│   └── run-all-phase9.ts              # P9-MASTER: Master Test Orchestrator Phase 9 (57 ca test)
│
├── phase-10-realtime/                  # [HOÀN THÀNH] Phase 10: Thời Gian Thực, Phân Lập Phòng WebSocket & Hoàn Tất Lộ Trình
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 10 toàn diện (Tiếng Việt)
│   ├── README_en.md                   # Comprehensive Phase 10 test guide (English)
│   ├── call-staff-notification.test.ts # P10-01: Khách gọi nhân viên & luồng phản hồi 2 chiều (16 ca)
│   ├── websocket-room-security.test.ts # P10-02: Bảo mật phòng WebSocket & phân lập đa chi nhánh (13 ca)
│   ├── domain-events-matrix.test.ts   # P10-03: Ma trận 7 nhóm sự kiện miền thời gian thực (11 ca)
│   ├── subphase-10-4-client-resilience.test.ts # P10-04B: Khả năng phục hồi kết nối, Jitter Backoff & Deduplication (8 ca)
│   ├── e2e-realtime-runner.test.ts    # P10-05: Wrapper gọi kịch bản Browser E2E Đa Tab Hệ Sinh Thái (3 ca)
│   └── run-all-phase10.ts             # P10-MASTER: Master Test Orchestrator Phase 10 (85 ca test)
│
└── phase-11-review-digital-bill/       # [✅ ĐÃ NGHIỆM THU] Phase 11: Đánh Giá Khách Hàng Theo Chi Nhánh & Hóa Đơn Điện Tử
    ├── README.md                      # Hướng dẫn kiểm thử Phase 11 toàn diện (Tiếng Việt)
    ├── README_en.md                   # Comprehensive Phase 11 test guide (English)
    ├── customer-review-submission.test.ts # P11-01: Khách gửi đánh giá, State Machine Guard & Atomic CAS (11 ca)
    ├── branch-review-isolation.test.ts    # P11-02: Phân lập chi nhánh, Thống kê CSAT & Moderation RBAC (9 ca)
    ├── digital-bill-download.test.ts      # P11-03: Mã truy cập hóa đơn điện tử 48 hex & Hết hạn 24h (7 ca)
    └── run-all-phase11.ts                 # P11-MASTER: Master Test Orchestrator Phase 11 (67 ca test)
```

---

## 2. 🗺️ Ánh Xạ Các Sub-phase Của Phase 11 (Phase 11 Sub-phase Mapping)

Toàn bộ các phân hệ của Phase 11 được tích hợp tập trung vào thư mục `tests/phase-11-review-digital-bill/`:

| Phân hệ / Sub-phase | Tệp Kiểm Thử | Trọng Tâm Nghiệp Vụ | Số Ca Test | Trạng Thái |
| :--- | :--- | :--- | :---: | :---: |
| **11.1 Customer Review Submission** | `customer-review-submission.test.ts` | Gửi đánh giá, State Machine Guard (`PaymentRequested`/`Paid`), cờ `isReviewed` & `reviewId`, chặn trùng lặp, Atomic CAS Concurrency 10 reqs (`AUD-11.1`), chống IDOR (`AUD-11.3`), validation rating $\le 5$ & comment $\le 500$ ký tự, đọc lại review | 11 | **PASS** |
| **11.2 Branch Isolation & CSAT** | `branch-review-isolation.test.ts` | Phân lập chi nhánh (`AUD-11.5`), ngăn chặn bypass filter, quyền xem toàn chuỗi của HQ Owner, tổng hợp CSAT (`/reviews/summary`), quản lý gửi phản hồi, chặn phản hồi chéo (403), quyền ẩn/hiện chỉ dành cho Owner (`AUD-11.7`), RBAC `perm-review-view` | 9 | **PASS** |
| **11.3 Digital Bill Download** | `digital-bill-download.test.ts` | Sinh mã `receiptAccessToken` ngẫu nhiên 48 hex, chỉ mục tối ưu, chặn token giả mạo (404), hết hạn sau 24 giờ (`AUD-11.4` -> 400 Bad Request), tải thành công trong 24h, endpoint `GET customer/:id/receipt` chấp nhận token | 7 | **PASS** |
| **11.4 Frontend SDK Contract** | `packages/utils/tests/sdk-contract.test.ts` | Hợp đồng API Frontend SDK đầy đủ: `customerOrders.downloadBill` (SDK-33), `reviews.createCustomerReview` (SDK-34), `reviews.getCustomerReviewByOrder` (SDK-35), `reviews.list` (SDK-36), `reviews.getSummary & reply` (SDK-37), `renderReceiptToPngDataUrl` xuất ảnh hóa đơn 80mm Retina (SDK-38) | 40 | **PASS** |
| **11.5 Master Orchestrator** | `run-all-phase11.ts` | Master Test Orchestrator Phase 11: Tự động điều phối 4 test suites (67 test cases) ở cả 2 chế độ Developer Run và Final Acceptance Run | N/A | **READY** |

---

## 3. ⚡ Danh Mục Lệnh Thực Thi Kiểm Thử (Master Test Commands)

Tất cả các lệnh kiểm thử được đăng ký tại `package.json`:

### 🔹 Kiểm Thử Phase 11 (Customer Review & Digital Bill Download):
```powershell
# Chạy toàn bộ suite Phase 11 (67 ca test):
npm run test:phase11:all

# Chạy ở chế độ Acceptance khắt khe (Official Quality Gate):
npm run test:phase11:acceptance

# Chạy riêng lẻ từng suite Phase 11:
npm run test:phase11:submission # Suite 1: Khách gửi đánh giá & Atomic CAS (11 ca)
npm run test:phase11:isolation  # Suite 2: Phân lập chi nhánh & Moderation RBAC (9 ca)
npm run test:phase11:bill       # Suite 3: Mã hóa đơn điện tử & Hết hạn 24 giờ (7 ca)
npm run test:phase11            # Chạy cả 3 suite Backend liên tiếp (27 ca)
```

### 🔹 Kiểm Thử Phase 10 (Realtime & Ecosystem Finalization):
```powershell
# Chạy toàn bộ suite Phase 10 (85 ca test):
npm run test:phase10:all

# Chạy ở chế độ Acceptance khắt khe (Official Quality Gate):
npm run test:phase10:acceptance

# Chạy riêng lẻ từng suite Phase 10:
npm run test:phase10:call-staff  # Suite 1: Khách gọi nhân viên & xác nhận hai chiều (16 ca)
npm run test:phase10:security    # Suite 2: Bảo mật phòng WebSocket & phân lập chi nhánh (13 ca)
npm run test:phase10:events      # Suite 3: Ma trận 7 nhóm sự kiện miền thời gian thực (11 ca)
npm run test:phase10:sdk         # Suite 4A: Hợp đồng Frontend SDK Contract (34 ca)
npm run test:phase10:resilience  # Suite 4B: Khả năng phục hồi kết nối & khử trùng lặp (8 ca)
npm run test:phase10:e2e         # Suite 5: Kịch bản Browser E2E đa tab thời gian thực (3 ca)
npm run test:phase10             # Chạy 4 suite Backend liên tiếp (48 ca)
```

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
# Chạy toàn bộ suite Phase 6 (279 ca test mandatory):
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
# Phase 2: Auth, Nhà hàng & Multi-Branch (23 ca)
npm run test:phase2:all

# Phase 3: Nhân sự & Phân quyền RBAC (16 ca)
npm run test:phase3

# Phase 4: Thực đơn, Danh mục & Toppings (17 ca)
npm run test:phase4

# Phase 5: Bàn ăn, Đơn hàng & Realtime KDS (18 ca)
npm run test:phase5

# Toàn bộ hồi quy Phases 2–5 (74 ca):
npm run test:regression:phase2-5
```

---

## 4. 📊 Đối Chiếu 710 Ca Test Hệ Sinh Thái (Test Reconciliation Matrix)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  TỔNG HỢP 710 CA TEST TỰ ĐỘNG HỆ SINH THÁI IMENU (PHASES 2 -> 11)                      │
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Phân Hệ Kiểm Thử               │ Số Tệp / Kịch Bản            │ Số Ca Test Thực Tế     │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ Phase 11 Review & Digital Bill │ 4 tệp kiểm thử (BE + SDK)    │ 67 (100% PASS)         │
│ Phase 10 Realtime & Ecosystem  │ 6 tệp kiểm thử (BE + SDK+E2E)│ 85                     │
│ Phase 9 Dashboard & Reports    │ 7 tệp kiểm thử (BE + SDK+E2E)│ 57                     │
│ Phase 8 Payment & Bill Suites  │ 6 tệp kiểm thử (BE + SDK+E2E)│ 98                     │
│ Phase 7 Kitchen / KDS Suites   │ 6 tệp kiểm thử (BE + SDK+E2E)│ 50                     │
│ Phase 6 Orders & POS Suites    │ 9 tệp kiểm thử (BE + SDK+E2E)│ 279                    │
│ Phases 2–5 Regression Suites   │ 5 tệp kiểm thử               │ 74                     │
├────────────────────────────────┴──────────────────────────────┴────────────────────────┤
│ TỔNG CỘNG HỆ SINH THÁI (FULL ECOSYSTEM ROADMAP ACCEPTED)       │ 710 CA TEST (PASS)     │
│  - Số ca test đã vượt qua tuyệt đối (Developer/CI Run):        │ 710 / 710 PASS (100%)  │
│  - Tỷ lệ thất bại & chặn (Fail/Blocked):                       │ 0 FAIL, 0 BLOCKED      │
│  - Trạng thái nghiệm thu toàn bộ lộ trình:                     │ ✅ 11/11 PHASES HOÀN TẤT│
└────────────────────────────────────────────────────────────────────────────────────────┘
```
