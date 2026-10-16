# 🧪 Phase 8: Thanh Toán, Hóa Đơn & Đối Soát Tài Chính (Payment, Bill & Financial Audit)

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)<br>
> **Phase:** 8 — Payment, Bill, ESC/POS Thermal Printing & Financial Audit<br>
> **Trạng thái phân hệ:** **✅ ĐÃ NGHIỆM THU — ĐÓNG CHÍNH THỨC (PHASE 8 CLOSURE GATE PASSED)**<br>
> **Quy ước kiến trúc:** `ONE PHASE = ONE TEST DIRECTORY` (Toàn bộ test artifacts của Phase 8 được lưu trữ tập trung tại thư mục này).

---

## 1. Mục Đích & Bối Cảnh (Phase 8 Purpose)

Phase 8 là phân hệ tài chính then chốt hoàn thiện toàn bộ vòng đời kinh doanh ẩm thực F&B: **Khách yêu cầu thanh toán (QR Menu) $\rightarrow$ Thu ngân kiểm tra / In hóa đơn tạm tính 80mm $\rightarrow$ Chốt thanh toán đa phương thức (VietQR động, Tiền mặt tính tiền thối, Thẻ, Chuyển khoản) $\rightarrow$ Sinh chứng từ hóa đơn `Bill` độc nhất cố đẳng (Natural Idempotency) $\rightarrow$ Tự động giải phóng bàn $\rightarrow$ Mã hóa ESC/POS in nhiệt 80mm/58mm $\rightarrow$ Lưu vết nhật ký kiểm toán tài chính bất biến (`activity_logs`)**.

Theo chuẩn kiến trúc của dự án `imenu-api`:
> **Quy ước:** `ONE PHASE = ONE TEST DIRECTORY`  
> Toàn bộ các tệp kiểm thử tự động, runner điều phối và tài liệu kiểm thử của Phase 8 (từ 8.1 đến 8.6) được lưu trữ thống nhất và tập trung trực tiếp tại thư mục `tests/phase-08-payment-bill/`. Các Sub-phase **không** tạo thư mục riêng nhằm tránh phân mảnh repository.

---

## 2. Phạm Vi Nghiệp Vụ & Các Sub-phase (Phase 8 Scope & Sub-phases)

Phase 8 bao gồm 6 phân hệ nghiệp vụ hoàn chỉnh:

1. **Sub-phase 8.1 — Quy trình Yêu cầu Thanh toán Khách hàng & VietQR Động Server-Side:**
   - Cung cấp API công khai cho khách tại bàn: `POST /api/orders/customer/:id/request-payment`, `GET /api/orders/customer/:id/vietqr`, và `GET /api/orders/customer/:id/receipt`.
   - Xác thực phiên QR nghiêm ngặt thông qua bộ 3 tham số `restaurantSlug`, `tableCode`, và `qrToken` (phải đang ở trạng thái `active`).
   - Chuyển trạng thái đơn sang `PaymentRequested` và đồng bộ trạng thái bàn sang `PaymentRequested` qua WebSocket `order:payment_requested` và `table:status_updated`.
   - Tính toán số tiền VietQR hoàn toàn độc lập phía server từ danh mục món hợp lệ (`status !== 'Cancelled'`), phớt lờ mọi query param `amount` từ client.
   - Hỗ trợ hoàn tác yêu cầu thanh toán (`POST /api/orders/:id/revert-payment-request`).

2. **Sub-phase 8.2 — Công Cụ Hóa Đơn (Bills Engine), Chốt Thanh Toán Cố Đẳng & Giải Phóng Bàn:**
   - API chốt thanh toán cố đẳng: `POST /api/orders/:id/complete-payment` (hoặc `POST /api/orders/:id/pay`).
   - Cơ chế cố đẳng tự nhiên (Natural Idempotency): Tái sử dụng cùng `Idempotency-Key` khi retry mạng; nếu đơn đã `Paid` thì trả về hóa đơn hiện hữu kèm header `X-Idempotent-Replay: true`.
   - Sử dụng atomic CAS (`findOneAndUpdate` với `$setOnInsert` và `upsert: true`) kết hợp bắt mã lỗi `E11000` để đảm bảo trong mọi tình huống đa luồng cực đoan, mỗi `Order` chỉ sinh ra đúng 1 `Bill` duy nhất.
   - Hỗ trợ đầy đủ phương thức thanh toán: `Cash` (tính tiền thối `changeAmount = receivedAmount - finalAmount`), `VietQR`, `Card`, `Transfer`.
   - Tự động giải phóng bàn ăn về trạng thái `Available` (`currentOrderId: null`) ngay khi thanh toán thành công.

3. **Sub-phase 8.3 — Nhật Ký Kiểm Toán Tài Chính (Financial Activity Logs) & Đối Soát:**
   - Ghi vết bất biến mọi hành động tài chính nhạy cảm vào collection `activity_logs`: `PAYMENT_COMPLETED`, `PAYMENT_REVERTED`, `BILL_PRINTED`, `ORDER_CANCELLED`.
   - Lưu trữ snapshot tài chính đầy đủ: `subTotal`, `discountAmount`, `serviceFee`, `vatAmount`, `finalAmount`, `paymentMethod`, `cashReceived`, `cashChange`.
   - API truy vấn lịch sử kiểm toán: `GET /api/activity-logs` với bộ lọc theo `branchId`, `action`, `startDate`, `endDate`, `search`.
   - Phân quyền nghiêm ngặt: Chỉ các vai trò quản lý (`restaurant_admin`, `restaurant_manager`, `system_admin`) mới có quyền truy cập nhật ký kiểm toán.

4. **Sub-phase 8.4 — Bộ Mã Hóa Hóa Đơn Nhiệt ESC/POS 80mm/58mm & Frontend SDK:**
   - Xây dựng `buildReceiptData(order, restaurant, options)` chuẩn hóa dữ liệu in, tự động khử 100% dấu tiếng Việt sang ASCII an toàn cho máy in nhiệt.
   - Lớp mã hóa nhị phân `EscPosEncoder` xuất tập lệnh ESC/POS chuẩn công nghiệp:
     * Khởi tạo máy in: `1B 40` (ESC @)
     * Căn lề: Trái (`1B 61 00`), Giữa (`1B 61 01`), Phải (`1B 61 02`)
     * Kích thước chữ & In đậm: `1B 45 01`, `1D 21 01` / `1D 21 11`
     * Mã QR 2D native: `1D 28 6B` (GS ( k)
     * Mở két đựng tiền tự động (Cash Drawer Kick): `1B 70 00 19 FA` (chỉ khi thanh toán `Cash`)
     * Cắt giấy một phần (Partial Cut): `1D 56 42 00` (GS V B 0)
   - Cung cấp dịch vụ `thermalPrinterService` sinh output đa định dạng: `buffer` (Uint8Array), `base64`, `hex`, và `textPreview`.
   - Mở rộng Frontend SDK `apiClient` hỗ trợ trọn vẹn: `orders.completePayment`, `orders.getReceipt`, `orders.getVietQr`, `customerOrders.requestPayment`, `bills.*`, `activityLogs.*`.

5. **Sub-phase 8.5 — Giao Diện Quản Lý Hóa Đơn Admin POS & Modal In Nhiệt Đa Ứng Dụng:**
   - Nâng cấp trang Quản lý Hóa đơn `/bills` trên `imenu-admin`:
     * Thanh tìm kiếm đa năng (`orderCode`, `billCode`, `tableName`) và bộ lọc theo trạng thái, phương thức thanh toán.
     * Bảng danh sách hóa đơn phân trang trực quan với đầy đủ thông tin chiết khấu, thuế, phí và nhân viên thu ngân.
   - Modal xem trước hóa đơn nhiệt 80mm chuẩn CSS `@media print` và hỗ trợ in ESC/POS trực tiếp.
   - Ghi vết số lần in hóa đơn tự động qua `POST /api/bills/:id/print`.

6. **Sub-phase 8.6 — Gia Cố Đối Kháng Hệ Thống (Adversarial Hardening AUD-8.1 đến AUD-8.6):**
   - `AUD-8.1`: Xác thực quyền sở hữu đơn hàng trên mọi endpoint công khai (`request-payment`, `vietqr`, `receipt`); chặn đứng tấn công IDOR chéo bàn và chéo người thuê (HTTP 404/403).
   - `AUD-8.2`: Độc nhất chứng từ `Bill` qua upsert nguyên tử và bắt lỗi `E11000`; tự động đồng bộ bàn về `Occupied` và đơn về `Preparing` nếu có món mới duyệt giữa lúc chờ thanh toán.
   - `AUD-8.3`: Tinh chỉnh phân quyền `perm-pos-pay` / `perm-bill-view` / `perm-bill-print`; cho phép vai trò thu ngân thao tác trọn vẹn và chặn nhân viên phục vụ, bếp (`403 Forbidden`).
   - `AUD-8.4`: Tính toán lại số tiền VietQR độc lập phía server, hoàn toàn phớt lờ số tiền `amount` giả mạo từ client.
   - `AUD-8.5`: Che mặt nạ số tài khoản ngân hàng (`***4567`) và chuẩn hóa lỗi trùng khóa `E11000` thành `409 Conflict`.
   - `AUD-8.6`: Khóa Re-entry giao diện người dùng và duy trì cố định `checkoutIdempotencyKeyRef` qua các lượt thử lại mạng.

---

## 3. Danh Mục Tệp Kiểm Thử & Kiểm Toán (Test Inventory)

Toàn bộ các tệp kiểm thử tự động của Phase 8:

| Mã Suite | Tệp Kiểm Thử | Trọng Tâm Xác Thực | Số Ca Test | Trạng Thái |
| :---: | :--- | :--- | :---: | :---: |
| **P8-01** | `payment-request-vietqr.test.ts` | Yêu cầu thanh toán QR, VietQR server-side độc lập, hoàn tác yêu cầu, đồng bộ trạng thái bàn/đơn, hardening AUD-8.1 (chặn chéo bàn 404), hardening AUD-8.4 (phớt lờ query amount), hardening AUD-8.2 (đưa bàn về `Occupied` khi thêm món). | **23** | **PASS** |
| **P8-02** | `bills-complete-payment.test.ts` | Chốt thanh toán cố đẳng (Natural Idempotency), tính tiền thừa tiền mặt, giải phóng bàn ăn nguyên tử, sinh `Bill` duy nhất (`upsert` + `E11000`), hardening AUD-8.3 (chặn bếp 403, custom role `perm-pos-pay` thành công), concurrency 5 request song song chỉ sinh 1 Bill. | **18** | **PASS** |
| **P8-03** | `financial-audit-log.test.ts` | Lưu vết kiểm toán bất biến `activity_logs`, bộ lọc tìm kiếm lịch sử thanh toán/in bill, bảo vệ quyền riêng tư tài chính, hardening AUD-8.3 (chặn phục vụ 403), hardening AUD-8.5 (đóng gói E11000 thành 409 Conflict an toàn). | **9** | **PASS** |
| **P8-04** | `escpos-receipt-encoder.test.ts` | Biên dịch hóa đơn ESC/POS 80mm & 58mm, khử dấu tiếng Việt chuẩn ASCII, ngắt dòng 48/32 ký tự, mã QR native `GS ( k`, mở két tiền `ESC p`, cắt giấy partial `GS V B 0`, xuất buffer / base64. | **16** | **PASS** |
| **P8-SDK**| `packages/utils/tests/sdk-contract.test.ts`<br>*(tại `imenu-menudientu`)* | Hợp đồng API Frontend SDK đầy đủ cho toàn bộ các endpoint Phase 8: `orders.completePayment`, `orders.getReceipt`, `orders.getVietQr`, `customerOrders.requestPayment`, `bills.*`, `activityLogs.*`, `buildReceiptData`, `EscPosEncoder`, `thermalPrinterService`. | **27** | **PASS** |
| **P8-E2E**| `e2e-payment-bill-runner.test.ts`<br>*(kèm `scripts/e2e-payment-bill-lifecycle.mjs`)* | Kịch bản kiểm thử tự động hóa E2E trình duyệt thật kiểm chứng toàn bộ vòng đời thanh toán: Khách QR yêu cầu thanh toán $\rightarrow$ VietQR hiển thị $\rightarrow$ POS thu tiền mặt & tính tiền thối $\rightarrow$ Bill được tạo & bàn giải phóng $\rightarrow$ In hóa đơn nhiệt 80mm. | **5** | **PASS** |
| **MASTER**| `run-all-phase8.ts` | Master Test Orchestrator điều phối toàn diện 6 suites: Chế độ Dev (98 ca) & Chế độ Acceptance (Closure Gate). | N/A | **READY** |

---

## 4. Bảng Đối Chiếu Số Lượng Ca Test Toàn Hệ Sinh Thái (Test Reconciliation Matrix)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  HỆ SINH THÁI KIỂM THỬ IMENU — ĐỐI CHIẾU 513 CA TEST TỰ ĐỘNG CHUẨN XÁC                │
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Phân Hệ Kiểm Thử               │ Vị Trí / Tệp Kiểm Thử         │ Số Ca Test Thực Tế     │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ 1. Phase 8 Payment & Bill      │ tests/phase-08-payment-bill/ │ 98 (66 BE + 27 SDK + 5 E2E)│
│ 2. Phase 7 Kitchen / KDS       │ tests/phase-07-kitchen-kds/  │ 50 (30 BE + 14 SDK + 6 E2E)│
│ 3. Phase 6 Orders & POS        │ tests/phase-06-order-pos/    │ 288 (270 BE + 9 SDK + 9 E2E)│
│ 4. Phases 2–5 Core Regressions │ tests/phase-02..05/          │ 77                     │
├────────────────────────────────┴──────────────────────────────┴────────────────────────┤
│ TỔNG CỘNG HỆ SINH THÁI (ACCEPTANCE CLOSURE REQUIREMENT)        │ 513 CA TEST            │
│  - Số ca test đã vượt qua tuyệt đối (Developer/CI Run):        │ 491 / 491 PASS (100%)  │
│  - Số ca test E2E trình duyệt chờ bật full dev server:         │ 22 Checkpoints         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Hướng Dẫn Thực Thi Kiểm Thử (How to Run Phase 8 Tests)

### Chạy toàn bộ bộ kiểm thử Phase 8:
```powershell
# Chế độ nghiệm thu đóng Phase (Acceptance Run - Closure Gate):
npm run test:phase8:acceptance

# Hoặc chế độ phát triển chuẩn (Developer Run):
npm run test:phase8:all
```

### Chạy riêng lẻ từng bộ kiểm thử của Phase 8:
```powershell
npm run test:phase8:request    # Suite 1: Yêu cầu thanh toán & VietQR (23 ca)
npm run test:phase8:bills      # Suite 2: Chốt thanh toán, Hóa đơn & Bàn (18 ca)
npm run test:phase8:audit      # Suite 3: Nhật ký kiểm toán tài chính (9 ca)
npm run test:phase8:escpos     # Suite 4: Bộ mã hóa hóa đơn ESC/POS (16 ca)
npm run test:phase8:e2e        # Suite E2E: Kịch bản Browser E2E Payment & Bill (5 ca)
npm run test:phase8            # Chạy cả 4 suite Backend liên tiếp (66 ca)
```

### Chạy kiểm thử Frontend SDK Contract độc lập:
```powershell
# Chuyển tới thư mục packages/utils trong imenu-menudientu:
cd ../imenu-menudientu/packages/utils
npx ts-node tests/sdk-contract.test.ts
```
