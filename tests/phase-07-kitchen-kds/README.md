# Bộ Kiểm Thử Tự Động Toàn Diện Phase 7: Kitchen / KDS

Bộ kiểm thử tự động toàn diện dành cho Phase 7 của hệ thống **iMenu API**, bao gồm: Quản lý hàng đợi bếp KDS (FIFO Ordering, lọc khu vực, bàn, trạng thái, tìm kiếm), Phân quyền RBAC (`KITCHEN` vs `WAITER`), Chu trình chuyển đổi trạng thái món ăn (`Waiting` -> `Cooking` -> `Ready` -> `Served`), Tự động nâng cấp trạng thái đơn hàng (`Auto Order Status Upgrade`), Thao tác hàng loạt (`start-cooking-all`, `mark-ready-all`), Chốt chặn trạng thái bất hợp lệ (Negative Guards), Xử lý Idempotent Double-Click, Chống xung đột đồng thời OCC với Retry Loop (Zero Lost Update), Quản lý báo hết món (86 Out-of-Stock) phân lập chi nhánh, và Đồng bộ sự kiện WebSocket thời gian thực 3 chiều (`order:item_status_updated`, `menu:availability_changed`, `order:created`).

---

## 1. Cấu Trúc Thư Mục Kiểm Thử (`ONE PHASE = ONE TEST DIRECTORY`)

```
imenu-api/tests/phase-07-kitchen-kds/
├── kds-queue-query.test.ts             # Suite 1: Hàng đợi KDS, FIFO, Bộ lọc & Phân lập Multi-Tenant (Port 3110)
├── kds-state-transitions.test.ts       # Suite 2: Chuyển đổi trạng thái, Tự động nâng cấp & Chốt chặn bảo vệ (Port 3111)
├── kds-concurrency-idempotency.test.ts # Suite 3: Chống double-click (Idempotency) & Đồng thời OCC (Port 3112)
├── kds-out-of-stock.test.ts            # Suite 4: Báo hết món (86), Phân lập chi nhánh & WebSocket Realtime (Port 3113)
├── e2e-kds-runner.test.ts              # Suite 6: Runner kịch bản E2E trình duyệt Puppeteer
├── run-all-phase7.ts                   # Master Test Orchestrator (Điều phối toàn bộ test suite)
├── README.md                           # Tài liệu hướng dẫn Tiếng Việt
└── README_en.md                        # English Documentation
```

---

## 2. Chi Tiết Các Test Suite

| Suite | File | Port | Mô tả nội dung kiểm thử |
| :--- | :--- | :---: | :--- |
| **Suite 1** | `kds-queue-query.test.ts` | 3110 | Kiểm tra phân quyền RBAC (`KITCHEN` vs `WAITER`), thứ tự FIFO `createdAt ASC`, loại trừ đơn kết thúc (`Paid`, `Cancelled`), các bộ lọc `zoneId`, `tableId`, `status`, `search` và gom nhóm số lượng món `items-summary`. |
| **Suite 2** | `kds-state-transitions.test.ts` | 3111 | Kiểm tra vòng đời chuẩn `Waiting` -> `Cooking` -> `Ready` -> `Served`, tự động nâng cấp trạng thái đơn khi tất cả món xong, thao tác hàng loạt và các chốt chặn tiêu cực (chặn nấu món chưa duyệt, chặn nhảy cóc sang Ready). |
| **Suite 3** | `kds-concurrency-idempotency.test.ts` | 3112 | Kiểm tra bấm đúp liên tục hoặc song song (Double-click Idempotency trả về 200 OK + `isIdempotent: true`), kiểm tra 4 request cập nhật đồng thời trên 1 đơn qua cơ chế OCC Retry (Zero Lost Update). |
| **Suite 4** | `kds-out-of-stock.test.ts` | 3113 | Bếp báo hết món (86), phân lập chi nhánh (chỉ ghi đè chi nhánh phụ, chi nhánh chính không bị ảnh hưởng), Edge Case #2 (món cũ trong đơn vẫn nấu được, khách mới gọi qua QR bị chặn), và kết nối WebSocket kiểm chứng sự kiện realtime. |
| **Suite 5** | `packages/utils/tests/sdk-contract.test.ts` | 3108 | Kiểm thử hợp đồng SDK Frontend (`SDK-08` -> `SDK-12`) đối với các phương thức `apiClient.kitchen`. |
| **Suite 6** | `scripts/e2e-kds-lifecycle.mjs` | - | Kịch bản Browser E2E Puppeteer chạy qua 6 checkpoints: QR khách -> Bếp KDS -> POS duyệt -> Nấu món -> Báo xong -> Báo hết món. |

---

## 3. Lệnh Thực Thi Kiểm Thử

Các script tiện ích đã được đăng ký trong `imenu-api/package.json`:

```bash
# Chạy từng bộ kiểm thử đơn lẻ
npm run test:phase7:query
npm run test:phase7:transitions
npm run test:phase7:concurrency
npm run test:phase7:out-of-stock

# Chạy kịch bản Browser E2E
npm run test:phase7:e2e

# Chạy Master Orchestrator (Chế độ phát triển Developer)
npm run test:phase7:all

# Chạy Master Orchestrator (Chế độ nghiệm thu đóng Phase)
npm run test:phase7:acceptance
```
