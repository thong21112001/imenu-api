# 🧪 Tài Liệu Kiểm Thử Phase 2: Auth + Restaurant + Multi-Branch

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Module kiểm thử:** Xác thực (Authentication) + Quản lý Nhà hàng (Restaurant) + Mô hình Đa Chi Nhánh (Multi-Branch Management & Isolation)  
> **Đặc tả kỹ thuật:** Theo kiến trúc Phase 2 iMenu & Blueprint Multi-Branch Head Office.

---

## 1. 📁 Cấu Trúc Thư Mục Kiểm Thử

Thư mục bao gồm **2 bộ kiểm thử tích hợp (End-to-End Integration Test Suites)** độc lập:

| File Kiểm Thử | Tên Bộ Kiểm Thử | Số Lượng Test | Lệnh Thực Thi | Trọng Tâm Kiểm Thử |
| :--- | :--- | :---: | :--- | :--- |
| [`test.ts`](test.ts) | **Phần 1: Auth + Restaurant + Branch CRUD** | 12 ca | `npm run test:phase2` | Quy trình đăng ký, JWT login/refresh, Profile, Cấu hình VietQR, CRUD chi nhánh cơ bản |
| [`test-multi-branch.ts`](test-multi-branch.ts) | **Phần 2: Multi-Branch & Isolation** | 10 ca | `npm run test:multibranch` | Bất biến chi nhánh chính, Vòng đời (Đóng/Mở/Ngừng hoạt động), Cách ly dữ liệu, Điều chuyển nhân sự, Doanh thu hợp nhất |
| **Cả 2 bộ test** | **Toàn bộ Phase 2 Test Suites** | **22 ca** | `npm run test:phase2:all` | Kiểm tra toàn bộ 22 kịch bản tích hợp của Phase 2 |

---

## 2. 📋 Danh Sách Ca Kiểm Thử

### Phần 1: Kiểm Thử Cơ Bản (`test.ts` - 12 Ca)

| STT | Kịch Bản Kiểm Thử | Endpoint & Method | Kết Quả Kỳ Vọng |
| :---: | :--- | :--- | :--- |
| **1** | Đăng ký nhà hàng mới kèm chủ quán | `POST /api/auth/register` | `201 Created`, tự sinh slug, tạo chi nhánh chính mặc định, cấp accessToken. |
| **2** | Chặn đăng ký trùng Email | `POST /api/auth/register` | `409 Conflict`, báo lỗi email đã tồn tại. |
| **3** | Ràng buộc dữ liệu đầu vào (Validation) | `POST /api/auth/register` | `400 Bad Request` khi mật khẩu < 8 ký tự hoặc thiếu trường. |
| **4** | Đăng nhập thành công (Happy Path) | `POST /api/auth/login` | `200 OK`, trả về user kèm danh mục quyền hạn và token JWT. |
| **5** | Chặn đăng nhập sai mật khẩu | `POST /api/auth/login` | `401 Unauthorized`, từ chối truy cập. |
| **6** | Chặn đăng nhập email không tồn tại | `POST /api/auth/login` | `401 Unauthorized`, từ chối truy cập. |
| **7** | Lấy thông tin tài khoản hiện tại | `GET /api/auth/me` | `200 OK`, xác thực token Bearer thành công. |
| **8** | Cấp mới Access Token qua Refresh Token | `POST /api/auth/refresh` | `200 OK`, cấp token mới thành công. |
| **9** | Lấy thông tin nhà hàng hiện tại | `GET /api/restaurants/current` | `200 OK`, trả về chi tiết nhà hàng và danh sách chi nhánh. |
| **10** | Cập nhật nhà hàng & tài khoản VietQR | `PUT /api/restaurants/current` | `200 OK`, cập nhật thông tin và lưu tài khoản nhận tiền. |
| **11** | Quản lý chi nhánh CRUD cơ bản | `/api/branches` | `200/201 OK`, thêm chi nhánh phụ, sửa đổi và xóa chi nhánh phụ. |
| **12** | Đăng xuất tài khoản | `POST /api/auth/logout` | `200 OK`, đăng xuất an toàn. |

---

### Phần 2: Kiểm Thử Đa Chi Nhánh Chuyên Sâu (`test-multi-branch.ts` - 10 Ca)

| STT | Kịch Bản Kiểm Thử | Endpoint & Method | Ý Nghĩa Nghiệp Vụ & Kết Quả Kỳ Vọng |
| :---: | :--- | :--- | :--- |
| **1** | **Xác định Chi nhánh chính** | `POST /api/auth/register` | Đăng ký chuỗi nhà hàng và tự động định danh chi nhánh đầu tiên là `isMainBranch = true`. |
| **2** | **Tạo các chi nhánh con** | `POST /api/branches` | Chi nhánh chính tạo thành công 2 chi nhánh con: Quận 3 và Bình Thạnh (`isMainBranch = false`). |
| **3** | **Bảo vệ Chi nhánh chính** | `DELETE & PATCH /close` | **Chặn xóa (`400`)** và **chặn tạm đóng (`400`)** chi nhánh chính để bảo toàn trụ sở quản trị của nhà hàng. |
| **4** | **Vòng đời chi nhánh (Lifecycle)** | `PATCH /close & /reopen` | Tạm đóng (`TEMPORARILY_CLOSED`) và mở lại (`ACTIVE`) chi nhánh phụ thành công. |
| **5** | **Tạo & Đăng nhập Quản lý Con** | `POST /users & /login` | Tạo tài khoản Quản lý cho Chi nhánh Quận 3 và đăng nhập lấy token JWT riêng của chi nhánh con. |
| **6** | **Cách ly dữ liệu chi nhánh** | `GET /branches & /:id` | Quản lý chi nhánh A **chỉ thấy chi nhánh của mình**; bị **chặn `403 Forbidden`** khi xem chi nhánh B. |
| **7** | **Phân quyền nhân sự chi nhánh** | `POST /users` & `GET /users` | **Chặn `403 Forbidden`** khi quản lý con cố tạo nhân sự cho chi nhánh khác; cho phép tạo nhân sự trong chi nhánh mình; danh sách nhân sự được lọc theo chi nhánh. |
| **8** | **Điều chuyển nhân sự giữa chi nhánh** | `POST /users/:id/transfer` | **Chặn quản lý con (`403`)**; chỉ cho phép **Chủ nhà hàng/Chi nhánh chính** điều động nhân sự (`200 OK`). |
| **9** | **Doanh thu & Dashboard hợp nhất** | `/reports/revenue` & `/dashboard/overview` | Quản lý con **chỉ xem doanh thu chi nhánh mình** ($300k); bị **chặn `403`** khi xem toàn chuỗi; Chi nhánh chính xem **báo cáo hợp nhất** ($800k) kèm phân bổ từng chi nhánh. |
| **10** | **Bảo toàn dữ liệu kế toán** | `DELETE /branches/:id` | **Chặn xóa vật lý (`400 Bad Request`)** đối với chi nhánh đã phát sinh đơn hàng trong quá khứ để bảo vệ lịch sử hóa đơn và thuế. |

---

## 3. 🚀 Hướng Dẫn Chạy Kiểm Thử

Mở Terminal tại thư mục gốc `imenu-api`:

### Chạy Phần 1 (Auth + Restaurant + Branch CRUD)
```bash
npm run test:phase2
```

### Chạy Phần 2 (Multi-Branch & Data Isolation)
```bash
npm run test:multibranch
```

### Chạy Toàn Bộ Cả 2 Phần (22 Ca Kiểm Thử)
```bash
npm run test:phase2:all
```

---

## 4. 🛡️ Chính Sách Không Phát Sinh Rác (Zero-Garbage Policy)

Cả 2 file kiểm thử đều tuân thủ nguyên tắc cách ly dữ liệu tuyệt đối:
- Tự động kết nối vào cơ sở dữ liệu kiểm thử riêng biệt: `imenu-db-test`.
- Sử dụng timestamp động trong email và orderCode để tránh xung đột dữ liệu.
- Kích hoạt khối lệnh `finally { await teardown(); }` dọn dẹp sạch sẽ 100% người dùng, nhà hàng, chi nhánh, bàn và đơn hàng đã tạo ra ngay sau khi chạy xong.
- Database chính (`imenu-db`) hoàn toàn nguyên vẹn và không bị ảnh hưởng.

---

## 5. 🔍 Kết Quả Chạy Thành Công Kỳ Vọng

### Khi chạy `npm run test:phase2`
```text
====================================================
  iMenu API - Phase 2: Auth + Restaurant Test Suite  
====================================================
  ✔ PASS: 1. Đăng ký nhà hàng mới kèm chủ quán (POST /auth/register)
  ✔ PASS: 2. Chặn đăng ký trùng email (409 Conflict)
  ✔ PASS: 3. Kiểm tra tính hợp lệ dữ liệu đăng ký (400 Bad Request)
  ✔ PASS: 4. Đăng nhập thành công (POST /auth/login)
  ✔ PASS: 5. Chặn đăng nhập sai mật khẩu (401 Unauthorized)
  ✔ PASS: 6. Chặn đăng nhập email không tồn tại (401 Unauthorized)
  ✔ PASS: 7. Lấy thông tin tài khoản hiện tại (GET /auth/me)
  ✔ PASS: 8. Làm mới Access Token (POST /auth/refresh)
  ✔ PASS: 9. Lấy thông tin nhà hàng hiện tại (GET /restaurants/current)
  ✔ PASS: 10. Cập nhật thông tin nhà hàng & tài khoản VietQR (PUT /restaurants/current)
  ✔ PASS: 11. Quản lý chi nhánh CRUD (/branches)
  ✔ PASS: 12. Đăng xuất khỏi hệ thống (POST /auth/logout)
----------------------------------------------------
Kết quả kiểm thử: 12 passed, 0 failed
----------------------------------------------------
```

### Khi chạy `npm run test:multibranch`
```text
================================================================
  iMenu API - Phase 2: Multi-Branch & Isolation Test Suite      
================================================================
  ✔ PASS: 1. Đăng ký chuỗi nhà hàng và xác định chi nhánh chính
  ✔ PASS: 2. Tạo 2 chi nhánh con (Quận 3 & Bình Thạnh)
  ✔ PASS: 3. Bảo vệ chi nhánh chính: Chặn xóa và chặn đóng chi nhánh chính (400 Bad Request)
  ✔ PASS: 4. Vòng đời chi nhánh: Tạm đóng và mở lại chi nhánh con thành công (ACTIVE -> TEMPORARILY_CLOSED -> ACTIVE)
  ✔ PASS: 5. Tạo và đăng nhập tài khoản Quản lý Chi nhánh Quận 3
  ✔ PASS: 6. Cô lập chi nhánh con: Quản lý chi nhánh A chỉ thấy chi nhánh của mình, bị chặn 403 khi xem chi nhánh B
  ✔ PASS: 7. Phân quyền nhân sự chi nhánh: Chặn tạo nhân sự cho chi nhánh khác (403), cho phép tạo trong chi nhánh của mình
  ✔ PASS: 8. Điều chuyển nhân sự giữa các chi nhánh: Chặn chi nhánh con (403), chi nhánh chính điều chuyển thành công
  ✔ PASS: 9. Báo cáo doanh thu & Dashboard: Cách ly theo chi nhánh con (300k), báo cáo hợp nhất cho chi nhánh chính (800k)
  ✔ PASS: 10. Bảo toàn kế toán: Chặn xóa vật lý chi nhánh đã có đơn hàng lịch sử (400 Bad Request)
----------------------------------------------------------------
Kết quả kiểm thử: 10 passed, 0 failed
----------------------------------------------------------------
```
