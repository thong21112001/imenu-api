# 🧪 Tài Liệu Kiểm Thử Phase 3: Staff Management & RBAC

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Module kiểm thử:** Quản trị Nhân sự (Staff Management) + Soft Delete + Phân quyền Ma trận (RBAC & Permission Mapping) + Toàn quyền Super Admin Đa Nhà Hàng  
> **Đặc tả kỹ thuật:** Theo kiến trúc Phase 3 iMenu Backend API & Blueprint Phân quyền Hệ thống.

---

## 1. 📁 Cấu Trúc Thư Mục Kiểm Thử

Bộ kiểm thử tích hợp (End-to-End Integration Test Suite) của Phase 3 được đặt tập trung trong thư mục:

| File Kiểm Thử | Tên Bộ Kiểm Thử | Số Lượng Test | Lệnh Thực Thi | Trọng Tâm Nghiệp Vụ |
| :--- | :--- | :---: | :--- | :--- |
| [`test.ts`](test.ts) | **Phase 3: Staff Management & RBAC Test Suite** | 12 ca | `npm run test:phase3` | Đồng bộ Super Admin từ ENV, xem & quản lý đa nhà hàng, tạo hộ nhân sự, Soft Delete, bảo vệ tài khoản hệ thống, CRUD vai trò & mapping permissions 2 chiều |

---

## 2. 📋 Danh Sách 12 Ca Kiểm Thử Chi Tiết

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
2. Thực thi tuần tự 12 kịch bản.
3. Trong khối `finally`: Tự động tìm kiếm và xóa toàn bộ các nhà hàng, người dùng, và vai trò thử nghiệm có tiền tố `owner.p3.`, `staff.p3.`, `custom_pos_`.
4. Đảm bảo cơ sở dữ liệu kiểm thử luôn sạch sẽ, không để lại rác dữ liệu sau khi hoàn thành.
