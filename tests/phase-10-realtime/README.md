# 🧪 Phase 10: Thời Gian Thực, Phân Lập Phòng WebSocket & Hoàn Thiện Hệ Sinh Thái (Realtime & Ecosystem Finalization)

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)<br>
> **Phase:** 10 — Realtime WebSocket Gateway, Room Security & Isolation, Domain Events Matrix, Call Staff Flow, Client Resilience & Multi-Tab Ecosystem E2E<br>
> **Trạng thái phân hệ:** **✅ ĐÃ NGHIỆM THU — ĐÓNG CHÍNH THỨC & HOÀN TẤT TOÀN BỘ LỘ TRÌNH 10 PHASES (PHASE 10 CLOSURE GATE PASSED)**<br>
> **Quy ước kiến trúc:** `ONE PHASE = ONE TEST DIRECTORY` (Toàn bộ test artifacts của Phase 10 được lưu trữ tập trung tại thư mục này).

---

## 1. Mục Đích & Bối Cảnh (Phase 10 Purpose)

Phase 10 là chặng phát triển cuối cùng và là đỉnh cao tích hợp của toàn bộ lộ trình hệ sinh thái iMenu: **Khách gọi nhân viên tại bàn (Call Staff) kèm phản hồi hai chiều $\rightarrow$ Bảo mật phân lập phòng WebSocket cấp nhà hàng, chi nhánh & bàn ăn $\rightarrow$ Chuẩn hóa ma trận sự kiện miền thời gian thực (7 nhóm Domain Events) $\rightarrow$ Đảm bảo độ bền bỉ & chống trùng lặp sự kiện Client Frontend $\rightarrow$ Kiểm thử trình duyệt E2E đa tab đồng bộ hóa thời gian thực (Customer ↔ Admin POS ↔ Kitchen KDS) $\rightarrow$ Gia cố bảo mật đối kháng toàn diện (AUD-10.1 đến AUD-10.6)**.

Theo chuẩn kiến trúc của dự án `imenu-api`:
> **Quy ước:** `ONE PHASE = ONE TEST DIRECTORY`  
> Toàn bộ các tệp kiểm thử tự động, runner điều phối và tài liệu kiểm thử của Phase 10 (từ 10.1 đến 10.6) được lưu trữ thống nhất và tập trung trực tiếp tại thư mục `tests/phase-10-realtime/`. Các Sub-phase **không** tạo thư mục con riêng nhằm tránh phân mảnh repository.

---

## 2. Phạm Vi Nghiệp Vụ & Các Sub-phase (Phase 10 Scope & Sub-phases)

Phase 10 bao gồm 6 phân hệ nghiệp vụ hoàn chỉnh:

1. **Sub-phase 10.1 — Khách Gọi Nhân Viên & Luồng Phản Hồi Xử Lý Hai Chiều (Customer Call Staff & Acknowledgment Flow):**
   - Cung cấp API công khai cho khách: `POST /api/tables/:tableId/call-staff` yêu cầu `qrToken` hoặc `restaurantSlug` hợp lệ, cho phép gửi lý do (`reason`) và ghi chú (`note`).
   - Cung cấp API nội bộ cho nhân viên: `POST /api/tables/:tableId/acknowledge-call` yêu cầu xác thực JWT với quyền `POS.VIEW` hoặc `ORDER.VIEW`.
   - Cơ chế phát sự kiện WebSocket: Bắn sự kiện `CALL_STAFF` kèm âm thanh chuông reo tới phòng chi nhánh `restaurant_${restaurantId}_branch_${branchId}`; khi nhân viên bấm tiếp nhận, bắn sự kiện `staff_acknowledged` ngược lại phòng bàn `table_${tableId}` để báo cho khách qua thông báo Toast.
   - Cơ chế Cooldown & Chống Spam: Cooldown 60 giây theo `tableId`. Nếu khách gửi lại yêu cầu trong cửa sổ cooldown, hệ thống trả về phản hồi cố đẳng `isCooldownReplay: true` mà không bắn trùng sự kiện WebSocket, triệt tiêu nguy cơ spam chuông reo. Giới hạn chặt độ dài `reason` ($\le 100$ ký tự) và `note` ($\le 200$ ký tự).

2. **Sub-phase 10.2 — Bảo Mật Phòng WebSocket & Phân Lập Đa Khách Thuê / Đa Chi Nhánh (WebSocket Room Security & Multi-Tenant Isolation):**
   - Xác thực bắt tay WebSocket: Nhân viên bắt buộc cung cấp JWT Bearer token qua `auth.token` hoặc `query.token`. Thực khách kết nối với thông tin bàn ăn và mã `qrToken`.
   - Phân cấp phòng nghiêm ngặt:
     * Phòng chuỗi nhà hàng: `restaurant_${restaurantId}` (chỉ dành cho Chủ nhà hàng / Super Admin).
     * Phòng chi nhánh: `restaurant_${restaurantId}_branch_${branchId}` (dành cho Nhân viên, Bếp, Thu ngân chi nhánh).
     * Phòng bàn ăn: `table_${tableId}` (dành cho Thực khách quét mã QR tại bàn).
   - Cô lập khách vãng lai (Guest Room Isolation): Khách vãng lai bị chặn tuyệt đối không thể tham gia vào các phòng nhân viên (`restaurant_${id}` hoặc `restaurant_${id}_branch_${id}`). Mọi nỗ lực lắng nghe trộm đơn hàng hay doanh thu đều bị từ chối.
   - Dọn dẹp phòng động (Dynamic Room Migration): Khi nhân viên đổi chi nhánh làm việc (`switch:branch`) hoặc rời nhà hàng (`leave:restaurant`), hệ thống duyệt qua `client.rooms` và gọi `client.leave(r)` dọn sạch toàn bộ các phòng chi nhánh cũ trước khi gia nhập phòng mới, triệt tiêu hoàn toàn nguy cơ rò rỉ thông báo chéo chi nhánh.

3. **Sub-phase 10.3 — Ma Trận Sự Kiện Miền Thời Gian Thực (Domain Events Matrix):**
   - Chuẩn hóa toàn bộ 7 nhóm sự kiện thời gian thực bao phủ trọn vẹn chu trình vận hành nhà hàng F&B:
     1. **Đơn hàng mới**: `order:created` / `NEW_ORDER` (Khách gọi món $\rightarrow$ POS & Bếp KDS).
     2. **Cập nhật đơn hàng**: `order:updated` / `round:confirmed` (POS duyệt đơn $\rightarrow$ Khách & Bếp).
     3. **Trạng thái món ăn**: `order:item_status_updated` / `item:cooking` / `item:ready` / `item:served` (Bếp chuyển món $\rightarrow$ POS & Khách).
     4. **Trạng thái bàn ăn**: `table.status_updated` (`Available` $\rightarrow$ `Occupied` $\rightarrow$ `PaymentRequested` $\rightarrow$ `Available`).
     5. **Gọi nhân viên & Tiếp nhận**: `CALL_STAFF` (Khách gọi $\rightarrow$ Admin Header) & `staff_acknowledged` (Nhân viên nhận $\rightarrow$ Khách).
     6. **Thanh toán & Hóa đơn**: `payment:requested` (Khách yêu cầu thanh toán VietQR) & `payment:completed` (Thu ngân chốt bill $\rightarrow$ Giải phóng bàn).
     7. **Báo hết món ăn (86)**: `menu:item_out_of_stock` (Bếp KDS báo hết $\rightarrow$ Khóa món tức thì trên POS & Thực đơn khách).

4. **Sub-phase 10.4 — Hợp Đồng Frontend SDK & Độ Bền Bỉ Kết Nối Client (Client Resilience & SDK Contract):**
   - Hợp đồng Frontend SDK (`@imenu/utils`): Bổ sung các phương thức gọi chuẩn xác `apiClient.tables.callStaff` (SDK-30), `apiClient.tables.acknowledgeCall` (SDK-31), và `apiClient.customerOrders.callStaff` (SDK-32).
   - Tự động kết nối lại kèm Jitter (Reconnection Exponential Backoff with Jitter): Cấu hình Socket Client hỗ trợ thử lại thông minh (`reconnectionDelay: 1000`, `reconnectionDelayMax: 5000`, `randomizationFactor: 0.5`) nhằm phân tán tải và chống giông bão kết nối (thundering herd).
   - Khử trùng lặp sự kiện (Canonical Event Deduplication): `CANONICAL_EVENT_MAP` ánh xạ chuẩn hóa giữa tên sự kiện cũ và mới, cơ chế wildcard dispatch duy nhất loại bỏ triệt để hiện tượng chuông reo đúp (double chimes).
   - Giới hạn bộ đệm thông báo (FIFO State Capping): Giới hạn tối đa 50 thông báo gần nhất trên `AdminHeader` (`slice(0, 50)`), ngăn ngừa phình to bộ nhớ trình duyệt khi treo máy lâu ngày.

5. **Sub-phase 10.5 — Kiểm Thử Trình Duyệt E2E Đa Tab Hệ Sinh Thái (Browser E2E Multi-Tab Ecosystem):**
   - Kịch bản E2E Puppeteer kết nối Google Chrome thật điều phối đồng thời nhiều tab trình duyệt:
     * **Checkpoint E2E-P10-01**: Khách tại bàn bấm "Gọi nhân viên" ("Xin thêm đá lạnh") $\rightarrow$ Trên `AdminHeader` của tab Admin lập tức xuất hiện huy hiệu chuông thông báo kèm nội dung yêu cầu mà không cần tải lại trang.
     * **Checkpoint E2E-P10-02**: Nhân viên bấm "Đã hỗ trợ" trên chuông thông báo Admin $\rightarrow$ Tab khách nhận ngay thông báo toast xác nhận nhân viên đang tới hỗ trợ.
     * **Checkpoint E2E-P10-03**: Chu trình đồng bộ vòng đời thời gian thực không reload: Khách gửi món $\rightarrow$ POS duyệt $\rightarrow$ KDS nấu & xong món $\rightarrow$ Khách yêu cầu thanh toán $\rightarrow$ Thu ngân chốt bill.

6. **Sub-phase 10.6 — Gia Cố Bảo Mật Đối Kháng & Kiểm Toán Thời Gian Thực (Adversarial Hardening AUD-10.1 đến AUD-10.6):**
   - Xử lý triệt để 6 phát hiện kiểm toán đối kháng:
     * `AUD-10.1`: Cooldown chống spam `call-staff` theo bàn ăn, giới hạn độ dài ghi chú, tự động dọn dẹp Map TTL chống rò rỉ RAM.
     * `AUD-10.2`: Dọn phòng WebSocket triệt để bằng `client.leave(r)` khi nhân viên chuyển chi nhánh.
     * `AUD-10.3`: Cô lập phòng khách vãng lai, chặn tuyệt đối quyền lắng nghe kênh bếp/thu ngân.
     * `AUD-10.4`: FIFO ring buffer 50 thông báo trên giao diện Admin Header.
     * `AUD-10.5`: Bản đồ ánh xạ `CANONICAL_EVENT_MAP` chống kích hoạt chuông đúp.
     * `AUD-10.6`: Cơ chế thử lại WebSocket có Jitter ngẫu nhiên phân tán tải kết nối.

---

## 3. Danh Mục Tệp Kiểm Thử & Kiểm Toán (Test Inventory)

Toàn bộ các tệp kiểm thử tự động của Phase 10:

| Mã Suite | Tệp Kiểm Thử | Trọng Tâm Xác Thực | Số Ca Test | Trạng Thái |
| :---: | :--- | :--- | :---: | :---: |
| **P10-01** | `call-staff-notification.test.ts` (Port 3125) | Luồng gọi nhân viên & tiếp nhận 2 chiều, phân lập chi nhánh, Cooldown chống spam 60s (`isCooldownReplay`), giới hạn độ dài `reason`/`note`, dọn dẹp TTL map, RBAC `perm-pos-view`, hardening `TC-10.1.14–16`. | **16** | **PASS** |
| **P10-02** | `websocket-room-security.test.ts` (Port 3126) | Xác thực JWT Bearer handshake, phân lập phòng đa cấp (`restaurant_${id}`, `branch_${id}`, `table_${id}`), cô lập khách vãng lai khỏi phòng staff, dọn sạch phòng cũ khi `switch:branch` và `leave:restaurant`, hardening `TC-10.2.11–13`. | **13** | **PASS** |
| **P10-03** | `domain-events-matrix.test.ts` (Port 3127) | Ma trận 7 nhóm sự kiện thời gian thực (New Order, Order Updated, Item Status, Table Status, Call Staff, Payment & Bill, KDS 86 Out-of-Stock), tính toàn vẹn payload và kênh truyền phát. | **11** | **PASS** |
| **P10-04A**| `packages/utils/tests/sdk-contract.test.ts`<br>*(tại `imenu-menudientu`)* | Hợp đồng API Frontend SDK đầy đủ: `tables.callStaff` (SDK-30), `tables.acknowledgeCall` (SDK-31), `customerOrders.callStaff` (SDK-32) cùng 31 ca test kế thừa từ các Phase trước. | **34** | **PASS** |
| **P10-04B**| `subphase-10-4-client-resilience.test.ts` (Port 3128) | Khả năng tự phục hồi kết nối, cấu hình Reconnection Jitter Backoff, khử trùng lặp sự kiện `CANONICAL_EVENT_MAP`, FIFO ring buffer 50 thông báo, hardening `TC-10.4.6–8`. | **8** | **PASS** |
| **P10-05** | `e2e-realtime-runner.test.ts` | Kịch bản kiểm thử E2E trình duyệt thật đa tab: Khách gọi nhân viên $\rightarrow$ Admin Header chuông reo không reload; Nhân viên tiếp nhận $\rightarrow$ Khách nhận toast; Vòng đời Order $\rightarrow$ KDS $\rightarrow$ POS $\rightarrow$ Bill không reload. | **3** | **PASS** |
| **MASTER** | `run-all-phase10.ts` | Master Test Orchestrator Phase 10: Chế độ Dev (Suites 1–5 Backend & SDK) & Chế độ Acceptance (Full 6 Suites bao gồm Browser E2E). | N/A | **READY** |

---

## 4. Bảng Đối Chiếu Số Lượng Ca Test Toàn Hệ Sinh Thái (Test Reconciliation Matrix)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  HỆ SINH THÁI KIỂM THỬ IMENU — ĐỐI CHIẾU 643 CA TEST TỰ ĐỘNG CHUẨN XÁC (PHASES 2 -> 10)│
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Phân Hệ Kiểm Thử               │ Vị Trí / Tệp Kiểm Thử         │ Số Ca Test Thực Tế     │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ 1. Phase 10 Realtime & Ecosyst │ tests/phase-10-realtime/     │ 85 (51 BE + 34 SDK+E2E)│
│    - Call Staff & Notification │ tests/phase-10-realtime/     │ 16                     │
│    - WebSocket Room Security   │ tests/phase-10-realtime/     │ 13                     │
│    - Domain Events Matrix      │ tests/phase-10-realtime/     │ 11                     │
│    - Frontend SDK Contract P10 │ packages/utils/tests/        │ 34 (3 mới + 31 kế thừa)│
│    - Client Resilience Suite   │ tests/phase-10-realtime/     │ 8                      │
│    - Multi-Tab Browser E2E     │ tests/phase-10-realtime/     │ 3                      │
│ 2. Phase 9 Dashboard & Reports │ tests/phase-09-dashboard-rep/│ 57 (53 BE + 4 E2E)     │
│ 3. Phase 8 Payment & Bill      │ tests/phase-08-payment-bill/ │ 98 (66 BE + 27 SDK + 5 E2E)│
│ 4. Phase 7 Kitchen / KDS       │ tests/phase-07-kitchen-kds/  │ 50 (30 BE + 14 SDK + 6 E2E)│
│ 5. Phase 6 Orders & POS        │ tests/phase-06-order-pos/    │ 279 (270 BE + 9 SDK)   │
│ 6. Phases 2–5 Core Regressions │ tests/phase-02..05/          │ 74                     │
├────────────────────────────────┴──────────────────────────────┴────────────────────────┤
│ TỔNG CỘNG HỆ SINH THÁI (ACCEPTANCE CLOSURE REQUIREMENT)        │ 643 CA TEST (RUNNERS)  │
│  - Số ca test đã vượt qua tuyệt đối (Developer/CI Run):        │ 643 / 643 PASS (100%)  │
│  - Trạng thái kiểm thử đối kháng & hồi quy:                    │ 0 FAIL, 0 BLOCKED      │
│  - Trạng thái nghiệm thu toàn bộ lộ trình 10 Phases:           │ ✅ HOÀN TẤT & NGHIỆM THU│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Hướng Dẫn Thực Thi Kiểm Thử (How to Run Phase 10 Tests)

### Chạy toàn bộ bộ kiểm thử Phase 10:
```powershell
# Chế độ nghiệm thu đóng Phase 10 (Acceptance Run - Closure Gate):
npm run test:phase10:acceptance

# Hoặc chế độ phát triển chuẩn (Developer Run):
npm run test:phase10:all
```

### Chạy riêng lẻ từng bộ kiểm thử của Phase 10:
```powershell
npm run test:phase10:call-staff  # Suite 1: Khách gọi nhân viên & xác nhận hai chiều (16 ca)
npm run test:phase10:security    # Suite 2: Bảo mật phòng WebSocket & phân lập chi nhánh (13 ca)
npm run test:phase10:events      # Suite 3: Ma trận 7 nhóm sự kiện miền thời gian thực (11 ca)
npm run test:phase10:sdk         # Suite 4A: Hợp đồng Frontend SDK Contract (34 ca)
npm run test:phase10:resilience  # Suite 4B: Khả năng phục hồi kết nối & khử trùng lặp (8 ca)
npm run test:phase10:e2e         # Suite 5: Kịch bản Browser E2E đa tab thời gian thực (3 ca)
npm run test:phase10             # Chạy 4 suite Backend liên tiếp (48 ca)
```

### Chạy kiểm thử Frontend SDK Contract độc lập:
```powershell
# Chuyển tới thư mục packages/utils trong imenu-menudientu:
cd ../imenu-menudientu/packages/utils
npx ts-node tests/sdk-contract.test.ts
```
