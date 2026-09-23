# 🧪 Trung Tâm Kiểm Thử Tự Động iMenu Backend (Test Suite Master Index)

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Dự án:** iMenu API Backend  
> **Kiến trúc:** Phân chia thư mục kiểm thử độc lập theo từng Phase của tài liệu Blueprint.

---

## 1. 📁 Cấu Trúc Thư Mục Kiểm Thử (Phase Directory Layout)

Hệ thống kiểm thử của dự án `imenu-api` được phân tách theo từng Phase nghiệp vụ rõ ràng, mỗi Phase sở hữu mã nguồn kiểm thử và tài liệu hướng dẫn song ngữ (Việt - Anh):

```text
tests/
├── README.md                      # Mục lục & hướng dẫn tổng quan (Tiếng Việt)
├── README_en.md                   # Master testing documentation (English)
│
├── phase-02-auth-restaurant/       # [HOÀN THÀNH] Phase 2: Xác thực, Nhà hàng & Multi-Branch
│   ├── test.ts                    # Kịch bản E2E Phần 1: Auth, Restaurant & Branch CRUD (12 ca)
│   ├── test-multi-branch.ts       # Kịch bản E2E Phần 2: Multi-Branch Lifecycle & Isolation (10 ca)
│   ├── README.md                  # Hướng dẫn kiểm thử Phase 2 chi tiết (Tiếng Việt)
│   └── README_en.md               # Detailed Phase 2 test guide (English)
│
├── phase-03-staff-rbac/           # [HOÀN THÀNH] Phase 3: Nhân sự & Ma trận phân quyền
│   ├── test.ts                    # Kịch bản E2E: Super Admin ENV, Soft Delete, Cross-Tenant Staff & Roles (12 ca)
│   ├── README.md                  # Hướng dẫn kiểm thử Phase 3 chi tiết (Tiếng Việt)
│   └── README_en.md               # Detailed Phase 3 test guide (English)
│
├── phase-04-menu/                 # [LỘ TRÌNH] Phase 4: Thực đơn, Danh mục & Topping
│   ├── README.md
│   └── README_en.md
│
├── phase-05-zone-table-qr/        # [LỘ TRÌNH] Phase 5: Bàn, Khu vực & Mã QR
│   ├── README.md
│   └── README_en.md
│
├── phase-06-order-pos/            # [LỘ TRÌNH] Phase 6: Vận hành Order & POS
│   ├── README.md
│   └── README_en.md
│
├── phase-07-kitchen-kds/          # [LỘ TRÌNH] Phase 7: Màn hình Bếp KDS
│   ├── README.md
│   └── README_en.md
│
├── phase-08-payment-bill/         # [LỘ TRÌNH] Phase 8: Hóa đơn & Thanh toán VietQR
│   ├── README.md
│   └── README_en.md
│
├── phase-09-dashboard-reports/    # [LỘ TRÌNH] Phase 9: Dashboard & Báo cáo doanh thu
│   ├── README.md
│   └── README_en.md
│
└── phase-10-realtime/             # [LỘ TRÌNH] Phase 10: WebSocket & Thông báo thời gian thực
    ├── README.md
    └── README_en.md
```

---

## 2. ⚡ Lệnh Thực Thi Nhanh (Quick Commands)

Các lệnh kiểm thử được đăng ký trực tiếp trong `package.json` của `imenu-api`:

| Phase | Lệnh NPM | Lệnh Trực Tiếp | Trọng Tâm | Trạng Thái |
| :--- | :--- | :--- | :--- | :---: |
| **Phase 2 - Phần 1** | `npm run test:phase2` | `npx ts-node tests/phase-02-auth-restaurant/test.ts` | Auth, Restaurant & Branch CRUD | **12/12 PASSED** |
| **Phase 2 - Phần 2** | `npm run test:multibranch` | `npx ts-node tests/phase-02-auth-restaurant/test-multi-branch.ts` | Multi-Branch Lifecycle & Isolation | **10/10 PASSED** |
| **Phase 2 - Toàn bộ** | `npm run test:phase2:all` | Chạy tuần tự cả 2 file trên | 22 kịch bản tích hợp Phase 2 | **22/22 PASSED** |
| **Phase 3 - Staff & RBAC** | `npm run test:phase3` | `npx ts-node tests/phase-03-staff-rbac/test.ts` | Super Admin, Soft Delete, Staff & RBAC | **12/12 PASSED** |
| **Toàn bộ hệ thống** | `npm test` | `jest` | Unit tests toàn dự án | Đang cấu hình |

---

## 3. 🎯 Quy Ước Viết Test Cho Các Phase Tiếp Theo

Mỗi thư mục Phase mới khi phát triển phải tuân thủ nghiêm ngặt chuẩn sau:
1. **`test.ts`**: Chứa kịch bản kiểm thử độc lập, có thể tự động bật server test trên port biệt lập (ví dụ `3099`) và dọn dẹp tài nguyên sau khi chạy xong.
2. **`README.md`**: Bản tài liệu Tiếng Việt mô tả chi tiết: mục đích, bảng kịch bản kiểm thử (Test Inventory), điều kiện tiên quyết, cách chạy và cách sửa lỗi.
3. **`README_en.md`**: Bản tài liệu Tiếng Anh tương ứng.
4. Đăng ký script tiện ích vào `package.json` theo mẫu `"test:phaseX": "ts-node tests/phase-XX-.../test.ts"`.
