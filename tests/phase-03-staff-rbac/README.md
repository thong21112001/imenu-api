# 🧪 Tài Liệu Kiểm Thử Phase 3: Staff Management & RBAC

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Module kiểm thử:** Quản trị Nhân sự (Staff Management) + Soft Delete + Phân quyền Ma trận (RBAC & Permission Mapping) + Toàn quyền Super Admin Đa Nhà Hàng  
> **Đặc tả kỹ thuật:** Theo kiến trúc Phase 3 iMenu Backend API & Blueprint Phân quyền Hệ thống.

---

## 1. 📁 Cấu Trúc Thư Mục Kiểm Thử

Bộ kiểm thử tích hợp (End-to-End Integration Test Suite) của Phase 3 được đặt tập trung trong thư mục:

| File Kiểm Thử | Tên Bộ Kiểm Thử | Số Lượng Test | Lệnh Thực Thi | Trọng Tâm Nghiệp Vụ |
| :--- | :--- | :---: | :--- | :--- |
| [`test.ts`](test.ts) | **Phase 3: Staff Management & RBAC Test Suite** | 16 ca | `npm run test:phase3` | Đồng bộ Super Admin từ ENV, xem & quản lý đa nhà hàng, Soft Delete, bảo vệ tài khoản hệ thống, CRUD vai trò & mapping permissions 2 chiều, phân lập dữ liệu chi nhánh con, bảo vệ toàn vẹn nhân sự và cấu hình VietQR độc lập từng chi nhánh |

---

## 2. 📋 Danh Sách 16 Ca Kiểm Thử Chi Tiết

| STT | Tên Ca Kiểm Thử | Endpoint & Method | Ý Nghĩa Nghiệp Vụ & Kết Quả Kỳ Vọng |
| :---: | :--- | :--- | :--- |
| **1** | **Khởi tạo & Ghi đè Super Admin từ ENV** | `POST /api/auth/login` | Đăng nhập thành công bằng credentials định nghĩa trong file `.env` (`SUPERADMIN_EMAIL` & `SUPERADMIN_PASSWORD`). Mật khẩu luôn được băm lại và ghi đè tự động khi khởi động server. |
| **2** | **Kiểm tra JWT Payload & Quyền Super Admin** | `GET /api/auth/me` | Token Super Admin mang vai trò `role: SYSTEM_ADMIN`, đầy đủ 17 quyền hạn hệ thống, `restaurantId: undefined`, quyền truy cập toàn diện. |
| **3** | **Super Admin xem danh sách tất cả nhà hàng** | `GET /api/restaurants` | `200 OK`, trả về danh sách toàn bộ nhà hàng trong cơ sở dữ liệu kèm thống kê trực tiếp số lượng chi nhánh (`branchCount`) và số lượng nhân sự (`staffCount`). |
| **4** | **Super Admin xem danh sách toàn bộ nhân sự** | `GET /api/users` | `200 OK`, Super Admin không truyền `restaurantId` sẽ nhận được danh sách nhân viên từ tất cả các nhà hàng khác nhau kèm thông tin định danh nhà hàng. |
| **5** | **Super Admin lọc nhân viên theo nhà hàng** | `GET /api/users?restaurantId=X` | `200 OK`, danh sách nhân sự được lọc chính xác 100% theo ID của nhà hàng được chỉ định. |
| **6** | **Super Admin hỗ trợ tạo nhân viên cho nhà hàng** | `POST /api/users` | Cho phép Super Admin tạo hộ tài khoản nhân viên cho một nhà hàng đích (bằng cách truyền `restaurantId` trong payload), tự động liên kết với chi nhánh chính nếu không chỉ định. |
| **7** | **Thao tác Soft Delete nhân viên** | `DELETE /api/users/:id` | `200 OK`, thực hiện xóa mềm: gán cờ `isDeleted: true`, trạng thái `status: DELETED`, lưu mốc thời gian `deletedAt`. Nhân viên lập tức bị ẩn khỏi các API truy vấn danh sách thông thường. |
| **8** | **Chặn đăng nhập nhân viên đã bị Soft Delete** | `POST /api/auth/login` | `401 Unauthorized`, hệ thống từ chối đăng nhập ngay cả khi nhập đúng mật khẩu đối với các tài khoản đã bị xóa mềm. |
| **9** | **Chặn tự khóa hoặc tự xóa tài khoản của chính mình** | `DELETE & PATCH /users/:id` | `400 Bad Request`, cơ chế bảo vệ an toàn ngăn người dùng tự xóa tài khoản hoặc tự vô hiệu hóa quyền hạn của bản thân. |
| **10** | **Bảo vệ tuyệt đối tài khoản Super Admin** | `DELETE & PATCH /users/:superAdminId` | `403 Forbidden`, nghiêm cấm mọi người dùng hoặc chủ nhà hàng khác thực hiện xóa/khóa tài khoản Quản trị viên hệ thống cấp cao nhất. |
| **11** | **CRUD Vai trò tùy chỉnh & Mapping 2 Chiều** | `/api/roles` (POST, GET, PUT, DELETE) | Tạo vai trò custom nhận mảng flat permission IDs (`['perm-pos-view', 'perm-pos-create']`), MongoDB lưu trữ dạng chuẩn hóa `PermissionSubdocument[]`, API trả về trường ảo `permissionIds`, xóa vai trò thành công. |
| **12** | **Bảo vệ vai trò hệ thống & Demo Block Guard** | `DELETE /api/roles/:id` | `400 Bad Request` khi cố xóa vai trò mặc định (`isSystem: true`); Tài khoản dùng thử demo (`owner@sample.vn`) bị chặn ghi `403 Forbidden` bởi `DemoBlockGuard`. |
| **13** | **Phân lập quyền hạn & Dữ liệu chi nhánh con (Scoping)** | `GET /api/users` & `GET /api/branches` | `isMainBranch = false` cho tài khoản chi nhánh con; danh sách nhân viên và danh sách chi nhánh tự động được giới hạn 100% trong chi nhánh phụ của họ. |
| **14** | **Bảo vệ toàn vẹn nhân sự chi nhánh** | `/api/users` (POST, PUT, PATCH, DELETE) | `403 Forbidden` khi chi nhánh con cố tạo nhân viên cho chi nhánh khác, gán role quản trị (`restaurant_admin`), sửa/khóa/xóa nhân viên chi nhánh khác, hoặc điều chuyển nhân sự. Cho phép tạo thu ngân trong chi nhánh của mình (`201 Created`). |
| **15** | **Phân lập quản lý chi nhánh & Cài đặt độc lập VietQR** | `/api/branches` (POST, PUT) | `403 Forbidden` khi chi nhánh con tạo chi nhánh mới, sửa chi nhánh khác hoặc tự ý nâng cờ `isMainBranch`. Cho phép chi nhánh con cập nhật hotline, giờ mở cửa và tài khoản VietQR nhận tiền riêng biệt của mình (`200 OK`). |
| **16** | **Bảo vệ vai trò hệ thống SaaS & Phân lập RBAC** | `/api/roles` (POST, PUT) | `403 Forbidden` khi chi nhánh con tạo/sửa vai trò phân quyền; `403 Forbidden` khi chủ nhà hàng cố sửa vai trò mặc định của hệ thống SaaS; Duy nhất Super Admin có quyền cập nhật vai trò hệ thống (`200 OK`). |

---

## 3. 🚀 Hướng Dẫn Chạy Kiểm Thử

### Điều kiện tiên quyết:
- Đã cài đặt dependencies: `npm install`
- MongoDB đang hoạt động tại cổng mặc định (`mongodb://localhost:27017`) hoặc thông qua biến `TEST_MONGODB_URL`.

### Lệnh chạy kiểm thử:
```bash
# Chạy riêng bộ kiểm thử Phase 3
npm run test:phase3

# Hoặc chạy kiểm thử tích hợp toàn bộ các Phase
npm run test:phase2:all && npm run test:phase3
```

---

## 4. 📊 Cơ Chế Dọn Dẹp Dữ Liệu Tự Động (Zero Garbage Teardown)

Mỗi lần chạy kiểm thử, script `test.ts` sẽ tự động:
1. Tạo môi trường độc lập với mã định danh thời gian thực (`timestamp`).
2. Thực thi tuần tự 16 kịch bản.
3. Trong khối `finally`: Tự động tìm kiếm và xóa toàn bộ các nhà hàng, chi nhánh, người dùng, và vai trò thử nghiệm có tiền tố `owner.p3.`, `staff.p3.`, `subadmin.`, `cashier.q7.`, `custom_pos_`.
4. Đảm bảo cơ sở dữ liệu kiểm thử luôn sạch sẽ, không để lại rác dữ liệu sau khi hoàn thành.

---

## 5. 🛡️ Ma Trận Phân Quyền 5 Vai Trò Hệ Thống & Kiểm Thử E2E Trình Duyệt

Hệ thống Phase 3 chuẩn hóa **Single Source of Truth** với **17 quyền chuẩn nghiệp vụ** chia theo 5 nhóm:
* **Thực đơn (4):** `perm-menu-view`, `perm-menu-create`, `perm-menu-status`, `perm-menu-category`
* **Sơ đồ bàn & POS (4):** `perm-pos-view`, `perm-pos-order`, `perm-pos-pay`, `perm-pos-table`
* **Bếp KDS (3):** `perm-kds-view`, `perm-kds-cook`, `perm-kds-out`
* **Báo cáo (2):** `perm-rep-view`, `perm-rep-export`
* **Nhân sự & Hệ thống (4):** `perm-staff-manage`, `perm-role-manage`, `perm-qr-print`, `perm-settings`

### 5.1. Bảng Đối Soát 5 Vai Trò Mặc Định & Điều Hướng

| Vai trò (Role) | Tài khoản Demo | Quyền DB & Fallback | Điều hướng mặc định | Menu hiển thị trên Sidebar | Kiểm soát bảo vệ (Guard) | Kết quả kiểm thử |
| :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| **Chủ Quán** (`restaurant_admin`) | `owner@sample.vn` | **17 quyền** (Full) | `/` (Dashboard Tổng quan) | Toàn bộ menu: Tổng quan, Bàn, POS, Bếp, Thực đơn, QR, Hóa đơn, Báo cáo, **Nhân viên & Phân quyền**, Chi nhánh, **Cài đặt Nhà Hàng** | Truy cập toàn bộ module chi nhánh; toàn quyền cấu hình nhân sự & phân quyền | ✅ **PASS** |
| **Quản Lý** (`restaurant_manager`) | `manager@sample.vn` | **13 quyền** | `/` (Dashboard Tổng quan) | Tổng quan, Sơ đồ Bàn, POS, Bếp KDS, Thực đơn, Mã QR, Hóa đơn, Báo cáo (Ẩn Nhân viên, Cài đặt) | Chặn truy cập `/staff`, `/settings` (403 Forbidden) | ✅ **PASS** |
| **Thu Ngân** (`cashier`) | `cashier@sample.vn` | **6 quyền** | `/pos` (Auto-redirect) | POS Bán hàng, Sơ đồ Bàn, Quản lý Thực đơn, Hóa đơn & In Bill, Báo cáo & Doanh thu (Ẩn Tổng quan, Nhân viên) | Truy cập `/` tự động chuyển về `/pos`; Chặn truy cập `/staff` (403 Forbidden); Bấm "Quay về trang làm việc chính" trở lại `/pos` | ✅ **PASS** |
| **Bếp KDS** (`kitchen`) | `kitchen@sample.vn` | **3 quyền** | `/kitchen` (Auto-redirect) | Duy nhất Màn hình Bếp KDS (Ẩn Tổng quan, POS, Bàn, Menu, Nhân viên) | Truy cập `/` tự động chuyển về `/kitchen`; Chặn truy cập tất cả route quản trị | ✅ **PASS** |
| **Phục Vụ** (`waiter`) | `waiter@sample.vn` | **3 quyền** | `/tables` (Auto-redirect) | Sơ đồ Bàn, POS Bán hàng, Quản lý Thực đơn (Ẩn Tổng quan, Bếp, Báo cáo, Nhân viên) | Truy cập `/` tự động chuyển về `/tables`; Chặn truy cập tất cả route quản trị | ✅ **PASS** |

### 5.2. Kết Quả Kiểm Thử Thực Tế (Backend 16 ca + Trình Duyệt E2E)
```text
✔ Backend Integration Test (npm run test:phase3):
  16 passed, 0 failed (100% PASS)
  - Khởi tạo & ghi đè Super Admin từ ENV: PASS
  - Phân lập chi nhánh con & Scoping: PASS
  - Bảo vệ vai trò hệ thống & Soft Delete: PASS
  - Bảo vệ toàn vẹn nhân sự chi nhánh (403): PASS

✔ Browser E2E Access & Redirect Test (http://localhost:3003):
  - Thu Ngân đăng nhập -> Tự động chuyển hướng sang /pos: PASS
  - Sidebar Thu Ngân -> Ẩn menu 'Tổng quan' ('/'), ẩn 'Nhân viên': PASS
  - Thu Ngân nhập trực tiếp URL /staff -> Màn hình 403 Forbidden bảo vệ: PASS
  - Nút 'Quay về trang làm việc chính' -> Quay lại /pos chuẩn xác: PASS
  - Chủ Quán đăng nhập -> Vào Dashboard ('/'), thấy đủ 100% menu: PASS
  - Chủ Quán truy cập /staff -> Xem đầy đủ danh sách nhân viên & vai trò: PASS
```
