# 🧪 Phase 11: Đánh Giá Khách Hàng Theo Chi Nhánh & Tải Hóa Đơn Điện Tử (Customer Review Per Branch & Digital Bill Download)

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)<br>
> **Phase:** 11 — Customer Review Per Branch, Atomic CAS Concurrency, Multi-Tenant Isolation, CSAT Analytics, Digital Bill Access Token Lifecycle & Canvas 2D Thermal Receipt Exporter<br>
> **Trạng thái phân hệ:** **✅ ĐÃ NGHIỆM THU — ĐÓNG CHÍNH THỨC & HOÀN TẤT TOÀN DIỆN (PHASE 11 CLOSURE GATE PASSED)**<br>
> **Quy ước kiến trúc:** `ONE PHASE = ONE TEST DIRECTORY` (Toàn bộ test artifacts của Phase 11 được lưu trữ tập trung tại thư mục này).

---

## 1. Mục Đích & Bối Cảnh (Phase 11 Purpose)

Phase 11 là mảnh ghép quan trọng hoàn thiện chu trình trải nghiệm ẩm thực F&B khép kín: **Khách hàng gọi món $\rightarrow$ Bếp chế biến $\rightarrow$ Phục vụ bàn $\rightarrow$ Thanh toán hóa đơn $\rightarrow$ Tải hóa đơn điện tử độc lập $\rightarrow$ Đánh giá chất lượng món ăn & phục vụ theo từng chi nhánh**.

Hệ thống giải quyết triệt để các bài toán vận hành và bảo mật trọng yếu:
1. **Thu thập phản hồi CSAT chân thực & Chống Spam Đánh Giá (Atomic CAS Guard)**: Đảm bảo mỗi đơn hàng chỉ được gửi đánh giá **duy nhất 1 lần**, chỉ cho phép đánh giá khi đơn đã gọi thanh toán hoặc hoàn tất, chống hoàn toàn Race Condition bằng khóa nguyên tử CAS.
2. **Bảo Mật Truy Cập & Chống Giả Mạo Bàn Ăn (Anti-IDOR & Session Validation)**: Khách tại bàn A không thể đánh giá hoặc đọc trộm đánh giá của bàn B.
3. **Tải Hóa Đơn Điện Tử Sau Khi Giải Phóng Bàn (Post-Settlement Digital Bill)**: Cấp phát mã `receiptAccessToken` dạng crypto hex 48 ký tự ngẫu nhiên, cho phép thực khách tra cứu và tải hóa đơn trong vòng **24 giờ** sau khi bàn đã giải phóng cho lượt khách mới.
4. **Phân Lập Đánh Giá Đa Chi Nhánh (Multi-Tenant Branch Isolation)**: Đánh giá được gắn chặt với `branchId`. Quản lý chi nhánh con chỉ xem và phản hồi đánh giá thuộc chi nhánh mình; không rò rỉ dữ liệu chéo chi nhánh. Chủ chuỗi (HQ) và Super Admin toàn quyền giám sát và tổng hợp CSAT toàn hệ thống.
5. **Kiểm Duyệt Nội Dung & Nhật Ký Kiểm Toán (Moderation & Activity Logs)**: Chỉ Chủ nhà hàng (Owner) và Super Admin mới có quyền ẩn/hiện đánh giá; mọi thao tác phản hồi và kiểm duyệt đều được ghi vết vào `activity-logs`.
6. **Hóa Đơn Nhiệt 2D Canvas Xuất Sắc Trên Frontend**: Bộ kết xuất hóa đơn nhiệt 80mm Retina 2D Canvas trên `@imenu/utils` xuất ảnh PNG sắc nét tải về điện thoại, tối ưu cho cả trình duyệt Safari iOS và in-app Zalo browser.

Theo chuẩn kiến trúc của dự án `imenu-api`:
> **Quy ước:** `ONE PHASE = ONE TEST DIRECTORY`  
> Toàn bộ các tệp kiểm thử tự động, runner điều phối và tài liệu kiểm thử của Phase 11 được lưu trữ thống nhất và tập trung trực tiếp tại thư mục `tests/phase-11-review-digital-bill/`.

---

## 2. Phạm Vi Nghiệp Vụ & Các Phân Hệ (Phase 11 Scope & Subsystems)

Phase 11 bao gồm 4 phân hệ cốt lõi:

1. **Phân hệ 11.1 — Gửi Đánh Giá Khách Hàng & Chống Trùng Lặp Nguyên Tử (Customer Review Submission & Atomic CAS):**
   - API công khai cho khách: `POST /api/reviews/customer` hỗ trợ 2 cơ chế xác thực phiên:
     * Cơ chế 1: Bộ 3 QR tại bàn `(restaurantSlug, tableCode, qrToken)` khi khách vẫn đang ngồi tại bàn.
     * Cơ chế 2: Mã truy cập hóa đơn `receiptAccessToken` khi khách đã rời bàn hoặc bàn đã được giải phóng.
   - Trạng thái hợp lệ (`AUD-11.2`): Chỉ cho phép gửi review khi đơn ở trạng thái `PaymentRequested` hoặc `Paid` (`isPaid: true`). Chặn các đơn đang mở hoặc đã hủy.
   - Chống Race Condition (`AUD-11.1`): Thực hiện Atomic CAS trên MongoDB `Order.findOneAndUpdate({ _id, isReviewed: { $ne: true } }, { $set: { isReviewed: true } })` kết hợp Unique Index `{ restaurantId: 1, orderId: 1 }`. Đua 10 request đồng thời chỉ có duy nhất 1 request thành công.
   - Chống IDOR (`AUD-11.3`): Xác thực nghiêm ngặt mã bàn và nhà hàng, chặn đứng hành vi giả mạo ID đơn hàng của bàn khác.
   - Thang điểm & Validation (`AUD-11.6`): `overallRating` (1–5 sao), `foodRating`, `serviceRating`, `ambianceRating`, `quickTags` (tối đa 10 tags), `comment` ($\le 500$ ký tự).
   - Phát sự kiện WebSocket Realtime: Bắn sự kiện `review:created` tới phòng chi nhánh `restaurant_${restaurantId}_branch_${branchId}`; tự động gắn cờ cảnh báo `isLowRatingAlert: true` khi đánh giá $\le 2$ sao.

2. **Phân hệ 11.2 — Phân Lập Chi Nhánh, Thống Kê CSAT & Kiểm Duyệt (Branch Isolation, CSAT & Moderation RBAC):**
   - Danh sách đánh giá có phân trang: `GET /api/reviews` hỗ trợ lọc theo `branchId`, `rating`, `hasReply`, `fromDate`, `toDate`, và tìm kiếm từ khóa.
   - Phân lập chi nhánh cưỡng chế (`AUD-11.5`): Quản lý chi nhánh con tự động bị giới hạn trong `user.branchId`. Mọi nỗ lực query chi nhánh khác đều bị chặn lọc. Chủ chuỗi có quyền xem toàn chuỗi hoặc chọn lọc theo từng chi nhánh.
   - Tổng quan chỉ số CSAT: `GET /api/reviews/summary` tính toán số lượng đánh giá, điểm trung bình toàn diện, món ăn, phục vụ, không gian, tỷ lệ 5 sao, tỷ lệ phản hồi, phân bố 1–5 sao, top tags và breakdown theo từng chi nhánh.
   - Quản lý gửi phản hồi: `POST /api/reviews/:id/reply` yêu cầu quyền `perm-review-reply`. Chặn quản lý chi nhánh phản hồi đánh giá của chi nhánh khác (403 Forbidden). Ghi nhận người trả lời và bắn `activity.log`.
   - Ẩn/Hiện kiểm duyệt (`AUD-11.7`): `PATCH /api/reviews/:id/toggle-hidden` chỉ dành riêng cho Chủ nhà hàng (`restaurant_admin`/`owner`) và Super Admin. Nhân viên quản lý thông thường bị từ chối 403 Forbidden.

3. **Phân hệ 11.3 — Vòng Đời Mã Hóa Đơn Điện Tử 24 Giờ & Tải Hóa Đơn (Digital Bill Download & 24h Expiration):**
   - Cấp phát mã `receiptAccessToken`: Tự động sinh mã ngẫu nhiên 48 ký tự hex khi tạo đơn, gọi thanh toán hoặc hoàn tất thanh toán. Được đánh chỉ mục `{ restaurantId: 1, receiptAccessToken: 1 }`.
   - Tải dữ liệu hóa đơn: `GET /api/orders/customer/:id/download-bill?receiptAccessToken=...` và `GET /api/orders/customer/:id/receipt?receiptAccessToken=...`.
   - Quy tắc thời hạn 24 giờ (`AUD-11.4`): Token chỉ khả dụng trong vòng 24 giờ kể từ thời điểm kết thúc đơn (`closedAt` / `paidAt`). Sau 24 giờ, hệ thống từ chối với HTTP 400 Bad Request.
   - Chống làm giả token: Mã token không khớp hoặc đơn hàng không tồn tại bị từ chối với HTTP 404 Not Found.

4. **Phân hệ 11.4 — Hợp Đồng Frontend SDK & Kết Xuất Hóa Đơn 2D Canvas (Frontend SDK Contract & Receipt Renderer):**
   - Mở rộng `@imenu/types`: `ReviewItem`, `ReviewSummaryResult`, `CreateCustomerReviewPayload`, `QueryReviewsParams`, và định danh thông báo `'REVIEW'`.
   - Bổ sung `@imenu/utils`:
     * `apiClient.reviews`: `createCustomerReview`, `getCustomerReviewByOrder`, `list`, `getSummary`, `reply`, `toggleHidden`.
     * `apiClient.customerOrders.downloadBill`: Tải cấu trúc hóa đơn bằng `receiptAccessToken`.
     * `renderReceiptToPngDataUrl`: Bộ kết xuất HTML5 Canvas 2D hóa đơn nhiệt 80mm Retina (640px, scale=2) xuất ảnh PNG Data URL sắc nét, hỗ trợ cả Node.js và trình duyệt.
   - Giao diện người dùng:
     * `apps/imenu-customer-menu`: Form đánh giá CSAT kèm các nút sao và quick tags, modal xem trước ảnh hóa đơn PNG thân thiện với Safari iOS / Zalo in-app browser.
     * `apps/imenu-admin`: Trang `/reviews` quản lý đánh giá toàn diện, thẻ KPI CSAT, biểu đồ 1–5 sao, bộ lọc chi nhánh, modal phản hồi nhanh và kiểm duyệt ẩn/hiện; menu sidebar và chuông báo realtime.

---

## 3. Danh Mục Tệp Kiểm Thử & Kiểm Toán (Test Inventory)

Toàn bộ các tệp kiểm thử tự động của Phase 11:

| Mã Suite | Tệp Kiểm Thử | Trọng Tâm Xác Thực | Số Ca Test | Trạng Thái |
| :---: | :--- | :--- | :---: | :---: |
| **P11-01** | `customer-review-submission.test.ts` (Port 3129) | Khách gửi đánh giá, State Machine Guard (`PaymentRequested`/`Paid`), cờ `isReviewed` & `reviewId`, chặn trùng lặp, Atomic CAS Concurrency 10 reqs (`AUD-11.1`), chống IDOR (`AUD-11.3`), validation rating $\le 5$ & comment $\le 500$ ký tự, đọc lại review theo đơn hàng. | **11** | **PASS** |
| **P11-02** | `branch-review-isolation.test.ts` (Port 3130) | Phân lập đánh giá đa chi nhánh (`AUD-11.5`), ngăn chặn bypass filter chi nhánh, quyền xem toàn chuỗi của HQ Owner, tổng hợp CSAT (`/reviews/summary`), quản lý gửi phản hồi, chặn phản hồi chéo chi nhánh (403), quyền ẩn/hiện kiểm duyệt chỉ dành cho Owner (`AUD-11.7`), RBAC `perm-review-view`. | **9** | **PASS** |
| **P11-03** | `digital-bill-download.test.ts` (Port 3131) | Sinh mã `receiptAccessToken` ngẫu nhiên 48 hex, chỉ mục tối ưu, chặn token giả mạo (404), hết hạn sau 24 giờ (`AUD-11.4` -> 400 Bad Request), tải thành công trong 24 giờ, endpoint `GET customer/:id/receipt` chấp nhận token cho khách. | **7** | **PASS** |
| **P11-SDK**| `packages/utils/tests/sdk-contract.test.ts`<br>*(tại `imenu-menudientu`)* | Hợp đồng API Frontend SDK đầy đủ: `customerOrders.downloadBill` (SDK-33), `reviews.createCustomerReview` (SDK-34), `reviews.getCustomerReviewByOrder` (SDK-35), `reviews.list` (SDK-36), `reviews.getSummary & reply` (SDK-37), `renderReceiptToPngDataUrl` xuất ảnh hóa đơn 80mm Retina (SDK-38) cùng 32 ca test kế thừa. | **40** | **PASS** |
| **MASTER** | `run-all-phase11.ts` | Master Test Orchestrator Phase 11: Tự động điều phối 4 test suites (67 test cases) ở cả 2 chế độ Developer Run và Final Acceptance Run. | N/A | **READY** |

---

## 4. Bảng Đối Chiếu Số Lượng Ca Test Toàn Hệ Sinh Thái (Test Reconciliation Matrix)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  HỆ SINH THÁI KIỂM THỬ IMENU — ĐỐI CHIẾU 710 CA TEST TỰ ĐỘNG CHUẨN XÁC (PHASES 2 -> 11)│
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Phân Hệ Kiểm Thử               │ Vị Trí / Tệp Kiểm Thử         │ Số Ca Test Thực Tế     │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ 1. Phase 11 Review & Bill      │ tests/phase-11-review-digital│ 67 (27 BE + 40 SDK)    │
│    - Customer Review Submission│ tests/phase-11-review-digital│ 11                     │
│    - Branch Review Isolation   │ tests/phase-11-review-digital│ 9                      │
│    - Digital Bill Download     │ tests/phase-11-review-digital│ 7                      │
│    - Frontend SDK Contract P11 │ packages/utils/tests/        │ 40 (6 mới + 34 kế thừa)│
│ 2. Phase 10 Realtime & Ecosyst │ tests/phase-10-realtime/     │ 85 (51 BE + 34 SDK+E2E)│
│ 3. Phase 9 Dashboard & Reports │ tests/phase-09-dashboard-rep/│ 57 (53 BE + 4 E2E)     │
│ 4. Phase 8 Payment & Bill      │ tests/phase-08-payment-bill/ │ 98 (66 BE + 27 SDK+5E2E│
│ 5. Phase 7 Kitchen / KDS       │ tests/phase-07-kitchen-kds/  │ 50 (30 BE + 14 SDK+6E2E│
│ 6. Phase 6 Orders & POS        │ tests/phase-06-order-pos/    │ 279 (270 BE + 9 SDK)   │
│ 7. Phases 2–5 Core Regressions │ tests/phase-02..05/          │ 74                     │
├────────────────────────────────┴──────────────────────────────┴────────────────────────┤
│ TỔNG CỘNG HỆ SINH THÁI (ACCEPTANCE CLOSURE REQUIREMENT)        │ 710 CA TEST (RUNNERS)  │
│  - Số ca test đã vượt qua tuyệt đối (Developer/CI Run):        │ 710 / 710 PASS (100%)  │
│  - Trạng thái kiểm thử đối kháng & hồi quy:                    │ 0 FAIL, 0 BLOCKED      │
│  - Trạng thái nghiệm thu toàn bộ lộ trình 11 Phases:           │ ✅ HOÀN TẤT & NGHIỆM THU│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Hướng Dẫn Thực Thi Kiểm Thử (How to Run Phase 11 Tests)

### Chạy toàn bộ bộ kiểm thử Phase 11:
```powershell
# Chế độ nghiệm thu đóng Phase 11 (Acceptance Run - Closure Gate):
npm run test:phase11:acceptance

# Hoặc chế độ phát triển chuẩn (Developer Run):
npm run test:phase11:all
```

### Chạy riêng lẻ từng bộ kiểm thử của Phase 11:
```powershell
npm run test:phase11:submission # Suite 1: Khách gửi đánh giá & Atomic CAS (11 ca)
npm run test:phase11:isolation  # Suite 2: Phân lập chi nhánh & Moderation RBAC (9 ca)
npm run test:phase11:bill       # Suite 3: Mã hóa đơn điện tử & Hết hạn 24 giờ (7 ca)
npm run test:phase11            # Chạy cả 3 suite Backend liên tiếp (27 ca)
```

### Chạy kiểm thử Frontend SDK Contract độc lập:
```powershell
# Chuyển tới thư mục packages/utils trong imenu-menudientu:
cd ../imenu-menudientu/packages/utils
npx ts-node tests/sdk-contract.test.ts
```
