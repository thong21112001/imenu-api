# 🧪 Phase 2 Test Documentation: Auth + Restaurant + Multi-Branch

> **Language:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Target Module:** Authentication + Restaurant Management + Multi-Branch Management & Isolation  
> **Specification Reference:** *iMenu - Backend Analysis & API Blueprint* (Phase 2 Roadmap & Multi-Branch Head Office Architecture).

---

## 1. 📁 Directory Structure & Test Suites

This directory contains **2 independent End-to-End (E2E) Integration Test Suites**:

| Test File | Test Suite Name | Scenarios | Execution Command | Primary Focus |
| :--- | :--- | :---: | :--- | :--- |
| [`test.ts`](test.ts) | **Part 1: Auth + Restaurant + Branch CRUD** | 12 cases | `npm run test:phase2` | Registration flow, JWT login/refresh, Profile, VietQR config, Basic branch CRUD |
| [`test-multi-branch.ts`](test-multi-branch.ts) | **Part 2: Multi-Branch & Isolation** | 10 cases | `npm run test:multibranch` | Main branch invariant, Lifecycle (Close/Reopen/Deactivate), Data isolation, Staff transfer, Consolidated revenue |
| **Both Suites** | **Complete Phase 2 Test Suite** | **22 cases** | `npm run test:phase2:all` | Runs both integration test suites sequentially |

---

## 2. 📋 Test Scenarios Inventory

### Part 1: Core Functionality (`test.ts` - 12 Cases)

| # | Test Scenario | Method & Endpoint | Expected Output |
| :---: | :--- | :--- | :--- |
| **1** | Register new restaurant & owner (Happy Path) | `POST /api/auth/register` | `201 Created`, returns restaurant info (auto-generated unique slug), user info, `accessToken`, and `refreshToken`. |
| **2** | Prevent duplicate email registration | `POST /api/auth/register` | `409 Conflict`, returns duplicate email message. |
| **3** | Input validation enforcement | `POST /api/auth/register` | `400 Bad Request` when password < 8 chars or required fields are missing. |
| **4** | Successful login (Happy Path) | `POST /api/auth/login` | `200 OK`, returns user profile, system permissions, `accessToken`, and `refreshToken`. |
| **5** | Reject invalid password | `POST /api/auth/login` | `401 Unauthorized`, access denied. |
| **6** | Reject non-existent email | `POST /api/auth/login` | `401 Unauthorized`, access denied. |
| **7** | Retrieve profile with Bearer token | `GET /api/auth/me` | `200 OK` with valid Bearer token. |
| **8** | Renew Access Token via Refresh Token | `POST /api/auth/refresh` | `200 OK`, returns a new valid `accessToken`. |
| **9** | Retrieve active restaurant profile | `GET /api/restaurants/current` | `200 OK`, returns restaurant brand details, hotline, address, branches, and VietQR bank details. |
| **10** | Update restaurant profile & VietQR bank info | `PUT /api/restaurants/current` | `200 OK`, successfully persists changes and logs audit trail. |
| **11** | Multi-branch CRUD management | `/api/branches` | `200/201 OK`, adds secondary branch, updates info, and deletes with main branch protection. |
| **12** | Account logout | `POST /api/auth/logout` | `200 OK`, terminates user session successfully. |

---

### Part 2: Multi-Branch & Data Isolation (`test-multi-branch.ts` - 10 Cases)

| # | Test Scenario | Method & Endpoint | Business Logic & Expected Output |
| :---: | :--- | :--- | :--- |
| **1** | **Identify Main Branch** | `POST /api/auth/register` | Registers restaurant chain; initial branch is automatically flagged as `isMainBranch = true`. |
| **2** | **Create Child Branches** | `POST /api/branches` | Main branch creates 2 child branches: District 3 and Binh Thanh (`isMainBranch = false`). |
| **3** | **Protect Main Branch** | `DELETE & PATCH /close` | **Rejects deletion (`400`)** and **rejects temporary closure (`400`)** of the main branch (headquarters). |
| **4** | **Branch Lifecycle Management** | `PATCH /close & /reopen` | Temporarily closes (`TEMPORARILY_CLOSED`) and reopens (`ACTIVE`) secondary branches. |
| **5** | **Branch Manager Login** | `POST /users & /login` | Creates manager account for District 3 and logs in to obtain branch-scoped JWT token. |
| **6** | **Branch Data Isolation** | `GET /branches & /:id` | Branch A manager **only sees their own branch**; returns **`403 Forbidden`** when attempting to access Branch B. |
| **7** | **Branch Staff Scoping** | `POST /users` & `GET /users` | **`403 Forbidden`** when branch manager tries to create staff for another branch; allowed for own branch; staff list is filtered. |
| **8** | **Cross-Branch Staff Transfer** | `POST /users/:id/transfer` | **`403 Forbidden`** for branch managers; **Restaurant Admin / Main Branch** can transfer staff (`200 OK`). |
| **9** | **Consolidated vs Scoped Revenue** | `/reports/revenue` & `/dashboard/overview` | Branch manager **only sees own revenue** ($300k); **`403`** for chain totals; Main branch sees **consolidated reports** ($800k) with branch breakdown. |
| **10** | **Historical Accounting Protection** | `DELETE /branches/:id` | **Rejects physical deletion (`400 Bad Request`)** for branches with historical orders to safeguard audit logs. |

---

## 3. ⚙️ Prerequisites

1. **Node.js**: Version `>= 18.x` (`20.x` LTS recommended).
2. **MongoDB**: Running locally at `mongodb://localhost:27017/imenu-db` (or as configured in `.env`).
3. **Dependencies**: Installed via `npm install` in `imenu-api`.

---

## 4. 🚀 How to Execute the Tests

From the root directory of `imenu-api`:

### Run Part 1 (Auth + Restaurant + Branch CRUD)
```bash
npm run test:phase2
```

### Run Part 2 (Multi-Branch & Data Isolation)
```bash
npm run test:multibranch
```

### Run All 22 Phase 2 Integration Tests
```bash
npm run test:phase2:all
```

> [!TIP]
> **Zero-Garbage Policy & Test Isolation**:
> Both test runners route operations to an isolated test database (`imenu-db-test`) and trigger automated cleanup in `finally { await teardown(); }` to purge 100% of test records upon completion.

---

## 5. 🔍 Expected Console Output

### Running `npm run test:phase2`
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

### Running `npm run test:multibranch`
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
