# 🧪 Trung Tâm Kiểm Thử Tự Động iMenu Backend (Test Suite Master Index)

> **Ngôn ngữ:** [🇻🇳 Tiếng Việt](README.md) | [🇬🇧 English](README_en.md)  
> **Dự án:** iMenu API Backend  
> **Quy ước kiến trúc kiểm thử:** `ONE PHASE = ONE TEST DIRECTORY` (Mỗi Phase sở hữu đúng một thư mục kiểm thử duy nhất. Tất cả test file của các Sub-phase nằm trực tiếp trong thư mục Phase đó).

---

## 1. 📁 Cấu Trúc Thư Mục Kiểm Thử (Phase Directory Layout)

Hệ thống kiểm thử của dự án `imenu-api` được tổ chức theo quy tắc nghiêm ngặt: **Mỗi Phase tương ứng với một thư mục kiểm thử độc lập**. Tất cả các tệp kiểm thử tự động thuộc Phase đó (kể cả khi chia thành nhiều Sub-phase nghiệp vụ) đều nằm trực tiếp bên trong thư mục của Phase, đi kèm tài liệu hướng dẫn song ngữ:

```text
tests/
├── README.md                          # Mục lục & Quy ước kiểm thử tổng thể (Tiếng Việt)
├── README_en.md                       # Master testing index & conventions (English)
│
├── phase-02-auth-restaurant/           # [HOÀN THÀNH] Phase 2: Xác thực, Nhà hàng & Multi-Branch
│   ├── test.ts                        # Kịch bản E2E Phần 1: Auth, Restaurant & Branch CRUD (12 ca)
│   ├── test-multi-branch.ts           # Kịch bản E2E Phần 2: Multi-Branch Lifecycle & Isolation (10 ca)
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 2 chi tiết (Tiếng Việt)
│   └── README_en.md                   # Detailed Phase 2 test guide (English)
│
├── phase-03-staff-rbac/               # [HOÀN THÀNH] Phase 3: Nhân sự, Phân quyền RBAC & Auto-Redirect
│   ├── test.ts                        # Kịch bản E2E: Super Admin ENV, Soft Delete, Cross-Tenant Staff, VietQR (16 ca)
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 3 chi tiết (Tiếng Việt)
│   └── README_en.md                   # Detailed Phase 3 test guide (English)
│
├── phase-04-menu/                     # [HOÀN THÀNH] Phase 4: Thực đơn, Danh mục & Topping
│   ├── test.ts                        # Kịch bản E2E: Danh mục, Món ăn, Toppings, Thu ngân toggle, QR (13 ca)
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 4 chi tiết (Tiếng Việt)
│   └── README_en.md                   # Detailed Phase 4 test guide (English)
│
├── phase-05-order-table-kds/          # [HOÀN THÀNH] Phase 5: Quản lý Bàn, Đơn hàng & Realtime KDS
│   ├── test.ts                        # Kịch bản E2E: Bàn, Khu vực, Đơn hàng, KDS WebSocket, RBAC (18 ca)
│   ├── README.md                      # Hướng dẫn kiểm thử Phase 5 chi tiết (Tiếng Việt)
│   └── README_en.md                   # Detailed Phase 5 test guide (English)
│
└── phase-06-order-pos/                # [HOÀN THÀNH TOÀN DIỆN & ĐÃ ĐÓNG] Phase 6: Vận hành Order & POS
    ├── README.md                      # Hướng dẫn kiểm thử Phase 6 toàn diện (Tiếng Việt)
    ├── README_en.md                   # Comprehensive Phase 6 test guide (English)
    ├── state-machine.test.ts          # Sub-phase 6.2: State Machine, Round/Item Cancellation & Invariants (56 ca)
    ├── pos-cashier.test.ts            # Sub-phase 6.3: POS Cashier, Thuế/Phí, Cash Change & VietQR (30 ca)
    ├── customer-qr.test.ts            # Sub-phase 6.4: Customer QR Ordering & Staff Approval (34 ca)
    ├── idempotency-concurrency.test.ts# Sub-phase 6.5: Idempotency Key & Concurrent Payment Protection (36 ca)
    ├── table-order-sync.test.ts       # Sub-phase 6.6: Table Transfer, Merge, Move Items & CAS Locks (38 ca)
    └── order-query.test.ts            # Sub-phase 6.7: Order Query, Filters, Search & Branch Isolation (31 ca)
```

---

## 2. 🗺️ Ánh Xạ Các Sub-phase Của Phase 6 (Phase 6 Sub-phase Mapping)

Toàn bộ các phân hệ của Phase 6 được tích hợp tập trung vào thư mục `tests/phase-06-order-pos/`:

| Phân hệ / Sub-phase | Tệp Kiểm Thử | Trọng Tâm Nghiệp Vụ | Số Ca Test | Trạng Thái |
| :--- | :--- | :--- | :---: | :---: |
| **6.2 State Machine** | `state-machine.test.ts` | Máy trạng thái vòng đời đơn, Invariants, hủy món/round | 56 | **PASS** |
| **6.3 POS Cashier** | `pos-cashier.test.ts` | Máy thu ngân, VAT, Service fee, Cash tiền thừa, VietQR | 30 | **PASS** |
| **6.4 Customer QR** | `customer-qr.test.ts` | Khách quét mã QR gọi món, duyệt đợt gọi món | 34 | **PASS** |
| **6.5 Idempotency** | `idempotency-concurrency.test.ts` | Header `X-Idempotency-Key`, chống duplicate charge | 36 | **PASS** |
| **6.6 Table Sync** | `table-order-sync.test.ts` | Đổi bàn, gộp bàn, di chuyển món, tách bill, khóa CAS | 38 | **PASS** |
| **6.7 Order Query** | `order-query.test.ts` | Lọc thời gian, nhân viên, đa trạng thái, regex search, phân lập chi nhánh | 31 | **PASS** |

---

## 3. ⚡ Danh Mục Lệnh Thực Thi Kiểm Thử (Master Test Commands)

Tất cả các lệnh kiểm thử được đăng ký tại `package.json`:

### 🔹 Kiểm thử theo từng Phase:
```powershell
# Phase 2: Auth, Nhà hàng & Multi-Branch
npm run test:phase2:all

# Phase 3: Nhân sự & Phân quyền RBAC
npm run test:phase3

# Phase 4: Thực đơn, Danh mục & Toppings
npm run test:phase4

# Phase 5: Bàn ăn, Đơn hàng & Realtime KDS
npm run test:phase5
```

### 🔹 Kiểm thử Phase 6 (Order & POS):
```powershell
# Chạy toàn bộ 6 tệp kiểm thử của Phase 6
npm run test:phase6

# Hoặc chạy riêng từng tệp theo phân hệ:
npm run test:phase6:transitions  # Sub-phase 6.2: State Machine (state-machine.test.ts)
npm run test:phase6:pos          # Sub-phase 6.3: POS Cashier (pos-cashier.test.ts)
npm run test:phase6:customer-qr  # Sub-phase 6.4: Customer QR (customer-qr.test.ts)
npm run test:phase6:concurrency  # Sub-phase 6.5: Idempotency (idempotency-concurrency.test.ts)
npm run test:phase6:sync         # Sub-phase 6.6: Table Sync & Transfer (table-order-sync.test.ts)
npm run test:phase6:query        # Sub-phase 6.7: Order Query & Filters (order-query.test.ts)
```

---

## 4. 🎯 Quy Ước Bắt Buộc Khi Thêm Test Cho Phase Mới

1. **`ONE PHASE = ONE DIRECTORY`**: Mỗi Phase mới tạo **đúng một thư mục duy nhất** mang tên `tests/phase-XX-<ten-phase>/`. Tuyệt đối không tạo thư mục con cho từng Sub-phase.
2. **Đặt tên tệp kiểm thử**: Tệp kiểm thử mang tên có ý nghĩa phản ánh đúng phân hệ, định dạng `<subphase-name>.test.ts` hoặc `test.ts` nếu phase chỉ có một tệp duy nhất.
3. **Tài liệu song ngữ**: Bắt buộc có `README.md` (Tiếng Việt) và `README_en.md` (Tiếng Anh) bên trong thư mục Phase.
4. **Cập nhật Master Index**: Cập nhật danh mục và lệnh thực thi vào cả hai tệp `tests/README.md` và `tests/README_en.md`.
5. **Đăng ký NPM Scripts**: Đăng ký script tiện ích vào `package.json` theo đúng quy ước `test:phaseX:...`.
