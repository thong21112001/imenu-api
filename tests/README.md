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
└── phase-07-kitchen-kds/              # [✅ ĐÃ NGHIỆM THU] Phase 7: Màn Hình Bếp KDS & Điều Phối Món Ăn
    ├── README.md                      # Hướng dẫn kiểm thử Phase 7 toàn diện (Tiếng Việt)
    ├── README_en.md                   # Comprehensive Phase 7 test guide (English)
    ├── kds-queue-query.test.ts        # P7-01: Hàng đợi KDS, FIFO, Filters, Search & Hardening AUD-7.5 (9 ca)
    ├── kds-state-transitions.test.ts  # P7-02: Vòng đời món ăn, Nâng cấp đơn, Guards, Hardening AUD-7.1/7.2 (10 ca)
    ├── kds-concurrency-idempotency.test.ts # P7-03: Double-click Idempotency, OCC Locks & Hardening AUD-7.3 (5 ca)
    ├── kds-out-of-stock.test.ts       # P7-04: Báo hết món (86), Phân lập chi nhánh, Realtime & Hardening AUD-7.4 (6 ca)
    ├── e2e-kds-runner.test.ts         # P7-E2E: Wrapper gọi kịch bản Browser E2E KDS Lifecycle (6 checkpoints)
    └── run-all-phase7.ts              # P7-MASTER: Master Test Orchestrator Phase 7 (50 ca test)
```

---

## 2. 🗺️ Ánh Xạ Các Sub-phase Của Phase 7 (Phase 7 Sub-phase Mapping)

Toàn bộ các phân hệ của Phase 7 được tích hợp tập trung vào thư mục `tests/phase-07-kitchen-kds/`:

| Phân hệ / Sub-phase | Tệp Kiểm Thử | Trọng Tâm Nghiệp Vụ | Số Ca Test | Trạng Thái |
| :--- | :--- | :--- | :---: | :---: |
| **7.1 KDS Queue Engine** | `kds-queue-query.test.ts` | Hàng đợi FIFO (`createdAt ASC`), bộ lọc `zoneId`, `tableId`, `status`, loại trừ `Paid`/`Cancelled`, tổng món (`items-summary`), hardening AUD-7.5 | 9 | **PASS** |
| **7.2 State Machine & Upgrade**| `kds-state-transitions.test.ts`| `start-cooking`, `mark-ready`, `mark-served`, nâng cấp đơn tự động (`Preparing`, `Ready`, `Served`), cập nhật hàng loạt, hardening AUD-7.1/7.2 | 10 | **PASS** |
| **7.3 Concurrency & Idempotency**| `kds-concurrency-idempotency.test.ts`| Chống click đúp (200 OK idempotent), xử lý tranh chấp OCC đa luồng, Zero Lost Update, hardening AUD-7.3 (Race Cashier Pay vs Cook Update) | 5 | **PASS** |
| **7.4 Out-of-Stock (86) & Realtime**| `kds-out-of-stock.test.ts` | Báo hết món (86) phân lập chi nhánh, Blueprint Edge Case #2, đồng bộ WebSocket 3 chiều, hardening AUD-7.4 (bảo mật room khách) | 6 | **PASS** |
| **7.5 Frontend SDK Contract** | `packages/utils/tests/sdk-contract.test.ts` | Hợp đồng API Frontend SDK cho toàn bộ các endpoint KDS (`apiClient.kitchen.*`) | 14 | **PASS** |
| **7.6 Cross-App Browser E2E** | `e2e-kds-runner.test.ts`<br>*(kèm `scripts/e2e-kds-lifecycle.mjs`)* | Kịch bản kiểm thử tự động hóa E2E trình duyệt thật kiểm chứng toàn bộ vòng đời điều phối món ăn KDS | 6 | **PASS** |
| **7.6 Master Orchestrator** | `run-all-phase7.ts` | Điều phối Master Test Runner Phase 7: Dev mode (50 ca) & Acceptance mode (Closure Gate) | N/A | **READY** |

---

## 3. ⚡ Danh Mục Lệnh Thực Thi Kiểm Thử (Master Test Commands)

Tất cả các lệnh kiểm thử được đăng ký tại `package.json`:

### 🔹 Kiểm Thử Phase 7 (Kitchen / KDS):
```powershell
# Chạy toàn bộ 6 suite Phase 7 (50 ca test):
npm run test:phase7:all

# Chạy ở chế độ Acceptance khắt khe:
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

## 4. 📊 Đối Chiếu 415 Ca Test Hệ Sinh Thái (Test Reconciliation Matrix)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  TỔNG HỢP 415 CA TEST TỰ ĐỘNG HỆ SINH THÁI IMENU (PHASES 2 -> 7)                       │
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Phân Hệ Kiểm Thử               │ Số Tệp / Kịch Bản            │ Số Ca Test Thực Tế     │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ Phase 7 Kitchen / KDS Suites   │ 6 tệp kiểm thử (BE + SDK+E2E)│ 50                     │
│ Phase 6 Orders & POS Suites    │ 9 tệp kiểm thử (BE + SDK+E2E)│ 288                    │
│ Phases 2–5 Regression Suites   │ 5 tệp kiểm thử               │ 77                     │
├────────────────────────────────┴──────────────────────────────┼────────────────────────┤
│ TỔNG CỘNG HỆ SINH THÁI (ACCEPTANCE CLOSURE REQUIREMENT)        │ 415 CA TEST            │
└───────────────────────────────────────────────────────────────┴────────────────────────┘
```
