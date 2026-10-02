# 🍽️ iMenu Backend API - Nền Tảng Quản Lý Nhà Hàng & Menu Điện Tử Thông Minh

<div align="center">

[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongoosejs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime%20KDS-black?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![JWT](https://img.shields.io/badge/Security-JWT%20%26%20RBAC-black?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![Swagger](https://img.shields.io/badge/API%20Docs-Swagger%20OpenAPI-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)](https://swagger.io/)

**Hệ thống Backend RESTful API & WebSocket Realtime cấp doanh nghiệp cho Nền tảng F&B Toàn diện iMenu**  
*Tài liệu Tiếng Anh: [English README (README_en.md)](README_en.md)*

</div>

---

## 📋 Mục lục
1. [Giới thiệu & Phạm vi Nghiệp vụ](#1-giới-thiệu--phạm-vi-nghiệp-vụ)
2. [Kiến trúc Kỹ thuật & Công nghệ](#2-kiến-trúc-kỹ-thuật--công-nghệ)
3. [Mô hình Phân lập Đa Người Thuê & Đa Chi Nhánh](#3-mô-hình-phân-lập-đa-người-thuê--đa-chi-nhánh)
4. [Hệ thống Phân quyền Nhân sự (RBAC)](#4-hệ-thống-phân-quyền-nhân-sự-rbac)
5. [Tổng hợp Tính năng Chi tiết (Phase 1 – Phase 5)](#5-tổng-hợp-tính-năng-chi-tiết-phase-1--phase-5)
6. [Cơ chế Thời gian thực (WebSocket KDS Hub)](#6-cơ-chế-thời-gian-thực-websocket-kds-hub)
7. [Vòng đời Bàn ăn & Cấp phát Mã QR Đa Chi Nhánh](#7-vòng-đời-bàn-ăn--cấp-phát-mã-qr-đa-chi-nhánh)
8. [Tài liệu API Endpoints Chính](#8-tài-liệu-api-endpoints-chính)
9. [Cài đặt & Khởi chạy Cục bộ](#9-cài-đặt--khởi-chạy-cục-bộ)
10. [Bộ Kiểm Thử Tự Động (Automated Test Suites)](#10-bộ-kiểm-thử-tự-động-automated-test-suites)

---

## 1. 📖 Giới thiệu & Phạm vi Nghiệp vụ

**iMenu API** là nền tảng Backend API hiệu năng cao xây dựng trên nền tảng **NestJS 11** và **MongoDB Mongoose**, cung cấp toàn bộ logic nghiệp vụ, quản lý dữ liệu, xác thực phân quyền và đồng bộ thời gian thực cho chuỗi nhà hàng ẩm thực F&B:
- **Thực khách (Customer)**: Quét mã QR tại bàn để xem thực đơn điện tử độc lập theo từng chi nhánh, tùy biến món ăn (toppings/options), đặt món trực tiếp và yêu cầu thanh toán / gọi nhân viên.
- **Thu ngân / POS**: Quản lý gọi món tại quầy, sơ đồ bàn trực quan, đổi bàn, gộp bàn, áp dụng chiết khấu thuế và thanh toán tự động qua VietQR.
- **Màn hình Bếp KDS (Kitchen Display System)**: Nhận vé order tức thì qua WebSocket, điều phối các bước chế biến (`Cooking` ➔ `Ready` ➔ `Served`) và rung chuông thông báo âm thanh.
- **Quản lý & Chủ nhà hàng**: Phân quyền nhân sự theo vai trò, quản lý thực đơn với giá bán riêng từng chi nhánh, quản lý danh sách bàn & sinh mã QR standee A6/tem dán bàn, và xem báo cáo doanh thu theo chi nhánh hoặc hợp nhất toàn chuỗi.

---

## 2. 🛠️ Kiến trúc Kỹ thuật & Công nghệ

### Tech Stack
| Hạng mục | Công nghệ | Mô tả |
| :--- | :--- | :--- |
| **Framework** | NestJS 11 | Kiến trúc module hóa (Modular Architecture), Dependency Injection |
| **Ngôn ngữ** | TypeScript 5 | Đảm bảo tính chặt chẽ về type, giảm thiểu runtime error |
| **Database** | MongoDB & Mongoose 8 | NoSQL linh hoạt, autopopulate, compound index tối ưu hóa truy vấn |
| **Realtime** | Socket.IO Gateway | WebSocket phòng bếp KDS & sự kiện đổi trạng thái bàn |
| **Xác thực** | Passport JWT & bcryptjs | Access Token (1 ngày) & Refresh Token (7-30 ngày), mã hóa mật khẩu an toàn |
| **Bảo mật** | Helmet, CORS, DTO Validation | Phòng chống XSS, Clickjacking, tự động lọc dữ liệu đầu vào |
| **Tài liệu** | Swagger OpenAPI 3.0 | Tự động sinh tài liệu tương tác tại `/api-docs` |
| **Ghi log** | Winston & Morgan | Ghi vết HTTP requests và file log xoay vòng theo ngày |

### Sơ đồ Luồng Xử lý Dữ liệu
```text
HTTP / WebSocket Request
  │
  ├──► Morgan Logger & Helmet Security Headers
  ├──► CORS Origin Filter (Whitelist localhost:3000-3005)
  ├──► ValidationPipe (Lọc rác & ép kiểu DTO)
  ├──► JwtAuthGuard (Xác thực Bearer Token - Bỏ qua với @Public())
  ├──► PermissionsGuard (Kiểm tra quyền Resource x Action)
  │
  ▼
[Controller] ➔ [Service] ➔ [Mongoose Model] ➔ [MongoDB Database]
                         │
                         └──► [EventEmitter2 / SocketGateway] ➔ Realtime Client
```

---

## 3. 🏢 Mô hình Phân lập Đa Người Thuê & Đa Chi Nhánh

Hệ thống được thiết kế theo tiêu chuẩn Multi-Tenant & Multi-Branch cấp doanh nghiệp:
1. **Đa Người Thuê (Multi-Tenant Isolation)**:
   - Mọi thực thể (`Table`, `TableZone`, `MenuCategory`, `MenuItem`, `Order`, `User`) đều bắt buộc gắn liền với `restaurantId`.
   - Token JWT luôn mang thông tin `restaurantId`. Tài khoản nhà hàng A hoàn toàn không thể xem hoặc sửa dữ liệu của nhà hàng B (HTTP 404/403).
2. **Đa Chi Nhánh Độc Lập (Multi-Branch Isolation)**:
   - Mỗi nhà hàng có một **Chi nhánh chính (Main Branch)** và có thể mở rộng nhiều **Chi nhánh con (Sub-Branches)**.
   - **Bàn ăn & Khu vực bàn**: Mỗi chi nhánh có sơ đồ bàn, khu vực và mã QR độc lập. Cho phép các chi nhánh trùng mã bàn nội bộ (`B01`, `B02`) mà không gây xung đột (compound index `{ restaurantId: 1, branchId: 1, code: 1 }`).
   - **Quyền nhân sự chi nhánh**: Quản lý chi nhánh con bị khóa cứng trong phạm vi `branchId` của mình. Không thể xem doanh thu, bàn ăn hay nhân sự của chi nhánh khác.
   - **Chủ chuỗi & Quản lý chính**: Có quyền xem báo cáo hợp nhất toàn chuỗi và chuyển đổi linh hoạt giữa các chi nhánh.

---

## 4. 👥 Hệ thống Phân quyền Nhân sự (RBAC)

Ma trận phân quyền gồm 6 vai trò tiêu chuẩn:

| Vai trò | Slug | Bàn & POS | Bếp KDS | Thực đơn | Nhân sự & Vai trò | Báo cáo Doanh thu |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Super Admin** | `super_admin` | Toàn quyền | Toàn quyền | Toàn quyền | Quản trị hệ thống | Toàn hệ thống |
| **Chủ Nhà Hàng** | `restaurant_admin` | Toàn quyền | Toàn quyền | Toàn quyền | Quản lý toàn chuỗi | Hợp nhất chuỗi |
| **Quản Lý Chi Nhánh** | `restaurant_manager` | Toàn quyền | Toàn quyền | Xem & Tạm hết | Quản lý chi nhánh mình | Chi nhánh mình |
| **Thu Ngân (Cashier)** | `cashier` | Xem, Tạo, Thu tiền | Xem | Xem & Tạm hết | Không | Xem ca bán hàng |
| **Bếp (Kitchen)** | `kitchen` | Không | Xem & Đổi món | Không | Không | Không |
| **Phục Vụ (Waiter)** | `waiter` | Xem & Gọi thêm món | Không | Xem | Không | Không |

---

## 5. 🚀 Tổng hợp Tính năng Chi tiết (Phase 1 – Phase 5)

- **Phase 1: Nền tảng API & Bảo mật Base**: Kiến trúc module, JWT Auth, Swagger `/api-docs`, Winston Logger, MongoDB Mongoose schema.
- **Phase 2: Đa Nhà Hàng & Vòng Đời Chi Nhánh**: Đăng ký nhà hàng kèm chi nhánh chính tự động, đóng/mở giờ hoạt động chi nhánh, cấu hình VietQR và hotline độc lập cho từng chi nhánh, bảo toàn kế toán (chặn xóa chi nhánh đã có hóa đơn lịch sử).
- **Phase 3: Phân Quyền RBAC & Điều Chuyển Nhân Sự**: Khóa/mở tài khoản nhân viên, điều chuyển nhân sự giữa các chi nhánh, chặn chi nhánh con tự ý phong admin hoặc sửa vai trò hệ thống.
- **Phase 4: Quản Lý Thực Đơn & Tuỳ Chọn (Toppings)**: Quản lý danh mục & món ăn, nhóm tùy chọn toppings, giá bán và cờ tạm hết món riêng biệt theo chi nhánh, tìm kiếm tiếng Việt regex không dấu (`pho bo` khớp `Phở bò`), xóa mềm an toàn.
- **Phase 5: Bàn Ăn, POS, Bếp KDS & Mã QR Realtime**: Sơ đồ bàn ăn động, đổi bàn, gộp bàn, thanh toán POS VietQR, WebSocket KDS realtime hai chiều, cấp phát/thu hồi/đổi token mã QR bàn ăn đa chi nhánh.

---

## 6. ⚡ Cơ chế Thời gian thực (WebSocket KDS Hub)

Server lắng nghe và phát các sự kiện WebSocket tại namespace mặc định:
- `order:created` / `NEW_ORDER`: Bếp KDS nhận vé order mới kèm chi tiết món và toppings ngay khi khách quét QR hoặc thu ngân bấm lưu.
- `order:item_status_updated`: Đồng bộ tiến độ món ăn (`Cooking` ➔ `Ready` ➔ `Served`) giữa Bếp, Thu ngân và Khách hàng.
- `table.status_updated`: Cập nhật trạng thái bàn trên sơ đồ (`Available` ➔ `Occupied` ➔ `PaymentRequested`).
- `CALL_STAFF`: Bắn chuông thông báo khi khách tại bàn bấm gọi nhân viên hoặc xin thêm nước đá/khăn lạnh.

---

## 7. 🪑 Vòng đời Bàn ăn & Cấp phát Mã QR Đa Chi Nhánh

### Quy tắc Cấp phát Mã QR:
- Mỗi bàn ăn được tự động sinh một `qrToken` ngẫu nhiên bảo mật (8 ký tự).
- URL mã QR chuẩn:
  ```text
  http://localhost:3005/menu/:restaurantSlug/:tableCode?t=:qrToken&branch=:branchId
  ```
- **Thu hồi mã (Revoke)**: Khi bàn bị nghi ngờ lộ liên kết, quản lý có thể thu hồi mã QR (`qrStatus: 'revoked'`) hoặc bấm tạo lại `qrToken` mới mà không cần xóa bàn.
- **In ấn chuẩn công nghiệp**: Hỗ trợ xuất in mẫu Standee để bàn A6 và Tem dán bàn chống nước.

---

## 8. 📡 Tài liệu API Endpoints Chính

Chi tiết Swagger trực quan xem tại: `http://localhost:3001/api-docs`

| Nhóm API | Phương thức | Endpoint | Mô tả | Phân quyền |
| :--- | :---: | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/register` | Đăng ký nhà hàng mới & chủ quán | Public |
| | `POST` | `/api/auth/login` | Đăng nhập tài khoản | Public |
| | `GET` | `/api/auth/profile` | Xem thông tin tài khoản hiện tại | Bearer Token |
| **Branches** | `GET` | `/api/branches` | Danh sách chi nhánh | POS.VIEW |
| | `POST` | `/api/branches` | Tạo chi nhánh con mới | RESTAURANT.UPDATE |
| | `PATCH` | `/api/branches/:id/close` | Tạm đóng cửa chi nhánh | RESTAURANT.UPDATE |
| **Tables** | `GET` | `/api/tables` | Danh sách bàn theo chi nhánh/khu vực | POS.VIEW |
| | `POST` | `/api/tables` | Tạo bàn mới kèm mã QR | TABLE.UPDATE |
| | `PUT` | `/api/tables/:id` | Cập nhật thông tin/trạng thái QR bàn | TABLE.UPDATE |
| | `POST` | `/api/tables/seed-default` | Khởi tạo 12 bàn & 4 khu vực mẫu | TABLE.UPDATE |
| | `POST` | `/api/tables/transfer` | Đổi bàn gọi món | POS.VIEW |
| | `POST` | `/api/tables/merge` | Gộp nhiều bàn vào một bàn | POS.VIEW |
| **Table Zones** | `GET` | `/api/table-zones` | Danh sách khu vực bàn | POS.VIEW |
| | `POST` | `/api/table-zones` | Tạo khu vực bàn riêng mới | TABLE.UPDATE |
| **Menu** | `GET` | `/api/categories` | Danh sách danh mục thực đơn | Public |
| | `GET` | `/api/menu-items` | Danh sách món ăn kèm giá chi nhánh | Public |
| **Orders** | `POST` | `/api/orders` | Tạo đơn hàng mới từ POS hoặc QR | POS.ORDER |
| | `POST` | `/api/orders/:id/pay` | Thanh toán hóa đơn | POS.CONFIRM |
| | `PATCH` | `/api/orders/:id/items/:itemId/status` | Bếp cập nhật trạng thái món | KDS.COOK |

---

## 9. 💻 Cài đặt & Khởi chạy Cục bộ

### Yêu cầu Tiên quyết
- Node.js `>= 18.0.0`
- MongoDB `>= 6.0` (chạy tại `mongodb://localhost:27017`)

### Các bước cài đặt:
```bash
# 1. Cài đặt dependencies
npm install

# 2. Thiết lập biến môi trường
cp .env.example .env

# 3. Khởi động môi trường phát triển (Port 3001)
npm run start:dev

# 4. Build bản production
npm run build
```

---

## 10. 🧪 Bộ Kiểm Thử Tự Động (Automated Test Suites)

Hệ thống cung cấp **73 ca kiểm thử tự động toàn diện** (Zero Garbage - tự động dọn sạch sau khi test):

```bash
# Kiểm thử Phase 5: Đơn hàng, Sơ đồ bàn & KDS WebSocket (18 tests)
npm run test:phase5

# Kiểm thử Phase 4: Quản lý Thực đơn, Toppings & Giá chi nhánh (17 tests)
npm run test:phase4

# Kiểm thử Phase 3: Phân quyền RBAC, Nhân sự & Chi nhánh (16 tests)
npm run test:phase3

# Kiểm thử Phase 2: Vòng đời Chi nhánh & Đa Người Thuê (11 tests)
npm run test:phase2:all
```
