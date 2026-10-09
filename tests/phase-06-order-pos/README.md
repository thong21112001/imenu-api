# 🧪 Phase 6: Vận Hành Order, POS & Đồng Bộ Bàn Ăn (Order & POS Lifecycle)

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Phase:** 6 — Order & POS Lifecycle  
> **Trạng thái hiện tại:** **HOÀN THÀNH TOÀN DIỆN & ĐÃ ĐÓNG (PHASE 6.6 CLOSED)**  
> **Kiến trúc thư mục:** `ONE PHASE = ONE TEST DIRECTORY` (Tất cả test artifacts của Phase 6 được lưu trữ tập trung tại thư mục này).

---

## 1. Mục Đích & Bối Cảnh (Phase 6 Purpose)

Phase 6 là giai đoạn trọng yếu triển khai toàn bộ luồng vận hành đơn hàng (Order Lifecycle), máy bán hàng thu ngân (POS Cashier), luồng khách gọi món qua QR (Customer QR), cơ chế kiểm soát giao dịch trùng lặp / tranh chấp đồng thời (Idempotency & Concurrency) và đồng bộ trạng thái giữa bàn ăn với đơn hàng (Table ↔ Order Synchronization).

Theo quy ước chuẩn kiến trúc của dự án `imenu-api`:
> **Quy ước:** `ONE PHASE = ONE DIRECTORY`  
> Mặc dù Phase 6 bao gồm nhiều Sub-phase nghiệp vụ (từ 6.1 đến 6.6), toàn bộ các tệp kiểm thử tự động của Phase 6 được lưu trữ thống nhất và tập trung trực tiếp tại thư mục `tests/phase-06-order-pos/`. Các Sub-phase **không** tạo thư mục riêng nhằm tránh phân mảnh repository.

---

## 2. Phạm Vi Nghiệp Vụ & Các Sub-phase (Phase 6 Scope & Sub-phases)

Phase 6 bao gồm 7 phân hệ nghiệp vụ chính:

1. **Sub-phase 6.1 — Core Order & Table Lifecycle Baseline:** Thiết lập nền tảng vòng đời đơn hàng, liên kết bàn ăn và cấu trúc dữ liệu đợt gọi món (`rounds[]`), danh sách món (`items[]`).
2. **Sub-phase 6.2 — State Machine & Business Invariants:** Máy trạng thái chuyển đổi đơn hàng và bàn ăn, ràng buộc bất biến (Single active order per table, Paid is Terminal, RBAC chuyển trạng thái).
3. **Sub-phase 6.3 — POS Cashier & Billing Flows:** Nghiệp vụ thu ngân POS, hóa đơn, tính thuế VAT, phí dịch vụ, chiết khấu, thanh toán tiền mặt Cash (tính tiền thừa `changeAmount`), thanh toán VietQR và thanh toán nhanh (Quick-pay).
4. **Sub-phase 6.4 — Customer QR Ordering:** Khách quét mã QR tại bàn, xem thực đơn công khai, gửi yêu cầu gọi món theo đợt (`WaitingConfirmation`), nhân viên thu ngân/phục vụ xác nhận (`Confirmed`), bảo vệ chống mở đơn trùng lặp.
5. **Sub-phase 6.5 — Idempotency Key & Concurrency Control:** Middleware Idempotency Key (`X-Idempotency-Key`) chặn đứng request trùng lặp, cơ chế khóa nguyên tử thanh toán POS đa luồng (`Atomic Payment Claim`), bảo vệ bất biến tài chính.
6. **Sub-phase 6.6 — Table ↔ Order Synchronization & Transfer/Merge:** Thắt chặt đồng bộ giữa bàn ăn và đơn hàng, đổi bàn (`transferTable`), gộp bàn (`mergeTables`), di chuyển món / tách bàn (`moveItemsBetweenTables`), tách hóa đơn (Split Bill), khóa nguyên tử CAS (Compare-And-Swap) và Optimistic Concurrency Control (OCC) Retry.
7. **Sub-phase 6.7 — Order Query, Filters, Search & Multi-Branch Optimization (IMPLEMENTED):** Nâng cấp toàn diện API truy vấn đơn hàng `GET /api/orders` (lọc khoảng thời gian `fromDate`/`toDate`, trường thời gian `dateField`, nhân viên `staffId`/`createdBy`/`paidBy`, đa trạng thái, phương thức thanh toán `paymentMethod`, tìm kiếm an toàn `orderCode`/`tableName`, phân trang ổn định kèm `totalPages`, deterministic sorting với tie-breaker `_id: -1`, cưỡng chế phân lập chi nhánh và compound indexes).

---

## 3. Danh Mục Tệp Kiểm Thử (Test Inventory)

Toàn bộ 6 tệp kiểm thử của Phase 6 nằm trực tiếp trong thư mục này:

| Tệp Kiểm Thử | Sub-phase | Trọng Tâm Xác Thực | Số Ca Test | Trạng Thái |
| :--- | :---: | :--- | :---: | :---: |
| **`state-machine.test.ts`** | 6.2 | Chuyển đổi trạng thái đơn hàng (`WaitingConfirmation` $\rightarrow$ `Preparing` $\rightarrow$ `Ready` $\rightarrow$ `Served` $\rightarrow$ `Paid` / `Cancelled`), duyệt/hủy round, hủy món, tính lại `subTotal`, RBAC nhân viên. | **56** | **PASS** |
| **`pos-cashier.test.ts`** | 6.3 | Thu ngân POS, tính toán tài chính (VAT, phí dịch vụ, giảm giá), thanh toán Cash (tính tiền thừa), thanh toán VietQR, quick-pay, chặn thêm món vào đơn đã Paid, phân lập chi nhánh và nhà hàng. | **30** | **PASS** |
| **`customer-qr.test.ts`** | 6.4 | Khách quét QR gọi món, tạo round `WaitingConfirmation`, nhân viên xác nhận món, giới hạn bàn, bảo mật QR token, phân lập nhà hàng và chi nhánh. | **43** | **PASS** |
| **`idempotency-concurrency.test.ts`** | 6.5 | Header `X-Idempotency-Key` tái phát hiện request trùng lặp (replay cached response), thanh toán đồng thời qua `Promise.all` (đúng 1 thành công, 1 bị từ chối), zero duplicate charge. | **32** | **PASS** |
| **`table-order-sync.test.ts`** | 6.6 | Đổi bàn (`transferTable`), gộp bàn (`mergeTables`), di chuyển món (`moveItemsBetweenTables`), tách bill, khóa CAS chống race transfer, OCC retry chống xung đột phiên bản Mongoose, kiểm thử hồi quy defect. | **38** | **PASS** |
| **`order-query.test.ts`** | 6.7 | Lọc thời gian, nhân sự, đa trạng thái, phương thức thanh toán, regex search an toàn, phân trang xác định, cách ly chi nhánh tuyệt đối, xác minh explain index scan. | **38** | **PASS** |

---

## 4. Lệnh Thực Thi Kiểm Thử (Execution Commands)

Các kịch bản kiểm thử có thể thực thi đơn lẻ hoặc toàn bộ thông qua NPM scripts được định nghĩa trong `package.json`:

```powershell
# 1. Chạy kiểm thử Máy trạng thái & Invariants (Phase 6.2)
npm run test:phase6:transitions
# Lệnh trực tiếp:
npx ts-node tests/phase-06-order-pos/state-machine.test.ts

# 2. Chạy kiểm thử Thu ngân & Hóa đơn POS (Phase 6.3)
npm run test:phase6:pos
# Lệnh trực tiếp:
npx ts-node tests/phase-06-order-pos/pos-cashier.test.ts

# 3. Chạy kiểm thử Khách quét QR gọi món (Phase 6.4)
npm run test:phase6:customer-qr
# Lệnh trực tiếp:
npx ts-node tests/phase-06-order-pos/customer-qr.test.ts

# 4. Chạy kiểm thử Idempotency & Concurrency (Phase 6.5)
npm run test:phase6:concurrency
# Lệnh trực tiếp:
npx ts-node tests/phase-06-order-pos/idempotency-concurrency.test.ts

# 5. Chạy kiểm thử Đồng bộ Bàn, Đổi/Gộp bàn & Di chuyển món (Phase 6.6)
npm run test:phase6:sync
# Lệnh trực tiếp:
npx ts-node tests/phase-06-order-pos/table-order-sync.test.ts

# 6. Chạy kiểm thử Truy vấn, Lọc, Tìm kiếm & Phân lập Đa Chi nhánh (Phase 6.7)
npm run test:phase6:query
# Lệnh trực tiếp:
npx ts-node tests/phase-06-order-pos/order-query.test.ts

# 7. Chạy toàn bộ test suite của Phase 6 (Tất cả 6 tệp kiểm thử)
npm run test:phase6
```

---

## 5. Trạng Thái Hiện Tại (Current Status)

- **Trạng thái Sub-phase 6.7:** **KIỂM THỬ HOÀN TẤT (VERIFIED & PASSED)**, đạt 38/38 ca test tự động PASS 100%.
- **Toàn bộ Phase 6:** 237 ca test tự động vượt qua (100% Passed, Zero Failures).


---

## 6. Phạm Vi Kiểm Thử Hồi Quy (Regression Coverage)

Khi thực hiện thay đổi mã nguồn bất kỳ, toàn bộ chuỗi kiểm thử hồi quy sau phải đạt 100%:
- **Phase 5 Integration Suite:** `npm run test:phase5` (18 ca test — Quản lý bàn, đơn hàng & KDS WebSocket).
- **Phase 6.2 State Machine Suite:** `npm run test:phase6:transitions` (56 ca test).
- **Phase 6.3 POS Cashier Suite:** `npm run test:phase6:pos` (30 ca test).
- **Phase 6.6 Table Sync Suite:** `npm run test:phase6:sync` (38 ca test).
- **Tổng số ca kiểm thử tự động toàn diện:** **142 ca test vượt qua (100% Passed, Zero Failures)**.

---

## 7. Ghi Chú Kiến Trúc & Kiểm Thử (Architectural Notes)

1. **Bộ đệm độc lập từng tiến trình (Isolated Ports & Fixtures):** Mỗi tệp test tự động khởi tạo NestJS Application instance trên cổng mạng riêng biệt (ví dụ `3098`, `3099`, `3100`, `3101`), tự sinh dữ liệu kiểm thử (Fixtures) với timestamp độc nhất, và tự động dọn dẹp sạch sẽ tài nguyên cơ sở dữ liệu (`Teardown Zero Garbage`).
2. **Partial Unique Index Guard:** Ràng buộc cấp cơ sở dữ liệu MongoDB `{ restaurantId: 1, tableId: 1 }` với `partialFilterExpression` đảm bảo một bàn chỉ có tối đa 1 đơn hàng hoạt động tại bất kỳ thời điểm nào.
3. **Atomic CAS State Transitions:** Đổi bàn sử dụng thao tác nguyên tử `tableModel.findOneAndUpdate` để giải phóng bàn nguồn và chiếm bàn đích, có cơ chế rollback tự động nếu bàn đích có tranh chấp.
4. **Optimistic Concurrency Control (OCC):** Chuyển món và gộp bàn bọc trong vòng lặp retry 2 lần bắt ngoại lệ `VersionError` với jitter backoff, loại bỏ hoàn toàn lỗi hệ thống 500 khi có tranh chấp đồng thời.
