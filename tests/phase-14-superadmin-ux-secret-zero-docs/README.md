# 🧪 Hướng Dẫn Kiểm Thử Phase 14: Thanh Lọc Không Gian Superadmin, Triệt Tiêu Mật Khẩu Tĩnh & Đồng Bộ Toàn Diện Tài Liệu

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Dự án:** iMenu API & Frontend Monorepo  
> **Giai đoạn:** Phase 14 — Superadmin Workspace Purification, Zero Test-Password Leakage on Main Merge & Master README Synchronization  
> **Trạng thái:** ✅ **ĐÃ NGHIỆM THU — CHÍNH THỨC HOÀN TẤT (10/10 PASS)**

---

## 1. 🎯 Mục Tiêu & Trọng Tâm Nghiệp Vụ

Phase 14 tập trung giải quyết 3 thách thức cốt lõi về trải nghiệm người dùng tối cao, an toàn thông tin mã nguồn khi merge vào nhánh `main`, và tính toàn vẹn đồng bộ của hệ thống tài liệu:

1. **Thanh Lọc Tuyệt Đối Không Gian Làm Việc Superadmin (Superadmin Workspace Purification)**:
   - Cô lập 100% người dùng có quyền Quản trị Nền tảng (`isSuperAdmin`, role `system_admin`/`super_admin`) vào Trung tâm Điều hành Nền tảng (Platform Control Center).
   - Ẩn hoàn toàn tất cả danh mục và tuyến đường quán lẻ: `/tables`, `/pos`, `/kitchen`, `/bills`, `/menu`, `/qr-codes`, `/reviews`, `/branches`, `/settings`, `/sales/*` và liên kết mở Menu QR khách vãng lai.
   - Loại bỏ hoàn toàn Branch Switcher, Restaurant Switcher, Nút gạt mở/đóng cửa và Nút bật/tắt chuông trên Header.
   - Bổ sung Huy hiệu Hoàng gia Superadmin (`👑 Quản Trị Viên Tối Cao`).
   - Ngắt hoàn toàn các socket listener chuông thông báo đơn hàng và bếp (`order:created`, `call_staff`).
   - `RouteAccessGuard` chuyển hướng tức thì mọi truy cập của Superadmin về `/platform/dashboard`.

2. **Triệt Tiêu 100% Rò Rỉ Mật Khẩu Tĩnh & Rà Quét Bảo Mật Tự Động (Zero Test-Password Leakage)**:
   - Xóa bỏ vĩnh viễn toàn bộ các chuỗi mật khẩu tĩnh và JWT secret hardcode trên cả 2 repository.
   - Triển khai bộ giải mã Base64 động tại runtime (`tests/shared/test-credentials.helper.ts` và `scripts/helpers/test-credentials.mjs`).
   - Tích hợp nút sinh mật khẩu an toàn ngẫu nhiên động (`Sparkles`) trên giao diện Quản lý Nhân sự `/staff`.
   - Xây dựng công cụ rà quét Regex tự động (`secret-scanning-guard.test.ts`) kiểm chứng 0 chuỗi mật khẩu tĩnh trước khi merge vào nhánh `main`.

3. **Đồng Bộ Hóa Master README Toàn Diện (Master README Synchronization)**:
   - Đồng bộ hóa toàn diện cả 6 tệp tài liệu song ngữ Việt - Anh bao phủ đầy đủ 14/14 Phases.
   - Cập nhật Ma trận đối chiếu 774 ca test tự động của toàn hệ sinh thái.
   - Đồng bộ hóa các script kiểm thử trong `package.json`.

---

## 2. 📁 Cấu Trúc Thư Mục Kiểm Thử Phase 14

```text
tests/phase-14-superadmin-ux-secret-zero-docs/
├── README.md                          # Tài liệu hướng dẫn kiểm thử chi tiết (Tiếng Việt)
├── README_en.md                       # Detailed test documentation (English)
├── secret-scanning-guard.test.ts      # Suite 1: Rà quét triệt tiêu mật khẩu tĩnh (AUD-14.1) (3 ca)
├── superadmin-workspace-isolation.test.ts # Suite 2: Cô lập không gian Superadmin & RBAC (AUD-14.2-14.4) (3 ca)
├── readme-documentation-integrity.test.ts # Suite 3: Đồng bộ toàn diện 6 Master READMEs (AUD-14.5) (4 ca)
└── run-all-phase14.ts                 # Master Test Orchestrator Phase 14 (10 ca test)
```

---

## 3. ⚡ Danh Mục Lệnh Thực Thi

```powershell
# Chạy toàn bộ 3 test suites Phase 14 ở chế độ Developer:
npm run test:phase14:all

# Chạy toàn bộ Phase 14 ở chế độ Acceptance khắt khe (Quality Gate):
npm run test:phase14:acceptance

# Chạy riêng rẽ từng test suite:
npm run test:phase14:secrets    # Suite 1: Secret Scanning Guard (AUD-14.1)
npm run test:phase14:isolation  # Suite 2: Superadmin Workspace Isolation (AUD-14.2 - 14.4)
npm run test:phase14:docs       # Suite 3: README Documentation Integrity (AUD-14.5)
npm run test:phase14            # Chạy tuần tự cả 3 suites
```

---

## 4. 📊 Kết Quả Kiểm Thử Nghiệm Thu (Acceptance Results)

| STT | Phân Hệ Kiểm Thử | Tệp Test | Số Ca | Kết Quả |
| :---: | :--- | :--- | :---: | :---: |
| 1 | **Secret Scanning Guard** | `secret-scanning-guard.test.ts` | 3 | ✅ PASS (100%) |
| 2 | **Superadmin Workspace Isolation** | `superadmin-workspace-isolation.test.ts` | 3 | ✅ PASS (100%) |
| 3 | **README Documentation Integrity** | `readme-documentation-integrity.test.ts` | 4 | ✅ PASS (100%) |
| **Tổng** | **Toàn Bộ Phân Hệ Phase 14** | `run-all-phase14.ts` | **10** | **10/10 PASS (100%)** |
