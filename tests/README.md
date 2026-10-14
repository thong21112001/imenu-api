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
│   ├── test.ts                        # Kịch bản E2E: Bàn, Khu vực, Đơn hàng, KDS WebSocket, RBAC (20 ca)
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 5 chi tiết (Tiếng Việt)
│   └── README_en.md                   # Detailed Phase 5 test guide (English)
│
└── phase-06-order-pos/                # [SUB-PHASE 6.9 IMPLEMENTED — MASTER CLOSURE GATE READY] Phase 6: Vận hành Order & POS
    ├── README.md                      # Hướng dẫn kiểm thử Phase 6 toàn diện (Tiếng Việt)
    ├── README_en.md                   # Comprehensive Phase 6 test guide (English)
    ├── thermal-printer-spec.md        # Đặc tả kiến trúc máy in nhiệt ESC/POS 80mm cho Phase 8 (Doc only)
    ├── state-machine.test.ts          # Sub-phase 6.2: State Machine, Round/Item Cancellation & Invariants (56 ca)
    ├── pos-cashier.test.ts            # Sub-phase 6.3: POS Cashier, Thuế/Phí, Cash Change & VietQR (30 ca)
    ├── customer-qr.test.ts            # Sub-phase 6.4: Customer QR Ordering & Staff Approval (43 ca)
    ├── idempotency-concurrency.test.ts# Sub-phase 6.5: Idempotency Key & Concurrent Payment Protection (32 ca)
    ├── table-order-sync.test.ts       # Sub-phase 6.6: Table Transfer, Merge, Move Items & CAS Locks (38 ca)
    ├── order-query.test.ts            # Sub-phase 6.7: Order Query, Filters, Search & Branch Isolation (42 ca)
    ├── subphase-6-8-integration.test.ts # Sub-phase 6.8: Frontend Monorepo Integration & Realtime Room Auth (29 ca)
    ├── e2e-browser-runner.test.ts     # Sub-phase 6.9: Wrapper gọi kịch bản Browser E2E Puppeteer (9 checkpoints)
    └── run-all-phase6.ts              # Sub-phase 6.9: Master Test Orchestrator (Dev 279 ca & Acceptance 365 ca)
```

---

## 2. 🗺️ Ánh Xạ Các Sub-phase Của Phase 6 (Phase 6 Sub-phase Mapping)

Toàn bộ các phân hệ của Phase 6 được tích hợp tập trung vào thư mục `tests/phase-06-order-pos/`:

| Phân hệ / Sub-phase | Tệp Kiểm Thử | Trọng Tâm Nghiệp Vụ | Số Ca Test | Trạng Thái |
| :--- | :--- | :--- | :---: | :---: |
| **6.2 State Machine** | `state-machine.test.ts` | Máy trạng thái vòng đời đơn, Invariants, hủy món/round | 56 | **PASS** |
| **6.3 POS Cashier** | `pos-cashier.test.ts` | Máy thu ngân, VAT, Service fee, Cash tiền thừa, VietQR | 30 | **PASS** |
| **6.4 Customer QR** | `customer-qr.test.ts` | Khách quét mã QR gọi món, duyệt đợt gọi món | 43 | **PASS** |
| **6.5 Idempotency** | `idempotency-concurrency.test.ts` | Header `X-Idempotency-Key`, chống duplicate charge | 32 | **PASS** |
| **6.6 Table Sync** | `table-order-sync.test.ts` | Đổi bàn, gộp bàn, di chuyển món, tách bill, khóa CAS | 38 | **PASS** |
| **6.7 Order Query** | `order-query.test.ts` | Lọc thời gian, nhân viên, đa trạng thái, regex search, phân lập chi nhánh | 42 | **PASS** |
| **6.8 Monorepo Integration** | `subphase-6-8-integration.test.ts` | Tích hợp Monorepo Frontend-Backend, duyệt QR POS, Room Auth (`AUD-6.8-01`) | 29 | **PASS** |
| **6.9 Cross-App Browser E2E**| `e2e-browser-runner.test.ts`<br>*(kèm `scripts/e2e-order-lifecycle.mjs`)* | Kiểm thử tự động trình duyệt 9 checkpoints: QR Menu $\leftrightarrow$ POS Cashier Lifecycle | 9 | **READY** |
| **6.9 Master Orchestrator** | `run-all-phase6.ts` | Điều phối Master Test Runner: Dev mode (279 ca) & Acceptance mode (365 ca) | N/A | **READY** |

---

## 3. ⚡ Danh Mục Lệnh Thực Thi Kiểm Thử (Master Test Commands)

Tất cả các lệnh kiểm thử được đăng ký tại `package.json`:

### 🔹 Bộ Điều Phối Master Test Runner:
```powershell
# 1. Developer Test Run (270 backend + 9 SDK = 279 ca test bắt buộc, cho phép SKIP E2E nếu thiếu server UI)
npm run test:phase6:all

# 2. Final Acceptance Run (365 ca test bắt buộc: 270 Backend + 9 SDK + 9 E2E + 77 Phases 2-5, 0 SKIP, 0 FAIL)
npm run test:phase6:acceptance
```

### 🔹 Kiểm Thử Theo Từng Phase & Hồi Quy:
```powershell
# Phase 2: Auth, Nhà hàng & Multi-Branch (24 ca)
npm run test:phase2:all

# Phase 3: Nhân sự & Phân quyền RBAC (16 ca)
npm run test:phase3

# Phase 4: Thực đơn, Danh mục & Toppings (17 ca)
npm run test:phase4

# Phase 5: Bàn ăn, Đơn hàng & Realtime KDS (20 ca)
npm run test:phase5

# Toàn bộ hồi quy Phases 2–5 (77 ca):
npm run test:regression:phase2-5
```

### 🔹 Kiểm Thử Phase 6 (Order & POS):
```powershell
# Chạy 6 suite backend cơ bản (241 ca):
npm run test:phase6

# Chạy riêng lẻ từng phân hệ:
npm run test:phase6:transitions  # Sub-phase 6.2: State Machine (56 ca)
npm run test:phase6:pos          # Sub-phase 6.3: POS Cashier (30 ca)
npm run test:phase6:customer-qr  # Sub-phase 6.4: Customer QR (43 ca)
npm run test:phase6:concurrency  # Sub-phase 6.5: Idempotency (32 ca)
npm run test:phase6:sync         # Sub-phase 6.6: Table Sync & Transfer (38 ca)
npm run test:phase6:query        # Sub-phase 6.7: Order Query & Filters (42 ca)
npm run test:phase6:integration  # Sub-phase 6.8: Frontend Monorepo Integration (29 ca)
npm run test:phase6:e2e          # Sub-phase 6.9: Browser E2E Lifecycle (9 checkpoints)
```

---

## 4. 📊 Đối Chiếu 365 Ca Test Hệ Sinh Thái (Test Reconciliation Matrix)

```
┌────────────────────────────────────────────────────────────────────────┐
│  TỔNG HỢP 365 CA TEST TỰ ĐỘNG HỆ SINH THÁI IMENU                       │
├────────────────────────────────┬──────────────────────┬────────────────┤
│ Phân Hệ Kiểm Thử               │ Số Tệp / Kịch Bản    │ Số Ca Test     │
├────────────────────────────────┼──────────────────────┼────────────────┤
│ Phase 6 Backend Suites         │ 7 tệp kiểm thử       │ 270            │
│ Frontend SDK Contract Suite    │ 1 tệp kiểm thử       │ 9              │
│ Browser E2E Checkpoints Suite  │ 1 kịch bản E2E       │ 9              │
│ Phases 2–5 Regression Suites   │ 5 tệp kiểm thử       │ 77             │
├────────────────────────────────┴──────────────────────┼────────────────┤
│ TỔNG CỘNG HỆ SINH THÁI (ACCEPTANCE CLOSURE REQUIREMENT)│ 365 CA TEST    │
└───────────────────────────────────────────────────────┴────────────────┘
```
