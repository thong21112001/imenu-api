# Kiểm Thử Tích Hợp Phase 5: Quản Lý Đơn Hàng, Sơ Đồ Bàn & KDS Realtime qua WebSocket

Bộ kiểm thử tự động toàn diện dành cho Phase 5 của hệ thống **iMenu API**, bao gồm: Quản lý khu vực bàn (Table Zones), Bàn ăn (Tables), Mở bàn, Đổi bàn (Transfer Table), Gộp bàn (Merge Tables), Tạo đơn hàng từ POS (Snapshot giá & món), Đồng bộ sự kiện WebSocket thời gian thực tới Màn hình Bếp KDS (`order:created`, `order:item_status_updated`, `table:status_updated`, `order:payment_completed`), Thanh toán hóa đơn (VietQR / Tiền mặt), Kiểm tra ma trận phân quyền RBAC 5 vai trò và Phân lập dữ liệu đa người thuê (Multi-Tenant Isolation).

---

## 📋 Danh Sách 18 Ca Kiểm Thử (18 Test Cases)

| STT | Mã Ca | Nghiệp Vụ Kiểm Thử | Kỳ Vọng Kỹ Thuật | Trạng Thái |
|:---:|:---|:---|:---|:---:|
| 1 | `TC-P5-01` | Tạo khu vực bàn mới (Table Zone) | Tạo thành công khu vực tầng trệt, HTTP 201 Created | ✅ PASS |
| 2 | `TC-P5-02` | Tạo bàn ăn mới thuộc khu vực | Tạo Bàn B01, B02, B03 trạng thái `Available`, HTTP 201 Created | ✅ PASS |
| 3 | `TC-P5-03` | Chống trùng mã bàn trong cùng nhà hàng | Tạo bàn thứ hai có cùng mã B01 -> Bị từ chối HTTP 409 Conflict | ✅ PASS |
| 4 | `TC-P5-04` | Lấy danh sách bàn ăn | Truy vấn danh sách bàn, tự động populate khu vực (Zone) | ✅ PASS |
| 5 | `TC-P5-05` | Thu ngân tạo đơn hàng từ POS | Tạo đơn hàng, Snapshot giá từ Menu DB, bàn B01 tự chuyển sang `Occupied` | ✅ PASS |
| 6 | `TC-P5-06` | WebSocket Event `order:created` | Bếp KDS nhận được sự kiện vé order mới qua WebSocket room | ✅ PASS |
| 7 | `TC-P5-07` | Phục vụ gọi thêm món vào bàn | Gọi thêm món vào đơn hiện tại, tự động cộng dồn tổng tiền | ✅ PASS |
| 8 | `TC-P5-08` | Bếp KDS cập nhật món sang Cooking | Chuyển trạng thái món sang `Cooking`, order chuyển `Preparing` | ✅ PASS |
| 9 | `TC-P5-09` | Bếp KDS cập nhật món sang Ready | Chuyển trạng thái món sang `Ready`, WebSocket phát chuông báo | ✅ PASS |
| 10 | `TC-P5-10` | Chuyển bàn (Transfer Table) | Chuyển order từ B01 sang B02, B02 chuyển `Occupied`, B01 về `Available` | ✅ PASS |
| 11 | `TC-P5-11` | Gộp bàn (Merge Tables) | Gộp các món từ nhiều bàn vào 1 bàn đích, giải phóng bàn phụ | ✅ PASS |
| 12 | `TC-P5-12` | RBAC: Chặn Phục vụ thanh toán | Tài khoản `waiter` gọi API thanh toán bị chặn HTTP 403 Forbidden | ✅ PASS |
| 13 | `TC-P5-13` | RBAC: Chặn Bếp tạo/sửa bàn | Tài khoản `kitchen` gọi API quản lý bàn bị chặn HTTP 403 Forbidden | ✅ PASS |
| 14 | `TC-P5-14` | Thu ngân thanh toán đơn VietQR | Đơn chuyển `Paid`, Bàn tự động giải phóng về `Available` | ✅ PASS |
| 15 | `TC-P5-15` | Chặn xóa bàn đang có khách | Bàn đang `Occupied` không cho phép xóa, HTTP 400 Bad Request | ✅ PASS |
| 16 | `TC-P5-16` | Phân lập Đa người thuê (Multi-Tenant) | Nhà hàng B không thể xem hoặc thanh toán đơn hàng của Nhà hàng A (404/403) | ✅ PASS |
| 17 | `TC-P5-17` | Tài khoản Demo trải nghiệm đầy đủ | Tài khoản demo `cashier@sample.vn` tạo đơn và đổi trạng thái bàn thành công | ✅ PASS |
| 18 | `TC-P5-18` | Khởi tạo sơ đồ bàn mẫu tự động | Endpoint `POST /tables/seed-default` tạo sẵn 4 khu vực và 12 bàn mẫu | ✅ PASS |

---

## 🚀 Hướng Dẫn Chạy Kiểm Thử

```bash
# Di chuyển vào thư mục backend
cd imenu-api

# Chạy riêng bộ kiểm thử Phase 5
npm run test:phase5

# Chạy toàn bộ kiểm thử hệ thống
npm run test:phase2:all
npm run test:phase3
npm run test:phase4
npm run test:phase5
```

---

## 🛡️ Cơ Chế Dọn Rác Tự Động (Zero Garbage Teardown)

Sau khi hoàn tất toàn bộ ca kiểm thử, khối lệnh `finally` tự động dọn dẹp sạch sẽ:
- Toàn bộ bàn ăn (`tables`) và khu vực bàn (`table_zones`) được tạo trong đợt test.
- Toàn bộ đơn hàng (`orders`) được tạo trong đợt test.
- Toàn bộ món ăn (`menu_items`) và danh mục (`menu_categories`) thử nghiệm.
- Các tài khoản và nhà hàng thử nghiệm (`owner.p5.*`, `cashier.p5.*`, `kitchen.p5.*`, `waiter.p5.*`).
- Ngắt kết nối WebSocket client và HTTP server an toàn, không để lại bất kỳ dữ liệu rác nào trong database.
