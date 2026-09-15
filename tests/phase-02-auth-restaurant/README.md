# 🧪 Tài Liệu Kiểm Thử Phase 2: Auth + Restaurant + Branch

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Module kiểm thử:** Xác thực (Authentication) + Nhà hàng (Restaurant) + Chi nhánh (Branch)  
> **Đặc tả kỹ thuật:** Theo tài liệu *iMenu - Backend Analysis & API Blueprint* (Mục 8.2 & Roadmap Phase 2 trang 36).

---

## 1. 📌 Mục Đích & Phạm Vi Kiểm Thử

Bộ kiểm thử này thực hiện kiểm tra tích hợp toàn diện từ đầu đến cuối (End-to-End Integration Testing) cho toàn bộ chức năng thuộc **Phase 2**, bao gồm:
- Quy trình đăng ký tài khoản chủ quán kèm khởi tạo nhà hàng và chi nhánh mặc định trong 1 transaction logic.
- Cơ chế băm mật khẩu bcrypt và sinh cặp mã xác thực JWT (`accessToken` & `refreshToken`).
- Cơ chế phân quyền RBAC: Tự động seed và gán vai trò `RESTAURANT_ADMIN` kèm danh mục 17 quyền chuẩn.
- Đăng nhập linh hoạt bằng `email` hoặc `username`, kiểm tra tính đúng đắn của mật khẩu và trạng thái kích hoạt tài khoản.
- Lấy profile tài khoản cá nhân qua token Bearer (`/api/auth/me`).
- Cơ chế cấp mới token qua refresh token (`/api/auth/refresh`).
- Quản lý cấu hình nhà hàng hiện tại và cập nhật tài khoản nhận tiền VietQR (`/api/restaurants/current`).
- Quản lý chi nhánh CRUD (`/api/branches`) kèm ràng buộc bảo vệ chi nhánh chính.
- Đăng xuất an toàn khỏi hệ thống (`/api/auth/logout`).

---

## 2. 📋 Danh Sách 12 Ca Kiểm Thử (Test Inventory)

| STT | Tên Kịch Bản | Phương Thức & Endpoint | Kỳ Vọng (Expected Output) |
| :---: | :--- | :--- | :--- |
| **1** | Đăng ký nhà hàng mới kèm chủ quán (Happy Path) | `POST /api/auth/register` | `201 Created`, trả về thông tin nhà hàng (auto-gen slug), user, `accessToken`, `refreshToken`. |
| **2** | Chặn đăng ký trùng Email | `POST /api/auth/register` | `409 Conflict`, báo lỗi "Email chủ quán đã được đăng ký". |
| **3** | Ràng buộc dữ liệu đầu vào (Validation) | `POST /api/auth/register` | `400 Bad Request` khi mật khẩu < 8 ký tự hoặc thiếu trường bắt buộc. |
| **4** | Đăng nhập thành công (Happy Path) | `POST /api/auth/login` | `200 OK`, trả về user, danh sách 17 quyền hạn chuẩn (`permissions`), `accessToken`, `refreshToken`. |
| **5** | Chặn đăng nhập sai mật khẩu | `POST /api/auth/login` | `401 Unauthorized`, từ chối truy cập. |
| **6** | Chặn đăng nhập email không tồn tại | `POST /api/auth/login` | `401 Unauthorized`, từ chối truy cập. |
| **7** | Lấy thông tin tài khoản hiện tại | `GET /api/auth/me` | `200 OK` khi gửi Bearer token hợp lệ; `401` nếu thiếu token. |
| **8** | Cấp mới Access Token qua Refresh Token | `POST /api/auth/refresh` | `200 OK`, trả về `accessToken` mới hợp lệ. |
| **9** | Lấy thông tin nhà hàng hiện tại | `GET /api/restaurants/current` | `200 OK`, trả về tên quán, hotline, địa chỉ, danh sách chi nhánh và cấu hình ngân hàng. |
| **10** | Cập nhật nhà hàng & tài khoản VietQR | `PUT /api/restaurants/current` | `200 OK`, cập nhật thành công và ghi nhận nhật ký kiểm toán (audit log). |
| **11** | Quản lý đa chi nhánh CRUD | `/api/branches` | `200/201 OK`, thêm chi nhánh phụ, cập nhật thông tin và xóa thành công (bảo vệ chi nhánh chính). |
| **12** | Đăng xuất tài khoản | `POST /api/auth/logout` | `200 OK`, kết thúc phiên làm việc thành công. |

---

## 3. ⚙️ Điều Kiện Tiên Quyết (Prerequisites)

1. **Node.js**: Phiên bản `>= 18.x` (khuyến nghị `20.x` LTS).
2. **MongoDB**: Đang chạy cục bộ tại `mongodb://localhost:27017/imenu-db` (hoặc cấu hình URI trong file `.env`).
3. **Dependencies**: Đã chạy `npm install` tại thư mục gốc `imenu-api`.

---
---

## 4. 🚀 Hướng Dẫn Chạy Kiểm Thử

Mở cửa sổ dòng lệnh (Terminal) tại thư mục `imenu-api`:

### Cách 1: Sử dụng NPM Script (Khuyến nghị)
```bash
npm run test:phase2
```

### Cách 2: Chạy trực tiếp bằng `ts-node`
```bash
npx ts-node tests/phase-02-auth-restaurant/test.ts
```

> [!TIP]
> **Chính sách Không Phát Sinh Rác (Zero-Garbage Policy)**:
> Bộ test tự động kết nối vào Database kiểm thử độc lập (`imenu-db-test`) và kích hoạt cơ chế `finally { await teardown(); }` dọn dẹp sạch sẽ 100% người dùng, nhà hàng và chi nhánh được tạo ra ngay sau khi hoàn thành. Database phát triển (`imenu-db`) hoàn toàn được giữ nguyên vẹn.

---

## 5. 🌱 Cơ Chế Khởi Tạo Dữ Liệu Demo (Seed CLI)

Hệ thống cung cấp lệnh CLI Seeder riêng biệt chạy độc lập (idempotent - an toàn, không sinh trùng lặp bản ghi):

```bash
# Seed dữ liệu mặc định (Roles, Admin, Demo Restaurant & Owner)
npm run seed

# Dọn dẹp dữ liệu demo cũ và seed lại mới
npm run seed:clean
```

---

## 6. 🔍 Kết Quả Kỳ Vọng Khi Chạy Thành Công

```text
====================================================
  iMenu API - Phase 2: Auth + Restaurant Test Suite  
====================================================

Khởi động test server trên port 3099 ...
Test server đã sẵn sàng! (DB: imenu-db-test)

  ✔ PASS: 1. Đăng ký nhà hàng mới kèm chủ quán (POST /auth/register) (Slug: bep-nha-sai-gon)
  ✔ PASS: 2. Chặn đăng ký trùng email (409 Conflict)
  ✔ PASS: 3. Kiểm tra tính hợp lệ dữ liệu đăng ký (400 Bad Request cho password < 8 ký tự)
  ✔ PASS: 4. Đăng nhập thành công (POST /auth/login) (17 quyền hạn)
  ✔ PASS: 5. Chặn đăng nhập sai mật khẩu (401 Unauthorized)
  ✔ PASS: 6. Chặn đăng nhập email không tồn tại (401 Unauthorized)
  ✔ PASS: 7. Lấy thông tin tài khoản hiện tại (GET /auth/me) (User: Nguyễn Văn Kiểm Thử)
  ✔ PASS: 8. Làm mới Access Token (POST /auth/refresh)
  ✔ PASS: 9. Lấy thông tin nhà hàng hiện tại (GET /restaurants/current) (Tên quán: Bếp Nhà Sài Gòn)
  ✔ PASS: 10. Cập nhật thông tin nhà hàng & tài khoản VietQR (PUT /restaurants/current) (Đã lưu cấu hình ngân hàng)
  ✔ PASS: 11. Quản lý chi nhánh CRUD (/branches) (Tạo, sửa, xóa chi nhánh phụ thành công)
  ✔ PASS: 12. Đăng xuất khỏi hệ thống (POST /auth/logout)

----------------------------------------------------
Kết quả kiểm thử: 12 passed, 0 failed
----------------------------------------------------

[Teardown] Tự động dọn dẹp tài nguyên kiểm thử...
  ✔ Đã dọn dẹp sạch sẽ toàn bộ dữ liệu test (Zero Garbage)
```

---

## 7. 🛠️ Khắc Phục Lỗi Thường Gặp (Troubleshooting)

- **Lỗi không kết nối được MongoDB (`MongoServerSelectionError`)**:
  - Hãy kiểm tra xem service MongoDB đã được khởi động chưa (`Get-Process mongod` hoặc `docker ps`).
  - Đảm bảo port `27017` đang hoạt động bình thường.
- **Lỗi trùng cổng 3099 (`EADDRINUSE`)**:
  - Kiểm tra tiến trình đang chiếm port 3099: `netstat -ano | findstr 3099`.
  - Tắt tiến trình cũ hoặc thay đổi hằng số `TEST_PORT` trong file `test.ts`.
