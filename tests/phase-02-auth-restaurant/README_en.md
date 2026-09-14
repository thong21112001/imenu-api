# 🧪 Phase 2 Test Documentation: Auth + Restaurant + Branch

> **Language:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Target Module:** Authentication + Restaurant Management + Branch Management  
> **Specification Reference:** *iMenu - Backend Analysis & API Blueprint* (Section 8.2 & Phase 2 Roadmap on page 36).

---

## 1. 📌 Purpose & Test Scope

This automated End-to-End (E2E) integration test suite verifies the complete feature set of **Phase 2**, ensuring enterprise-grade stability before production deployment:
- Registering a new restaurant along with the owner account and default main branch in an atomic business transaction.
- Secure password hashing via bcrypt and cryptographic JWT token pair generation (`accessToken` & `refreshToken`).
- RBAC Permission Enforcement: Automatically seeding and binding `RESTAURANT_ADMIN` role with all 17 system permissions.
- Flexible authentication supporting either `email` or `username`, credential verification, and account status validation.
- Current user profile and permission catalog retrieval via Bearer token (`/api/auth/me`).
- Token renewal workflow using refresh token (`/api/auth/refresh`).
- Active restaurant settings retrieval and VietQR bank configuration persistence (`/api/restaurants/current`).
- Full CRUD operations on restaurant branches (`/api/branches`) with main branch deletion guards.
- Secure session termination and logout (`/api/auth/logout`).

---

## 2. 📋 Test Inventory (12 Test Scenarios)

| # | Test Scenario | Method & Endpoint | Expected Output |
| :---: | :--- | :--- | :--- |
| **1** | Register new restaurant & owner (Happy Path) | `POST /api/auth/register` | `201 Created`, returns restaurant info (auto-generated unique slug), user info, `accessToken`, and `refreshToken`. |
| **2** | Prevent duplicate email registration | `POST /api/auth/register` | `409 Conflict`, returns "Email chủ quán đã được đăng ký". |
| **3** | Input validation enforcement | `POST /api/auth/register` | `400 Bad Request` when password < 8 chars or required fields are missing. |
| **4** | Successful login (Happy Path) | `POST /api/auth/login` | `200 OK`, returns user profile, 17 system permissions, `accessToken`, and `refreshToken`. |
| **5** | Reject invalid password | `POST /api/auth/login` | `401 Unauthorized`, access denied. |
| **6** | Reject non-existent email | `POST /api/auth/login` | `401 Unauthorized`, access denied. |
| **7** | Retrieve profile with Bearer token | `GET /api/auth/me` | `200 OK` with valid Bearer token; `401` when token is missing or invalid. |
| **8** | Renew Access Token via Refresh Token | `POST /api/auth/refresh` | `200 OK`, returns a new valid `accessToken`. |
| **9** | Retrieve active restaurant profile | `GET /api/restaurants/current` | `200 OK`, returns restaurant brand details, hotline, address, branches, and VietQR bank details. |
| **10** | Update restaurant profile & VietQR bank info | `PUT /api/restaurants/current` | `200 OK`, successfully persists changes and logs audit trail. |
| **11** | Multi-branch CRUD management | `/api/branches` | `200/201 OK`, adds secondary branch, updates information, and deletes with main branch protection. |
| **12** | Account logout | `POST /api/auth/logout` | `200 OK`, terminates user session successfully. |

---

## 3. ⚙️ Prerequisites

1. **Node.js**: Version `>= 18.x` (`20.x` LTS recommended).
2. **MongoDB**: Running locally at `mongodb://localhost:27017/imenu-db` (or as configured in `.env`).
3. **Dependencies**: Installed via `npm install` in `imenu-api`.

---

## 4. 🚀 How to Execute the Tests

From the root directory of `imenu-api`:

### Option A: Using NPM Script (Recommended)
```bash
npm run test:phase2
```

### Option B: Running directly with `ts-node`
```bash
npx ts-node tests/phase-02-auth-restaurant/test.ts
```

---

## 5. 🔍 Expected Console Output

```text
====================================================
  iMenu API - Phase 2: Auth + Restaurant Test Suite  
====================================================

Khởi động test server trên port 3099 ...
Test server đã sẵn sàng!

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
```

---

## 6. 🛠️ Troubleshooting

- **MongoDB Connection Error (`MongoServerSelectionError`)**:
  - Verify that the MongoDB service is active (`Get-Process mongod` on PowerShell or `docker ps`).
  - Verify that port `27017` is accessible.
- **Port Conflict on 3099 (`EADDRINUSE`)**:
  - Check for processes occupying port 3099: `netstat -ano | findstr 3099`.
  - Terminate the lingering process or update `TEST_PORT` in `test.ts`.
