# 🧪 Hướng Dẫn Kiểm Thử Phase 15: Hoàn Thiện Phân Hệ Superadmin, Chế Độ Hỗ Trợ Kỹ Thuật & Đồng Bộ RBAC Toàn Diện

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Dự án:** iMenu API & Frontend Monorepo  
> **Giai đoạn:** Phase 15 — Superadmin Completion & RBAC Sync (Hoàn thiện Superadmin, Chế độ Impersonation & Đồng bộ RBAC)  
> **Trạng thái:** ✅ **ĐÃ HOÀN THIỆN TOÀN DIỆN & KIỂM THỬ PASS 100% (75/75 TEST CASES)**

---

## 1. 🎯 Mục Tiêu & Trọng Tâm Nghiệp Vụ

Phase 15 tập trung giải quyết triệt để các tồn đọng nghiệp vụ của phân hệ Superadmin và đồng bộ phân quyền RBAC đa không gian làm việc giữa Superadmin, Sales Rep, Chủ nhà hàng và Nhân viên vận hành:

1. **Hoàn Thiện 4 Trang Nghiệp Vụ Quản Trị Nền Tảng (Platform Center - 4 Core Modules)**:
   - **Dashboard Nền Tảng (`/platform/dashboard`)**: Tổng hợp KPI toàn sàn, theo dõi doanh thu kép (F&B GMV vs SaaS Fee), tăng trưởng điểm bán và hoa hồng đối tác thời gian thực.
   - **Vòng Đời Nhà Hàng (`/platform/restaurants`)**: Tìm kiếm, lọc trạng thái, tạm khóa nhà hàng kèm lý do vi phạm (`isSuspended: true`), mở khóa và `$unset` lý do khóa triệt để; nâng cấp/gia hạn gói cước với ngày hết hạn tùy chỉnh và ghi chú kiểm toán lưu vào lịch sử giao dịch.
   - **Đối Soát Doanh Thu Kép (`/platform/revenues`)**: Tích hợp bộ chọn khoảng ngày (Từ ngày - Đến ngày) với API doanh thu kép để đối soát minh bạch giữa GMV bán lẻ của từng quán và doanh thu SaaS của nền tảng.
   - **Kinh Doanh & Hoa Hồng (`/platform/sales`)**: Quản lý hồ sơ NVKD; chỉnh sửa chính sách hoa hồng Setup/Renewal và tài khoản ngân hàng thụ hưởng thông qua Modal tương tác; phê duyệt đơn ứng tuyển NVKD online; đối soát hoa hồng toàn sàn và duyệt chi trả nguyên tử (`payout-batch`).

2. **Chế Độ Hỗ Trợ Kỹ Thuật Nhà Hàng (Superadmin Impersonation Support Mode)**:
   - Cho phép Superadmin chọn một nhà hàng cụ thể trực tiếp trên Header (`AdminHeader.tsx`) để vào chế độ hỗ trợ kỹ thuật.
   - Hiển thị Sticky Support Banner màu hổ phách cảnh báo rõ ràng cùng nút "Thoát hỗ trợ".
   - Mở rộng menu Sidebar (`AdminSidebar.tsx`) cho phép Superadmin thao tác trên các trang cấu hình vận hành cơ sở (`/branches`, `/settings`) mà không cần đổi tài khoản và không bị chặn quyền.
   - Triệt tiêu hoàn toàn lỗi `400 Bad Request` khi chưa chọn nhà hàng cụ thể (`effectiveRestaurantId`).

3. **Cách Ly Ranh Giới RBAC & Ngăn Chặn Leo Thang Đặc Quyền (Strict RBAC Isolation & Privilege Escalation Prevention)**:
   - `SuperAdminGuard` bảo vệ tuyệt đối tất cả các endpoint `/api/platform/*`: Chặn đứng tài khoản Sales Rep (403), Chủ quán (403), Thu ngân/Bếp (403) và Khách vãng lai (401).
   - Cơ chế thu hồi phiên đăng nhập tức thì (`$inc: { tokenVersion: 1 }`) và kiểm tra đa tầng trong `jwt.strategy.ts` chặn ngay lập tức nhân viên của nhà hàng khi quán bị tạm khóa (`isSuspended: true`).
   - Ngăn chặn chi trả hoa hồng đúp (Double-Payout Prevention) bằng cập nhật có điều kiện nguyên tử trên MongoDB.

4. **Tuân Thủ Tuyệt Đối Secret-Zero (Zero Hardcoded Credentials)**:
   - 100% tài khoản kiểm thử được lấy động từ môi trường qua `test-credentials.helper.ts` và `test-credentials.mjs`.

---

## 2. 📁 Cấu Trúc Thư Mục Kiểm Thử Phase 15

```text
tests/phase-15-superadmin-completion/
├── README.md                                 # Tài liệu hướng dẫn kiểm thử chi tiết (Tiếng Việt)
├── README_en.md                              # Detailed test documentation (English)
├── superadmin-restaurant-lifecycle.test.ts   # Suite 1: Vòng đời nhà hàng, gói cước & lịch sử (P15-01) (5 ca)
├── superadmin-sales-management.test.ts       # Suite 2: Quản lý NVKD, chính sách hoa hồng & duyệt ứng tuyển (P15-02) (4 ca)
├── superadmin-payout-and-commissions.test.ts # Suite 3: Sổ cái hoa hồng toàn sàn & Payout Batch nguyên tử (P15-03) (4 ca)
├── superadmin-impersonation-rbac.test.ts     # Suite 4: Chế độ hỗ trợ Impersonation & cách ly ranh giới RBAC (P15-04) (5 ca)
└── run-all-phase15.ts                        # Master Test Orchestrator Phase 15 (75 ca test)
```

---

## 3. ⚡ Danh Mục Lệnh Thực Thi

```powershell
# Chạy toàn bộ 5 test suites Phase 15 ở chế độ Developer:
npm run test:phase15:all

# Chạy toàn bộ Phase 15 ở chế độ Acceptance khắt khe (Quality Gate):
npm run test:phase15:acceptance

# Chạy riêng lẻ từng test suite Backend:
npm run test:phase15:lifecycle  # Suite 1: Vòng đời nhà hàng & gói cước (Port 3151)
npm run test:phase15:sales      # Suite 2: Quản lý NVKD & hoa hồng (Port 3152)
npm run test:phase15:payout     # Suite 3: Sổ cái hoa hồng & Payout batch (Port 3153)
npm run test:phase15:rbac       # Suite 4: Chế độ hỗ trợ & RBAC isolation (Port 3154)
npm run test:phase15            # Chạy tuần tự 4 suites backend

# Chạy kiểm thử hợp đồng Frontend SDK Contract:
npx ts-node ../imenu-menudientu/packages/utils/tests/sdk-contract.test.ts
```

---

## 4. 📊 Ma Trận Kết Quả Kiểm Thử Nghiệm Thu (Acceptance Results)

| STT | Phân Hệ Kiểm Thử | Tệp Test | Số Ca | Kết Quả | Chi Tiết Nghiệp Vụ |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **1** | **Vòng đời Nhà hàng & Gói cước** | `superadmin-restaurant-lifecycle.test.ts` | 5 | ✅ PASS (100%) | Lọc quán, tạm khóa quán (`isSuspended: true`), mở khóa và `$unset` lý do khóa, gia hạn gói Enterprise kèm ghi chú giao dịch, cập nhật qua `PUT /restaurants/:id`. |
| **2** | **Quản lý NVKD & Chính sách Hoa hồng** | `superadmin-sales-management.test.ts` | 4 | ✅ PASS (100%) | Tạo NVKD mới kèm tỷ lệ hoa hồng & tài khoản ngân hàng, cập nhật chính sách, khóa/mở tài khoản NVKD, duyệt đơn ứng tuyển online cấp tài khoản tự động. |
| **3** | **Sổ cái Hoa hồng & Payout Batch** | `superadmin-payout-and-commissions.test.ts` | 4 | ✅ PASS (100%) | Superadmin truy vấn hoa hồng toàn sàn theo kỳ & trạng thái, duyệt hàng loạt (`APPROVE`), chốt thanh toán (`PAY`) kèm mã tham chiếu ngân hàng, chống thanh toán đúp nguyên tử. |
| **4** | **Chế độ Hỗ trợ & Rào cản RBAC** | `superadmin-impersonation-rbac.test.ts` | 5 | ✅ PASS (100%) | `GET /branches` trả về rỗng không lỗi 400, tạo chi nhánh cho quán trong chế độ hỗ trợ, đóng/mở chi nhánh, tạo vai trò phân quyền, rào cản RBAC 403/401 đa phân hệ. |
| **5** | **Frontend SDK Contract Verification** | `sdk-contract.test.ts` | 57 | ✅ PASS (100%) | Đồng bộ SDK-53 (`platform.getCommissions`), SDK-54 (`restaurant.updateById`), SDK-55 (`branches.create` với optional `restaurantId`). |
| **Tổng** | **Toàn Bộ Phân Hệ Phase 15** | `run-all-phase15.ts` | **75** | **75/75 PASS (100%)** | Toàn bộ 5 test suites đạt 100% PASS, 0 lỗi, 0 ca bỏ qua. |
