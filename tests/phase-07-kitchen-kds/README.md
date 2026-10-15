# 🧪 Phase 7: Màn Hình Bếp KDS & Điều Phối Món Ăn Thời Gian Thực (Kitchen Display System)

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)<br>
> **Phase:** 7 — Kitchen Display System (KDS) & Realtime Dish Dispatching<br>
> **Trạng thái phân hệ:** **✅ ĐÃ NGHIỆM THU — ĐÓNG CHÍNH THỨC (PHASE 7 CLOSURE GATE PASSED)**<br>
> **Quy ước kiến trúc:** `ONE PHASE = ONE TEST DIRECTORY` (Tất cả test artifacts của Phase 7 được lưu trữ tập trung tại thư mục này).

---

## 1. Mục Đích & Bối Cảnh (Phase 7 Purpose)

Phase 7 là phân hệ cốt lõi hoàn thiện chu trình khép kín của vận hành ẩm thực F&B: **Khách hàng gọi món (QR Menu) $\rightarrow$ Thu ngân duyệt đơn (POS) $\rightarrow$ Màn hình Bếp tiếp nhận và chế biến (KDS) $\rightarrow$ Báo món xong & Phục vụ (Ready & Served)**.

Theo quy ước chuẩn kiến trúc của dự án `imenu-api`:
> **Quy ước:** `ONE PHASE = ONE TEST DIRECTORY`  
> Toàn bộ các tệp kiểm thử tự động, runner điều phối và tài liệu kiểm thử của Phase 7 (từ 7.1 đến 7.6) được lưu trữ thống nhất và tập trung trực tiếp tại thư mục `tests/phase-07-kitchen-kds/`. Các Sub-phase **không** tạo thư mục riêng nhằm tránh phân mảnh repository.

---

## 2. Phạm Vi Nghiệp Vụ & Các Sub-phase (Phase 7 Scope & Sub-phases)

Phase 7 bao gồm 6 phân hệ nghiệp vụ hoàn chỉnh:

1. **Sub-phase 7.1 — KDS Queue Engine, FIFO Ordering & Active Query:**
   - Cung cấp API chuyên biệt cho bếp: `GET /api/kitchen/orders` và `GET /api/kitchen/items-summary`.
   - Sắp xếp hàng đợi theo nguyên tắc vào trước ra trước (**FIFO `createdAt ASC`**).
   - Tự động loại trừ các đơn hàng đã thanh toán (`Paid`) hoặc đã hủy (`Cancelled`).
   - Gom nhóm số lượng món đang chờ và đang nấu (`Waiting`, `Cooking`) trên toàn bộ các bàn trong chi nhánh.
   - Hỗ trợ bộ lọc linh hoạt: `branchId`, `zoneId`, `tableId`, `status`, `search` (mã đơn, tên bàn), `includeUnconfirmed`.

2. **Sub-phase 7.2 — Item Status State Machine & Auto Order Status Upgrade:**
   - Vòng đời trạng thái từng món: `WaitingConfirmation` $\rightarrow$ `Waiting` $\rightarrow$ `Cooking` $\rightarrow$ `Ready` $\rightarrow$ `Served`.
   - Các API chuyển đổi trạng thái món:
     * `POST /api/order-items/:id/start-cooking` (hoặc route lồng `/api/orders/:orderId/items/:itemId/start-cooking`)
     * `POST /api/order-items/:id/mark-ready`
     * `POST /api/order-items/:id/mark-served`
     * `POST /api/orders/:orderId/kitchen/batch-update` (Cập nhật hàng loạt theo đợt gọi món hoặc toàn bộ đơn)
   - Tự động nâng cấp trạng thái đơn hàng (`Order.status`):
     * Khi có ít nhất 1 món bắt đầu nấu $\rightarrow$ `Order.status` tự động nâng sang `Preparing`.
     * Khi toàn bộ món trong đơn đã sẵn sàng $\rightarrow$ `Order.status` tự động nâng sang `Ready`.
     * Khi toàn bộ món đã phục vụ bàn $\rightarrow$ `Order.status` tự động chuyển sang `Served`.
   - Bộ bảo vệ Negative Guards: Chặn nấu món chưa duyệt (`WaitingConfirmation`), chặn nhảy cóc từ `Waiting` sang `Ready`, chặn thao tác trên món bị hủy (`Cancelled`) hoặc đơn đã thanh toán (`Paid`).

3. **Sub-phase 7.3 — Out-of-Stock (86) Management & Multi-Branch Isolation:**
   - Cung cấp API cho bếp xem danh sách món ăn và báo hết món: `GET /api/kitchen/menu-items` và `PATCH /api/kitchen/menu-items/:id/availability`.
   - Cơ chế ghi đè khả dụng theo chi nhánh (**Branch Availability Override**): Bếp chi nhánh B báo hết món chỉ áp dụng cho chi nhánh B, chi nhánh chính A và các chi nhánh khác vẫn phục vụ bình thường.
   - Blueprint Edge Case #2: Món ăn trong đơn cũ đã tạo trước đó vẫn tiếp tục được nấu và hoàn tất bình thường; khách quét QR gọi mới sẽ bị chặn ngay lập tức với `400 Bad Request`.

4. **Sub-phase 7.4 — Cross-App Realtime WebSocket Pairing (3-Way Synchronization):**
   - Ghép nối thời gian thực 3 chiều giữa **KDS (Bếp)** $\leftrightarrow$ **POS (Thu ngân)** $\leftrightarrow$ **Customer QR Menu (Khách tại bàn)**.
   - Bếp nhận tức thì sự kiện khi khách gọi món hoặc thu ngân duyệt đợt gọi món.
   - Khách tại bàn nhận sự kiện cập nhật trạng thái món (`Cooking`, `Ready`) tức thì trên Drawer theo dõi tiến độ món ăn mà không cần F5 tải lại trang.
   - Phát âm báo chuông reo (Chime Alert) trên KDS khi có món mới hoặc khi hoàn tất món.

5. **Sub-phase 7.5 — Modern KDS User Interface (`apps/imenu-admin/src/app/kitchen/page.tsx`):**
   - Thiết kế màn hình bếp chuyên dụng chuẩn công nghiệp (High-Contrast Dark Mode).
   - Thanh gom nhóm tổng hợp số lượng món (Header Summary Bar: Tổng món chờ, Tổng món nấu).
   - Bộ thẻ đơn hàng trực quan với mã màu phân biệt trạng thái món, bộ bấm giờ đếm thời gian thực từ lúc đặt món và cảnh báo trễ (cảnh báo đỏ khi quá 15 phút).
   - Modal quản lý báo hết món (86 Stockout Modal) thao tác 1 chạm.
   - Hỗ trợ lọc theo khu vực bàn và tìm kiếm tức thì.

6. **Sub-phase 7.6 — Hardening, Adversarial Audit & Zero-Vulnerability Closure:**
   - `AUD-7.1`: Khóa chặt lỗ hổng Cross-Branch Cook IDOR; đầu bếp chi nhánh con không thể thao tác trên đơn hàng chi nhánh khác.
   - `AUD-7.2`: Phân định quyền hạn chi tiết cho Custom Roles; quyền nấu món (`perm-kds-cook`) và quyền báo hết món (`perm-kds-out`) tách biệt độc lập với mã lỗi `403 Forbidden`.
   - `AUD-7.3`: Gia cố Atomic Conditional Update chống Race Condition giữa Thu ngân thanh toán và Bếp cập nhật món.
   - `AUD-7.4`: Gia cố bảo mật phòng WebSocket `RealtimeGateway`; khách vãng lai chỉ được tham gia phòng bàn ăn của mình (`table_${tableId}`) và phòng thực đơn công khai (`public_menu_${restId}`), tuyệt đối không nhận dữ liệu đơn hàng của bàn khác.
   - `AUD-7.5`: Kiểm duyệt tham số đầu vào (`zoneId`, độ dài tìm kiếm) và bảo vệ bộ lọc không lọt đơn đã thanh toán.
   - `AUD-7.6`: Cơ chế tự động hoàn tác Optimistic UI (Rollback state) khi có lỗi API và chỉ phát chuông reo sau khi backend ghi nhận thành công.

---

## 3. Danh Mục Tệp Kiểm Thử & Kiểm Toán (Test Inventory)

Toàn bộ các tệp kiểm thử tự động của Phase 7:

| Mã Suite | Tệp Kiểm Thử | Trọng Tâm Xác Thực | Số Ca Test | Trạng Thái |
| :---: | :--- | :--- | :---: | :---: |
| **P7-01** | `kds-queue-query.test.ts` | Hàng đợi KDS, thứ tự FIFO (`createdAt ASC`), bộ lọc `zoneId`, `tableId`, `status`, `search`, phân lập chi nhánh, loại trừ đơn `Paid`/`Cancelled`, gom nhóm tổng món (`items-summary`), hardening AUD-7.5. | **9** | **PASS** |
| **P7-02** | `kds-state-transitions.test.ts` | Vòng đời món ăn (`start-cooking`, `mark-ready`, `mark-served`), tự động nâng cấp trạng thái đơn hàng (`Preparing`, `Ready`, `Served`), cập nhật hàng loạt theo đợt gọi món, negative guards, hardening AUD-7.1 (chặn chéo chi nhánh 403), hardening AUD-7.2 (phân định `perm-kds-cook` vs `perm-kds-out`). | **10** | **PASS** |
| **P7-03** | `kds-concurrency-idempotency.test.ts` | Chống click đúp (Idempotent 200 OK khi gọi lại cùng trạng thái), chống tranh chấp đa luồng OCC (`Promise.all` đồng thời), không mất mát dữ liệu (Zero Lost Update), hardening AUD-7.3 (Race Condition Cashier Pay vs Cook Update). | **5** | **PASS** |
| **P7-04** | `kds-out-of-stock.test.ts` | Bếp xem danh sách món ăn, báo hết món (86) theo chi nhánh độc lập, Blueprint Edge Case #2 (đơn cũ vẫn nấu, khách mới bị chặn 400), đồng bộ realtime WebSocket 3 chiều, hardening AUD-7.4 (bảo mật room khách QR). | **6** | **PASS** |
| **P7-SDK**| `packages/utils/tests/sdk-contract.test.ts`<br>*(tại `imenu-menudientu`)* | Kiểm tra hợp đồng API Frontend SDK cho toàn bộ các endpoint KDS (`apiClient.kitchen.*`: `getOrders`, `getItemsSummary`, `startCookingItem`, `markItemReady`, `markItemServed`, `batchUpdate`, `toggleAvailability`). | **14** | **PASS** |
| **P7-E2E**| `e2e-kds-runner.test.ts`<br>*(kèm `scripts/e2e-kds-lifecycle.mjs`)* | Kịch bản kiểm thử tự động hóa E2E trình duyệt thật kiểm chứng toàn bộ vòng đời điều phối món ăn: QR Order $\rightarrow$ KDS Cooking $\rightarrow$ KDS Ready $\rightarrow$ Khách theo dõi realtime $\rightarrow$ Phục vụ bàn. | **6** | **PASS** |
| **MASTER**| `run-all-phase7.ts` | Master Test Orchestrator điều phối toàn diện 6 suites: Chế độ Dev (50 ca) & Chế độ Acceptance (Closure Gate). | N/A | **READY** |

---

## 4. Bảng Đối Chiếu Số Lượng Ca Test Toàn Hệ Sinh Thái (Test Reconciliation Matrix)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  HỆ SINH THÁI KIỂM THỬ IMENU — ĐỐI CHIẾU 415 CA TEST TỰ ĐỘNG CHUẨN XÁC                │
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Phân Hệ Kiểm Thử               │ Vị Trí / Tệp Kiểm Thử         │ Số Ca Test Thực Tế     │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ 1. Phase 7 Backend Suites      │ tests/phase-07-kitchen-kds/  │ 30                     │
│ 2. Frontend SDK Contract Suite │ packages/utils/tests/        │ 14                     │
│ 3. Browser E2E Checkpoints     │ scripts/e2e-kds-lifecycle    │ 6                      │
│ 4. Phase 6 Orders & POS Suites │ tests/phase-06-order-pos/    │ 288 (270 BE + 9 SDK + 9 E2E)│
│ 5. Phases 2–5 Core Regressions │ tests/phase-02..05/          │ 77                     │
├────────────────────────────────┴──────────────────────────────┼────────────────────────┤
│ TỔNG CỘNG HỆ SINH THÁI (ACCEPTANCE CLOSURE REQUIREMENT)        │ 415 CA TEST            │
└───────────────────────────────────────────────────────────────┴────────────────────────┘
```

### Chi tiết phân bổ 50 ca kiểm thử Phase 7:
- **P7-01 (`kds-queue-query.test.ts`)**: 9 ca (`TC-01` đến `TC-09`)
- **P7-02 (`kds-state-transitions.test.ts`)**: 10 ca (`TC-01` đến `TC-10`)
- **P7-03 (`kds-concurrency-idempotency.test.ts`)**: 5 ca (`TC-01` đến `TC-05`)
- **P7-04 (`kds-out-of-stock.test.ts`)**: 6 ca (`TC-01` đến `TC-06`)
- **P7-SDK (`sdk-contract.test.ts`)**: 14 ca (`SDK-01` đến `SDK-12`, bao gồm cả 02b và 03b)
- **P7-E2E (`e2e-kds-lifecycle.mjs`)**: 6 checkpoints

---

## 5. Hướng Dẫn Các Lệnh Chạy Kiểm Thử (Phase 7 Test Commands)

Tất cả các lệnh kiểm thử được đăng ký tại `package.json`:

### 🔹 Chạy Toàn Bộ Test Suite Phase 7:
```powershell
# Chạy toàn bộ 6 suite của Phase 7 (30 Backend + 14 SDK + 6 E2E):
npm run test:phase7:all

# Chạy ở chế độ Acceptance khắt khe:
npm run test:phase7:acceptance
```

### 🔹 Chạy Riêng Lẻ Từng Suite Của Phase 7:
```powershell
# Suite 1: Hàng đợi KDS, FIFO & Filters (Port 3110)
npm run test:phase7:query

# Suite 2: Vòng đời món ăn, Nâng cấp đơn & Guards (Port 3111)
npm run test:phase7:transitions

# Suite 3: Chống click đúp & Tranh chấp đồng thời OCC (Port 3112)
npm run test:phase7:concurrency

# Suite 4: Báo hết món (86), Phân lập chi nhánh & Realtime (Port 3113)
npm run test:phase7:out-of-stock

# Suite E2E: Kịch bản Browser E2E KDS Lifecycle
npm run test:phase7:e2e

# Chạy cả 4 suite Backend liên tiếp:
npm run test:phase7
```

### 🔹 Chạy Hồi Quy Toàn Hệ Sinh Thái:
```powershell
# Hồi quy Phases 2–5 (77 ca):
npm run test:regression:phase2-5

# Hồi quy Phase 6 (288 ca):
npm run test:phase6:all
```

---

## 6. Kết Luận & Đóng Nghiệm Thu

Phase 7 đã hoàn thành xuất sắc toàn bộ các mục tiêu đặt ra trong đặc tả kiến trúc:
- Cơ chế dọn dẹp sạch sẽ tài nguyên kiểm thử (**Zero Garbage Teardown**) đảm bảo không để lại tài liệu rác nào trong cơ sở dữ liệu sau khi chạy test.
- Không phát sinh lỗi hồi quy trên các phân hệ trước đó (Phases 2–6).
- Sẵn sàng bàn giao và phục vụ cho giai đoạn tiếp theo của hệ thống iMenu.
