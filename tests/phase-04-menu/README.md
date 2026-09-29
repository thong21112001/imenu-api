# Kiểm Thử Tích Hợp Phase 4: Quản Lý Thực Đơn & Nhóm Tùy Chọn (Toppings)

Bộ kiểm thử tự động toàn diện dành cho Phase 4 của hệ thống **iMenu API**, bao gồm: Quản lý danh mục món ăn (Categories), Món ăn (Menu Items), Nhóm tùy chọn/Toppings (Option Groups & Values), Bật/Tắt trạng thái Còn/Hết nhanh dành cho Thu ngân, Ràng buộc an toàn khi xóa danh mục, Phân lập dữ liệu đa người thuê (Multi-Tenant Isolation) và Truy cập thực đơn công khai cho khách hàng quét mã QR.

---

## 📋 Danh Sách 13 Ca Kiểm Thử (13 Test Cases)

| STT | Mã Ca Kiểm Thử | Tên Nghiệp Vụ Kiểm Thử | Mục Tiêu & Kỳ Vọng | Trạng Thái |
|:---:|:---|:---|:---|:---:|
| 1 | `TC-MENU-01` | Tạo danh mục món ăn mới | Chủ nhà hàng tạo danh mục mới, slug tự sinh chuẩn SEO không dấu (`mon-nuong-bbq-dac-sac`), HTTP 201 Created | ✅ PASS |
| 2 | `TC-MENU-02` | Tự động xử lý trùng lặp slug | Khi tạo danh mục trùng tên trong cùng một nhà hàng, hệ thống tự động thêm hậu tố chống trùng lặp, HTTP 201 Created | ✅ PASS |
| 3 | `TC-MENU-03` | Cập nhật thông tin danh mục | Cập nhật tên danh mục, icon emoji và thứ tự sắp xếp (order), HTTP 200 OK | ✅ PASS |
| 4 | `TC-MENU-04` | Tạo món ăn kèm Option Groups & Toppings | Tạo món ăn với nhiều nhóm lựa chọn (Kích cỡ, Độ cay, Topping kèm giá phụ thu), lưu trữ đầy đủ cấu trúc nested options, HTTP 201 Created | ✅ PASS |
| 5 | `TC-MENU-05` | Truy vấn món ăn có phân trang & bộ lọc | Lọc theo danh mục, trạng thái bán chạy (`isPopular=true`), phân trang (`limit=10`), trả về danh sách chính xác và tổng số lượng | ✅ PASS |
| 6 | `TC-MENU-06` | Chỉnh sửa thông tin món ăn | Cập nhật tên, giá bán, giá gốc khuyến mãi của món ăn, HTTP 200 OK | ✅ PASS |
| 7 | `TC-MENU-07` | Thu ngân bật/tắt nhanh Còn/Hết món | Thu ngân (`cashier`) thao tác chuyển đổi `isAvailable: false -> true` qua endpoint `/status`, kiểm tra phân quyền RBAC thành công, HTTP 200 OK | ✅ PASS |
| 8 | `TC-MENU-08` | Ràng buộc an toàn khi xóa danh mục | Chặn xóa danh mục khi vẫn còn món ăn thuộc danh mục đó, trả về HTTP 400 Bad Request kèm thông điệp cảnh báo rõ ràng | ✅ PASS |
| 9 | `TC-MENU-09` | Xóa món ăn khỏi thực đơn | Chủ quán thực hiện xóa món ăn khỏi thực đơn nhà hàng, HTTP 200 OK | ✅ PASS |
| 10 | `TC-MENU-10` | Xóa danh mục trống thành công | Khi danh mục không còn món ăn nào, cho phép xóa hoàn tất, HTTP 200 OK | ✅ PASS |
| 11 | `TC-MENU-11` | Phân lập dữ liệu đa người thuê (Multi-Tenant) | Nhà hàng B không thể truy cập, sửa đổi hoặc xóa danh mục/món ăn của Nhà hàng A (HTTP 404/403) | ✅ PASS |
| 12 | `TC-MENU-12` | Thực đơn công khai cho khách quét mã QR | Khách hàng quét mã QR gọi món có thể xem danh mục và món ăn đang mở bán mà không cần mã xác thực JWT, HTTP 200 OK | ✅ PASS |
| 13 | `TC-MENU-13` | Tự động Seed thực đơn mẫu chuẩn nhà hàng Việt qua API | Chủ quán gọi endpoint `POST /categories/seed-default`, tự động tạo 4 danh mục và 8 món ăn phong phú (Món chính, Khai vị, Món nước, Đồ uống) kèm nhóm tùy chọn (Toppings), HTTP 200 OK | ✅ PASS |

---

## 🚀 Hướng Dẫn Chạy Kiểm Thử

### 1. Yêu cầu môi trường
- Node.js >= 18
- MongoDB Server đang chạy tại `mongodb://localhost:27017`
- Môi trường kiểm thử tự động sử dụng Database riêng: `imenu-db-test`

### 2. Lệnh thực thi

```bash
# Di chuyển vào thư mục backend
cd imenu-api

# Chạy riêng bộ kiểm thử Phase 4
npm run test:phase4

# Chạy toàn bộ các bộ kiểm thử hồi quy
npm run test:phase2:all
npm run test:phase3
npm run test:phase4
```

---

## 🛡️ Cơ Chế Dọn Rác Tự Động (Zero Garbage Teardown)

Sau khi kiểm thử hoàn tất (dù thành công hay gặp lỗi), khối lệnh `finally` sẽ tự động dọn dẹp sạch sẽ:
- Toàn bộ danh mục món ăn (`menu_categories`) được tạo trong đợt test.
- Toàn bộ món ăn (`menu_items`) được tạo trong đợt test.
- Các tài khoản và nhà hàng thử nghiệm (`owner.p4.*`, `cashier.p4.*`).
- Đóng kết nối HTTP và MongoDB an toàn, không để lại bất kỳ dữ liệu rác nào.
