# 🧪 Phase 6: Vận Hành Order, POS & Đồng Bộ Bàn Ăn (Order & POS Lifecycle)

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)<br>
> **Phase:** 6 — Order & POS Lifecycle<br>
> **Trạng thái phân hệ:** **SUB-PHASE 6.9 IMPLEMENTED — MASTER CLOSURE GATE READY**<br>
> **Kiến trúc thư mục:** `ONE PHASE = ONE TEST DIRECTORY` (Tất cả test artifacts của Phase 6 được lưu trữ tập trung tại thư mục này).

---

## 1. Mục Đích & Bối Cảnh (Phase 6 Purpose)

Phase 6 là giai đoạn trọng yếu triển khai toàn bộ luồng vận hành đơn hàng (Order Lifecycle), máy bán hàng thu ngân (POS Cashier), luồng khách gọi món qua QR (Customer QR), cơ chế kiểm soát giao dịch trùng lặp / tranh chấp đồng thời (Idempotency & Concurrency), đồng bộ trạng thái giữa bàn ăn với đơn hàng (Table ↔ Order Synchronization), tích hợp Monorepo Frontend và kiểm chuẩn E2E trình duyệt đa ứng dụng.

Theo quy ước chuẩn kiến trúc của dự án `imenu-api`:
> **Quy ước:** `ONE PHASE = ONE DIRECTORY`  
> Toàn bộ các tệp kiểm thử tự động, runner điều phối và tài liệu đặc tả của Phase 6 (từ 6.1 đến 6.9) được lưu trữ thống nhất và tập trung trực tiếp tại thư mục `tests/phase-06-order-pos/`. Các Sub-phase **không** tạo thư mục riêng nhằm tránh phân mảnh repository.

---

## 2. Phạm Vi Nghiệp Vụ & Các Sub-phase (Phase 6 Scope & Sub-phases)

Phase 6 bao gồm 9 phân hệ nghiệp vụ hoàn chỉnh:

1. **Sub-phase 6.1 — Core Order & Table Lifecycle Baseline:** Thiết lập nền tảng vòng đời đơn hàng, liên kết bàn ăn và cấu trúc dữ liệu đợt gọi món (`rounds[]`), danh sách món (`items[]`).
2. **Sub-phase 6.2 — State Machine & Business Invariants:** Máy trạng thái chuyển đổi đơn hàng và bàn ăn, ràng buộc bất biến (Single active order per table, Paid is Terminal, RBAC chuyển trạng thái).
3. **Sub-phase 6.3 — POS Cashier & Billing Flows:** Nghiệp vụ thu ngân POS, hóa đơn, tính thuế VAT, phí dịch vụ, chiết khấu, thanh toán tiền mặt Cash (tính tiền thừa `changeAmount`), thanh toán VietQR và thanh toán nhanh (Quick-pay).
4. **Sub-phase 6.4 — Customer QR Ordering:** Khách quét mã QR tại bàn, xem thực đơn công khai, gửi yêu cầu gọi món theo đợt (`WaitingConfirmation`), nhân viên thu ngân/phục vụ xác nhận (`Confirmed`), bảo vệ chống mở đơn trùng lặp.
5. **Sub-phase 6.5 — Idempotency Key & Concurrency Control:** Middleware Idempotency Key (`X-Idempotency-Key`) chặn đứng request trùng lặp, cơ chế khóa nguyên tử thanh toán POS đa luồng (`Atomic Payment Claim`), bảo vệ bất biến tài chính.
6. **Sub-phase 6.6 — Table ↔ Order Synchronization & Transfer/Merge:** Thắt chặt đồng bộ giữa bàn ăn và đơn hàng, đổi bàn (`transferTable`), gộp bàn (`mergeTables`), di chuyển món / tách bàn (`moveItemsBetweenTables`), tách hóa đơn (Split Bill), khóa nguyên tử CAS (Compare-And-Swap) và Optimistic Concurrency Control (OCC) Retry.
7. **Sub-phase 6.7 — Order Query, Filters, Search & Multi-Branch Optimization:** Nâng cấp toàn diện API truy vấn đơn hàng `GET /api/orders` (lọc khoảng thời gian, nhân viên, đa trạng thái, phương thức thanh toán, regex search an toàn, phân trang xác định, cách ly chi nhánh và compound indexes).
8. **Sub-phase 6.8 — Frontend Monorepo Integration:** Tích hợp Monorepo Frontend (`imenu-menudientu`) với Backend API (`imenu-api`); công khai endpoint QR table context (`GET /api/orders/public/table-context`), đồng bộ hóa các đợt gọi món (`OrderRound`, `WaitingConfirmation`), duyệt đơn QR POS & KDS guard, thao tác gộp/chuyển bàn, xem trước hóa đơn và in 80mm, gia cố bảo mật phòng WebSocket Realtime (`AUD-6.8-01`).
9. **Sub-phase 6.9 — Phase 6 Master Hardening, E2E Cross-App Validation & Final Closure Gate:**
   - Kịch bản kiểm thử tự động hóa E2E trình duyệt thật (`puppeteer-core` kết nối Chrome) kiểm chứng 9 checkpoint xuyên suốt Customer Menu $\leftrightarrow$ Admin POS.
   - Bộ điều phối kiểm thử tổng lực `run-all-phase6.ts` hỗ trợ hai chế độ (`--mode=dev` và `--mode=acceptance`).
   - Đặc tả kiến trúc máy in nhiệt ESC/POS chuẩn bị cho Phase 8 (`thermal-printer-spec.md`).
   - Khung đối soát 365 ca test toàn diện và cổng nghiệm thu đóng chính thức Phase 6.

---

## 3. Danh Mục Tệp Kiểm Thử & Kiểm Toán (Test Inventory)

Toàn bộ các tệp kiểm thử tự động của Phase 6:

| Tệp Kiểm Thử | Phân Hệ | Trọng Tâm Xác Thực | Số Ca Test | Trạng Thái |
| :--- | :---: | :--- | :---: | :---: |
| **`state-machine.test.ts`** | 6.2 | Chuyển đổi trạng thái đơn hàng (`WaitingConfirmation` $\rightarrow$ `Preparing` $\rightarrow$ `Ready` $\rightarrow$ `Served` $\rightarrow$ `Paid` / `Cancelled`), duyệt/hủy round, hủy món, tính lại `subTotal`, RBAC nhân viên. | **56** | **PASS** |
| **`pos-cashier.test.ts`** | 6.3 | Thu ngân POS, tính toán tài chính (VAT, phí dịch vụ, giảm giá), thanh toán Cash (tính tiền thừa), thanh toán VietQR, quick-pay, chặn thêm món vào đơn đã Paid, phân lập chi nhánh và nhà hàng. | **30** | **PASS** |
| **`customer-qr.test.ts`** | 6.4 | Khách quét QR gọi món, tạo round `WaitingConfirmation`, nhân viên xác nhận món, giới hạn bàn, bảo mật QR token, phân lập nhà hàng và chi nhánh. | **43** | **PASS** |
| **`idempotency-concurrency.test.ts`** | 6.5 | Header `X-Idempotency-Key` tái phát hiện request trùng lặp (replay cached response), thanh toán đồng thời qua `Promise.all` (đúng 1 thành công, 1 bị từ chối), zero duplicate charge. | **32** | **PASS** |
| **`table-order-sync.test.ts`** | 6.6 | Đổi bàn (`transferTable`), gộp bàn (`mergeTables`), di chuyển món (`moveItemsBetweenTables`), tách bill, khóa CAS chống race transfer, OCC retry chống xung đột phiên bản Mongoose, kiểm thử hồi quy defect. | **38** | **PASS** |
| **`order-query.test.ts`** | 6.7 | Lọc thời gian, nhân sự, đa trạng thái, phương thức thanh toán, regex search an toàn, phân trang xác định, cách ly chi nhánh tuyệt đối, xác minh explain index scan. | **42** | **PASS** |
| **`subphase-6-8-integration.test.ts`** | 6.8 | Tích hợp xuyên suốt Frontend-Backend, vòng đời đợt gọi món QR, duyệt đơn QR POS, Table operations (transfer, merge, move-items), Bill preview & POS pay, bảo mật phân lập tenant và gia cố Realtime Room Auth (`AUD-6.8-01`). | **29** | **PASS** |
| **`e2e-browser-runner.test.ts`**<br>*(kèm `scripts/e2e-order-lifecycle.mjs`)* | 6.9 | Tự động hóa trình duyệt E2E đa ứng dụng qua 9 checkpoint (`E2E-01` .. `E2E-09`): QR Order $\leftrightarrow$ POS Approval $\leftrightarrow$ Round 1 & 2 $\leftrightarrow$ Pre-bill $\leftrightarrow$ Cash Pay $\leftrightarrow$ Table Release. | **9** | **READY** |
| **`run-all-phase6.ts`** | 6.9 | Master Test Orchestrator điều phối toàn diện: Chế độ Dev (279 ca) & Chế độ Acceptance (365 ca). | N/A | **READY** |
| **`thermal-printer-spec.md`** | 6.9 | Tài liệu đặc tả kiến trúc máy in nhiệt ESC/POS 80mm chuẩn bị cho Phase 8 (Documentation only, zero code changes). | N/A | **DOCUMENTED** |

---

## 4. Bảng Đối Chiếu 365 Ca Test Hệ Sinh Thái (Test Count Reconciliation)

Khung nghiệm thu Phase 6 thống nhất tuyệt đối 365 ca test tự động, không tính trùng lặp:

```
┌────────────────────────────────────────────────────────────────────────┐
│  HỆ SINH THÁI KIỂM THỬ IMENU — 365 CA TEST TỰ ĐỘNG CHUẨN XÁC           │
├────────────────────────────────┬──────────────────────┬────────────────┤
│ Nhóm Kiểm Thử                  │ Tệp Nguồn / Vị Trí   │ Số Ca Test     │
├────────────────────────────────┼──────────────────────┼────────────────┤
│ 1. Phase 6 Backend (7 suites)  │ tests/phase-06-order │ 270            │
│ 2. Frontend SDK Contract       │ imenu-menudientu     │ 9              │
│ 3. Browser E2E (9 checkpoints) │ scripts/e2e-order    │ 9              │
│ 4. Phase 2–5 Regression        │ tests/phase-02..05   │ 77             │
├────────────────────────────────┴──────────────────────┼────────────────┤
│ TỔNG CỘNG HỆ SINH THÁI (ACCEPTANCE CLOSURE REQUIREMENT)│ 365 CA TEST    │
└───────────────────────────────────────────────────────┴────────────────┘
```

Phân bổ chi tiết 77 ca hồi quy Phases 2–5:
- **Phase 2:** 24 ca (`test.ts`: 12 ca + `test-multi-branch.ts`: 12 ca)
- **Phase 3:** 16 ca (`tests/phase-03-staff-rbac/test.ts`)
- **Phase 4:** 17 ca (`tests/phase-04-menu/test.ts`)
- **Phase 5:** 20 ca (`tests/phase-05-order-table-kds/test.ts`)

### 4.1. Danh mục 9 ca kiểm thử Frontend SDK Contract (`packages/utils/tests/sdk-contract.test.ts`):

Toàn bộ 9 ca kiểm thử hợp đồng SDK frontend được ánh xạ trực tiếp từ các assertion thực tế:

| Mã Ca Test | Phương Thức SDK & Trọng Tâm Xác Thực | Assertion Kỹ Thuật Thực Tế | Trạng Thái |
| :---: | :--- | :--- | :---: |
| **`SDK-01`** | `apiClient.customerOrders.getTableContext` | Ánh xạ chính xác `GET /api/orders/public/table-context` kèm query `restaurantSlug`, `tableCode`, `qrToken` | **PASS** |
| **`SDK-02`** | `apiClient.customerOrders.create` (Route) | Ánh xạ chính xác public endpoint `POST /api/orders/customer` | **PASS** |
| **`SDK-02b`**| `apiClient.customerOrders.create` (Header) | Truyền đúng header `idempotency-key` chống duplicate order | **PASS** |
| **`SDK-03`** | `apiClient.customerOrders.addItems` (Route) | Ánh xạ chính xác public endpoint `POST /api/orders/customer/items` | **PASS** |
| **`SDK-03b`**| `apiClient.customerOrders.addItems` (Header)| Truyền đúng header `idempotency-key` khi gọi thêm món đợt sau | **PASS** |
| **`SDK-04`** | `apiClient.orders.previewBill` | Ánh xạ chính xác route `GET /api/orders/:id/bill-preview` kèm query thuế/phí/chiết khấu | **PASS** |
| **`SDK-05`** | `apiClient.orders.pay` | Ánh xạ chính xác `POST /api/orders/:id/pay` và truyền header `idempotency-key` | **PASS** |
| **`SDK-06`** | `apiClient.tables` (Transfer/Merge/Move) | Ánh xạ chính xác các route thao tác bàn (`/tables/transfer`, `/tables/merge`, `/tables/move-items`) | **PASS** |
| **`SDK-07`** | `apiClient.orders` (Round Management) | Ánh xạ chính xác các route duyệt/hủy đợt gọi món (`/rounds/:roundNumber/confirm`, `/cancel`) | **PASS** |

---

## 5. Lệnh Thực Thi Kiểm Thử (Execution Commands)

Các kịch bản kiểm thử có thể thực thi thông qua NPM scripts chuẩn:

### 5.1. Hai Chế Độ Điều Phối Master Test Runner:
```powershell
# 1. Chế độ Phát triển (Developer Test Run)
# Chạy bắt buộc 270 backend + 9 SDK = 279 ca test. Cho phép SKIP đối với E2E nếu thiếu server UI.
npm run test:phase6:all

# 2. Chế độ Nghiệm thu Đóng Phase (Final Acceptance Run)
# BẮT BUỘC 100% cả 365 ca test (270 Backend + 9 SDK + 9 E2E + 77 Phases 2-5).
# CẤM TUYỆT ĐỐI mọi SKIP và BLOCKED.
npm run test:phase6:acceptance
```

### 5.2. Chạy Riêng Lẻ Từng Phân Hệ:
```powershell
# Phase 6 Backend Suites:
npm run test:phase6:transitions  # Sub-phase 6.2: State Machine (56 ca)
npm run test:phase6:pos          # Sub-phase 6.3: POS Cashier (30 ca)
npm run test:phase6:customer-qr  # Sub-phase 6.4: Customer QR (43 ca)
npm run test:phase6:concurrency  # Sub-phase 6.5: Idempotency (32 ca)
npm run test:phase6:sync         # Sub-phase 6.6: Table Sync (38 ca)
npm run test:phase6:query        # Sub-phase 6.7: Order Query (42 ca)
npm run test:phase6:integration  # Sub-phase 6.8: Frontend Monorepo Integration (29 ca)

# Chạy nhanh 6 suite backend cơ bản (241 ca):
npm run test:phase6

# Chạy kịch bản Browser E2E độc lập (Yêu cầu API:3001, Admin:3003, Menu:3005):
npm run test:phase6:e2e

# Chạy toàn bộ hồi quy Phases 2-5 (77 ca):
npm run test:regression:phase2-5
```

---

## 6. Cơ Chế Cô Lập Fixture & Dọn Dẹp An Toàn (Fixture Lifecycle)

Kịch bản E2E tuân thủ nghiêm ngặt nguyên tắc an toàn dữ liệu:
1. **Định danh duy nhất:** Tất cả tài nguyên phục vụ E2E mang tiền tố độc nhất `e2e_${Date.now()}` (ví dụ: `tbl-e2e-17734...`).
2. **Xác thực POS chính danh:** Sử dụng tài khoản seed `owner@sample.vn` để lấy JWT Bearer token và tạo bàn test cô lập qua `POST /api/tables`.
3. **Dọn dẹp trong `finally`:** Đảm bảo xóa đơn hàng kiểm thử và xóa bàn test (`DELETE /api/tables/:id`).
4. **Kiểm tra đối soát sau dọn dẹp (Cleanup Verification):** Thực hiện `GET /api/tables?search=${E2E_ID}` và khẳng định kết quả trả về là mảng rỗng (`data.length === 0`). Nếu còn sót, runner sẽ báo lỗi `CLEANUP_FAILURE`.

---

## 7. Ghi Chú Kiến Trúc & Kiểm Thử

1. **Bộ đệm độc lập từng tiến trình (Isolated Ports & Fixtures):** Mỗi tệp test backend tự động khởi tạo NestJS Application instance trên cổng mạng riêng biệt (từ 3098 đến 3105), tự sinh dữ liệu kiểm thử và dọn dẹp sạch sẽ tài nguyên.
2. **Partial Unique Index Guard:** Ràng buộc cấp cơ sở dữ liệu MongoDB `{ restaurantId: 1, tableId: 1 }` với `partialFilterExpression` đảm bảo một bàn chỉ có tối đa 1 đơn hàng hoạt động tại bất kỳ thời điểm nào.
3. **Atomic CAS State Transitions & OCC Retry:** Đổi bàn sử dụng thao tác nguyên tử `tableModel.findOneAndUpdate` để giải phóng bàn nguồn và chiếm bàn đích. Chuyển món và gộp bàn bọc trong vòng lặp retry 2 lần bắt ngoại lệ `VersionError` với jitter backoff.
4. **Hardware Thermal Printer Spec (Phase 8):** Phân tách rõ tầng Rendering hóa đơn (HTML/Canvas/PDF) và tầng Transport (WebUSB / Print Gateway), tham chiếu chi tiết tại `thermal-printer-spec.md`.
