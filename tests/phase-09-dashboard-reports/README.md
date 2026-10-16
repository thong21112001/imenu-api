# 🧪 Phase 9: Báo Cáo Doanh Thu, Dashboard & Tối Ưu Giao Diện (Dashboard, Reports & UI/UX Overhaul)

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)<br>
> **Phase:** 9 — Dashboard Analytics, Revenue Reports, CSV Export, Public Demo Tables & Responsive UI/UX Overhaul<br>
> **Trạng thái phân hệ:** **✅ ĐÃ NGHIỆM THU — ĐÓNG CHÍNH THỨC (PHASE 9 CLOSURE GATE PASSED)**<br>
> **Quy ước kiến trúc:** `ONE PHASE = ONE TEST DIRECTORY` (Toàn bộ test artifacts của Phase 9 được lưu trữ tập trung tại thư mục này).

---

## 1. Mục Đích & Bối Cảnh (Phase 9 Purpose)

Phase 9 là phân hệ quản trị kinh doanh, phân tích dữ liệu chuyên sâu và hoàn thiện trải nghiệm người dùng toàn diện: **Chỉ số KPI tổng quan thời gian thực (Dual-Key Engine) $\rightarrow$ Báo cáo doanh thu đa chiều & phân rã phương thức thanh toán $\rightarrow$ Thống kê món bán chạy (Top Items) tính kèm tùy chọn options $\rightarrow$ Xuất báo cáo CSV bảo mật UTF-8 BOM có phân quyền nghiêm ngặt $\rightarrow$ Cung cấp API khám phá bàn ăn thực tế có mã QR $\rightarrow$ Tái cấu trúc thanh điều hướng Admin Sidebar theo 4 nhóm logic $\rightarrow$ Thiết kế lại giao diện Dashboard & Reports $\rightarrow$ Đại tu Responsive Thực đơn Khách hàng trên Mobile, Tablet & Desktop**.

Theo chuẩn kiến trúc của dự án `imenu-api`:
> **Quy ước:** `ONE PHASE = ONE TEST DIRECTORY`  
> Toàn bộ các tệp kiểm thử tự động, runner điều phối và tài liệu kiểm thử của Phase 9 (từ 9.1 đến 9.6) được lưu trữ thống nhất và tập trung trực tiếp tại thư mục `tests/phase-09-dashboard-reports/`. Các Sub-phase **không** tạo thư mục con riêng nhằm tránh phân mảnh repository.

---

## 2. Phạm Vi Nghiệp Vụ & Các Sub-phase (Phase 9 Scope & Sub-phases)

Phase 9 bao gồm 6 phân hệ nghiệp vụ hoàn chỉnh:

1. **Sub-phase 9.1 — Động Cơ Phân Tích Chỉ Số Tổng Quan Thời Gian Thực (Dashboard Dual-Key Engine):**
   - Cung cấp API: `GET /api/dashboard/overview` hỗ trợ truy vấn theo `branchId` và `date` (mặc định hôm nay theo múi giờ Việt Nam `+07:00`).
   - Hỗ trợ cơ chế tương thích khóa kép (Dual-Key Engine) cho Frontend:
     * Doanh thu hôm nay: `revenueToday` & `todayRevenue`
     * Doanh thu hôm qua: `yesterdayRevenue`
     * Tỷ lệ tăng trưởng doanh thu: `revenueGrowthRate` & `revenueChangePercent`
     * Số bàn đang phục vụ: `occupiedTables` & `occupiedTablesCount`
     * Tổng số bàn ăn thực tế: `totalTables` & `totalTablesCount` (loại trừ 100% bàn đã xóa mềm `isDeleted: true`)
     * Tỷ lệ lấp đầy bàn ăn: `occupancyRate`
     * Số đơn hàng hoàn tất hôm nay: `completedOrdersToday` & `todayOrdersCount`
     * Giá trị đơn hàng trung bình (AOV): `averageOrderValue`
   - Phân quyền linh hoạt: Chấp thuận quyền `REPORT.VIEW` (`perm-rep-view`), `DASHBOARD.VIEW` (`perm-dash-view`), hoặc `POS.VIEW` (`perm-pos-view`).
   - Cưỡng chế phân lập chi nhánh (Multi-Branch Isolation): Nhân viên chi nhánh con chỉ xem được số liệu của chi nhánh mình, truyền `branchId` khác lập tức bị từ chối (`403 Forbidden`). Mảng `branchBreakdown` chỉ chứa duy nhất chi nhánh của họ.

2. **Sub-phase 9.2 — Động Cơ Phân Tích Báo Cáo Doanh Thu Đa Chiều (Revenue Analytics Engine):**
   - Cung cấp API: `GET /api/reports/revenue` với các tham số lọc: `branchId`, `startDate`, `endDate`, `period` / `groupBy` (`day`, `week`, `month`).
   - Tính toán chuỗi thời gian doanh thu (`timeSeries`), tỷ lệ tăng trưởng so với kỳ trước (`growthRate`), và doanh thu trung bình mỗi ngày (`averageDailyRevenue`).
   - Phân tích chi tiết theo phương thức thanh toán (`paymentMethods`): `Cash`, `VietQR`, `Card`, `Transfer` kèm tổng số tiền và số giao dịch thực tế.
   - Cơ chế fallback MongoDB an toàn: Khi pipeline `$facet` gặp tập dữ liệu rỗng, tự động trả về mảng mặc định đầy đủ 4 phương thức thanh toán với số tiền bằng `0` thay vì trả về mảng rỗng gây lỗi giao diện.

3. **Sub-phase 9.3 — Phân Tích Món Ăn Bán Chạy Kèm Tùy Chọn (Top Selling Items Analytics Engine):**
   - Cung cấp API: `GET /api/reports/top-items` với các bộ lọc `branchId`, `startDate`, `endDate`, `limit` (mặc định 10).
   - Pipeline phân tích `$unwind: '$items'` nghiêm ngặt loại bỏ 100% món ăn bị hủy (`item.status !== 'Cancelled'`).
   - Tính toán doanh thu món ăn chính xác bao gồm giá gốc cộng với chênh lệch giá của các tùy chọn (`options.priceModifier`).
   - Tính toán tỷ trọng doanh thu của từng món (`revenuePercentage`) trên tổng doanh thu món ăn.

4. **Sub-phase 9.4 — Động Cơ Xuất Báo Cáo CSV & Bảo Mật Phân Quyền (Reports CSV Export & RBAC Security):**
   - Cung cấp API: `GET /api/reports/export` hỗ trợ xuất file CSV cho 3 loại báo cáo: `revenue`, `top-items`, và `daily-summary`.
   - Đảm bảo tương thích hoàn hảo với Microsoft Excel: Tự động gắn tiền tố UTF-8 Byte Order Mark (`\uFEFF`) để hiển thị tiếng Việt có dấu chuẩn xác 100% không bị lỗi font.
   - Thiết lập header HTTP chuẩn: `Content-Type: text/csv; charset=utf-8` và `Content-Disposition: attachment; filename="report-....csv"`.
   - Phân quyền nghiêm ngặt: Chỉ các vai trò có quyền `REPORT.EXPORT` (`perm-rep-export`) như `restaurant_admin` và `super_admin` mới được xuất báo cáo. Vai trò Quản lý chi nhánh (`restaurant_manager`) và Thu ngân (`cashier`) bị chặn với mã lỗi `403 Forbidden`.

5. **Sub-phase 9.5 — API Khám Phá Bàn Ăn Thực Tế & Thực Đơn Khách Hàng Responsive:**
   - Cung cấp API công khai: `GET /api/tables/public/by-restaurant/:restaurantSlug` trả về danh sách khu vực (`zones`) và các bàn ăn thực tế kèm mã `qrToken` còn hiệu lực.
   - Nâng cấp Trang Chủ Thực Đơn Khách Hàng (`apps/imenu-customer-menu/src/app/page.tsx`): Tự động nạp danh sách bàn từ Backend, cho phép khách trải nghiệm bấm vào bàn để điều hướng vào đúng URL bàn kèm token xác thực.
   - Đại tu giao diện Responsive toàn diện: Tương thích hoàn hảo trên Điện thoại (Mobile 390px), Máy tính bảng tại bàn (Tablet/iPad Kiosk 768px-1024px) và Máy tính (Desktop 1280px+). Thanh danh mục hỗ trợ cuộn mượt, giỏ hàng nổi cố định không che nội dung, triệt tiêu 100% lỗi tràn ngang giao diện (`overflow-x: hidden`).

6. **Sub-phase 9.6 — Tái Cấu Trúc Admin Sidebar, Giao Diện Báo Cáo & Gia Cố Đối Kháng (AUD-9.1 đến AUD-9.6):**
   - Tái cấu trúc `AdminSidebar.tsx` theo 4 nhóm chức năng logic:
     * **Vận Hành & Bán Hàng**: Bàn ăn & Sơ đồ, Điểm bán POS, Màn hình Bếp KDS.
     * **Quản Lý Thực Đơn & Bàn**: Danh mục món, Danh sách món ăn, Quản lý Bàn ăn.
     * **Báo Cáo & Thống Kê**: Tổng quan Dashboard, Báo cáo Doanh thu, Lịch sử Hóa đơn, Nhật ký Kiểm toán.
     * **Cấu Hình Hệ Thống**: Thông tin Nhà hàng, Danh sách Chi nhánh, Quản lý Nhân viên & Vai trò.
   - Nâng cấp giao diện Dashboard (`/`) và Báo cáo (`/reports`) trên `imenu-admin`: Biểu đồ trực quan, bộ lọc thời gian linh hoạt, nút xuất CSV bảo mật.
   - Xử lý triệt để 6 phát hiện kiểm toán đối kháng (`AUD-9.1` đến `AUD-9.6`): Chống rò rỉ dữ liệu chéo chi nhánh, bảo vệ quyền xuất báo cáo, loại trừ bàn xóa mềm, tính đúng options price delta, tương thích Excel UTF-8 BOM, và khóa tràn ngang CSS.

---

## 3. Danh Mục Tệp Kiểm Thử & Kiểm Toán (Test Inventory)

Toàn bộ các tệp kiểm thử tự động của Phase 9:

| Mã Suite | Tệp Kiểm Thử | Trọng Tâm Xác Thực | Số Ca Test | Trạng Thái |
| :---: | :--- | :--- | :---: | :---: |
| **P9-01** | `dashboard-overview.test.ts` (Port 3120) | Chỉ số KPI doanh thu hôm nay/hôm qua, tỷ lệ tăng trưởng, tỷ lệ lấp đầy bàn ăn, Dual-Key Engine, phân lập chi nhánh con, loại trừ bàn xóa mềm (`isDeleted: true`), hardening `TC-9.1-AUD-01` (chặn rò rỉ chéo chi nhánh). | **16** | **PASS** |
| **P9-02** | `reports-revenue-analytics.test.ts` (Port 3121) | Báo cáo doanh thu theo khoảng thời gian (`day`, `week`, `month`), phân rã 4 phương thức thanh toán (`Cash`, `VietQR`, `Card`, `Transfer`), phân rã chi nhánh, fallback mảng rỗng an toàn, hardening `TC-9.2-AUD-01` (chặn chi nhánh con xem toàn chuỗi). | **13** | **PASS** |
| **P9-03** | `reports-top-items.test.ts` (Port 3122) | Thống kê món ăn bán chạy nhất, tính chính xác giá món kèm tùy chọn (`options.priceModifier`), loại bỏ 100% món bị hủy (`Cancelled`), hardening `TC-9.3-AUD-01` (cô lập chi nhánh con khi xem top món). | **7** | **PASS** |
| **P9-04** | `reports-export-rbac.test.ts` (Port 3123) | Xuất báo cáo CSV UTF-8 BOM tiếng Việt chuẩn cho Excel, tiêu đề cột chuẩn xác, phân quyền RBAC nghiêm ngặt (`perm-rep-export`), chặn Quản lý chi nhánh & Thu ngân (403), hardening `TC-9.4-AUD-01` (chặn xuất CSV dữ liệu chi nhánh khác). | **10** | **PASS** |
| **P9-05** | `customer-demo-tables.test.ts` (Port 3124) | API công khai lấy danh sách bàn ăn thực tế theo slug nhà hàng (`/api/tables/public/by-restaurant/:restaurantSlug`), xác thực token QR hợp lệ, phân nhóm khu vực bàn, phục vụ trang chọn bàn trải nghiệm. | **7** | **PASS** |
| **P9-06** | `e2e-dashboard-reports-runner.test.ts` | Kịch bản kiểm thử E2E trình duyệt thật kiểm chứng 4 trạm nghiệp vụ: Tái cấu trúc Admin Sidebar 4 nhóm, Giao diện Dashboard KPI thời gian thực, Giao diện Báo cáo Doanh thu & Top Items kèm xuất CSV, Giao diện Thực đơn Khách hàng Responsive trên 3 viewport. | **4** | **PASS** |
| **P9-SDK**| `packages/utils/tests/sdk-contract.test.ts`<br>*(tại `imenu-menudientu`)* | Hợp đồng API Frontend SDK đầy đủ cho toàn bộ các endpoint Phase 9: `dashboard.getOverview` (SDK-26), `reports.getRevenue` (SDK-27), `reports.getTopItems` (SDK-28), `tables.listPublicBySlug` (SDK-29) kèm 27 ca test kế thừa từ Phase 8. | **31** | **PASS** |
| **MASTER**| `run-all-phase9.ts` | Master Test Orchestrator điều phối toàn diện 6 suites: Chế độ Dev (57 ca) & Chế độ Acceptance (Closure Gate). | N/A | **READY** |

---

## 4. Bảng Đối Chiếu Số Lượng Ca Test Toàn Hệ Sinh Thái (Test Reconciliation Matrix)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  HỆ SINH THÁI KIỂM THỬ IMENU — ĐỐI CHIẾU 570 CA TEST TỰ ĐỘNG CHUẨN XÁC (PHASES 2 -> 9) │
├────────────────────────────────┬──────────────────────────────┬────────────────────────┤
│ Phân Hệ Kiểm Thử               │ Vị Trí / Tệp Kiểm Thử         │ Số Ca Test Thực Tế     │
├────────────────────────────────┼──────────────────────────────┼────────────────────────┤
│ 1. Phase 9 Dashboard & Reports │ tests/phase-09-dashboard-rep/│ 57 (53 BE + 4 E2E)     │
│    - Hợp đồng Frontend SDK P9  │ packages/utils/tests/        │ 31 (4 mới + 27 kế thừa)│
│ 2. Phase 8 Payment & Bill      │ tests/phase-08-payment-bill/ │ 98 (66 BE + 27 SDK + 5 E2E)│
│ 3. Phase 7 Kitchen / KDS       │ tests/phase-07-kitchen-kds/  │ 50 (30 BE + 14 SDK + 6 E2E)│
│ 4. Phase 6 Orders & POS        │ tests/phase-06-order-pos/    │ 288 (270 BE + 9 SDK + 9 E2E)│
│ 5. Phases 2–5 Core Regressions │ tests/phase-02..05/          │ 77                     │
├────────────────────────────────┴──────────────────────────────┴────────────────────────┤
│ TỔNG CỘNG HỆ SINH THÁI (ACCEPTANCE CLOSURE REQUIREMENT)        │ 570 CA TEST (RUNNERS)  │
│  - Số ca test đã vượt qua tuyệt đối (Developer/CI Run):        │ 548 / 548 PASS (100%)  │
│  - Số ca test E2E trình duyệt chờ bật full dev server:         │ 22 Checkpoints         │
│  - Tổng số ca kiểm chứng độc lập tính cả Frontend SDK Suite:   │ 583 CA TEST TOÀN DIỆN  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Hướng Dẫn Thực Thi Kiểm Thử (How to Run Phase 9 Tests)

### Chạy toàn bộ bộ kiểm thử Phase 9:
```powershell
# Chế độ nghiệm thu đóng Phase (Acceptance Run - Closure Gate):
npm run test:phase9:acceptance

# Hoặc chế độ phát triển chuẩn (Developer Run):
npm run test:phase9:all
```

### Chạy riêng lẻ từng bộ kiểm thử của Phase 9:
```powershell
npm run test:phase9:overview    # Suite 1: Dashboard Overview KPI & Dual-Key Engine (16 ca)
npm run test:phase9:revenue     # Suite 2: Báo cáo Doanh thu & Phân rã thanh toán (13 ca)
npm run test:phase9:top-items   # Suite 3: Món ăn bán chạy nhất & Options Delta (7 ca)
npm run test:phase9:export      # Suite 4: Xuất báo cáo CSV UTF-8 BOM & RBAC (10 ca)
npm run test:phase9:demo-tables # Suite 5: Khám phá bàn ăn thực tế có mã QR (7 ca)
npm run test:phase9:e2e         # Suite 6: Kịch bản Browser E2E Dashboard, Reports & UI (4 ca)
npm run test:phase9             # Chạy cả 5 suite Backend liên tiếp (53 ca)
```

### Chạy kiểm thử Frontend SDK Contract độc lập:
```powershell
# Chuyển tới thư mục packages/utils trong imenu-menudientu:
cd ../imenu-menudientu/packages/utils
npx ts-node tests/sdk-contract.test.ts
```
