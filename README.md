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
5. [Tổng hợp Tính năng Chi tiết (Phase 1 – Phase 6)](#5-tổng-hợp-tính-năng-chi-tiết-phase-1--phase-6)
6. [Cơ chế Thời gian thực (WebSocket KDS Hub)](#6-cơ-chế-thời-gian-thực-websocket-kds-hub)
7. [Vòng đời Bàn ăn & Cấp phát Mã QR Đa Chi Nhánh](#7-vòng-đời-bàn-ăn--cấp-phát-mã-qr-đa-chi-nhánh)
8. [Tài liệu API Endpoints Chính](#8-tài-liệu-api-endpoints-chính)
9. [Cài đặt & Khởi chạy Cục bộ](#9-cài-đặt--khởi-chạy-cục-bộ)
10. [Bộ Kiểm Thử Tự Động (Automated Test Suites)](#10-bộ-kiểm-thử-tự-động-automated-test-suites)
11. [Trạng Thái Dự Án & Nghiệm Thu](#11-trạng-thái-dự-án--nghiệm-thu)

---

## 1. 📖 Giới thiệu & Phạm vi Nghiệp vụ

**iMenu API** là nền tảng Backend API hiệu năng cao xây dựng trên nền tảng **NestJS 11** và **MongoDB Mongoose**, cung cấp toàn bộ logic nghiệp vụ, quản lý dữ liệu, xác thực phân quyền và đồng bộ thời gian thực cho chuỗi nhà hàng ẩm thực F&B:
- **Thực khách (Customer)**: Quét mã QR tại bàn để xem thực đơn điện tử độc lập theo từng chi nhánh, tùy biến món ăn (toppings/options), đặt món trực tiếp theo nhiều đợt (multi-round ordering) và yêu cầu thanh toán / gọi nhân viên.
- **Thu ngân / POS**: Quản lý gọi món tại quầy, sơ đồ bàn trực quan, đổi bàn, gộp bàn, di chuyển món giữa các bàn, tách hóa đơn, duyệt đơn QR, áp dụng chiết khấu/thuế/phí dịch vụ, thanh toán tiền mặt (tính tiền thừa) và thanh toán qua VietQR.
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

## 5. 🚀 Tổng hợp Tính năng Chi tiết (Phase 1 – Phase 6)

- **Phase 1: Nền tảng API & Bảo mật Base**: Kiến trúc module, JWT Auth, Swagger `/api-docs`, Winston Logger, MongoDB Mongoose schema.
- **Phase 2: Đa Nhà Hàng & Vòng Đời Chi Nhánh**: Đăng ký nhà hàng kèm chi nhánh chính tự động, đóng/mở giờ hoạt động chi nhánh, cấu hình VietQR và hotline độc lập cho từng chi nhánh, bảo toàn kế toán (chặn xóa chi nhánh đã có hóa đơn lịch sử).
- **Phase 3: Phân Quyền RBAC & Điều Chuyển Nhân Sự**: Khóa/mở tài khoản nhân viên, điều chuyển nhân sự giữa các chi nhánh, chặn chi nhánh con tự ý phong admin hoặc sửa vai trò hệ thống.
- **Phase 4: Quản Lý Thực Đơn & Tuỳ Chọn (Toppings)**: Quản lý danh mục & món ăn, nhóm tùy chọn toppings, giá bán và cờ tạm hết món riêng biệt theo chi nhánh, tìm kiếm tiếng Việt regex không dấu (`pho bo` khớp `Phở bò`), xóa mềm an toàn.
- **Phase 5: Bàn Ăn, POS, Bếp KDS & Mã QR Realtime**: Sơ đồ bàn ăn động, đổi bàn, gộp bàn, thanh toán POS VietQR, WebSocket KDS realtime hai chiều, cấp phát/thu hồi/đổi token mã QR bàn ăn đa chi nhánh.
- **Phase 6: Vận Hành Order & POS ✅ (ĐÃ NGHIỆM THU — ĐÓNG CHÍNH THỨC)**: Vòng đời đơn hàng hoàn chỉnh và máy trạng thái chuyển đổi trạng thái, khách gọi món qua QR nhiều đợt (multi-round), POS duyệt và quản lý đơn hàng, hóa đơn VAT/phí dịch vụ/chiết khấu, thanh toán tiền mặt (tính tiền thừa) và VietQR, bảo vệ idempotency key chống trùng thanh toán, khóa nguyên tử đồng thời (Atomic Payment Claim), đồng bộ bàn-đơn hàng (đổi bàn, gộp bàn, di chuyển món, tách hóa đơn) với CAS lock và OCC retry, truy vấn đơn hàng nâng cao (lọc thời gian, nhân viên, đa trạng thái, regex search, phân lập chi nhánh), tích hợp Monorepo Frontend với xem trước hóa đơn và bảo mật phòng WebSocket realtime, kiểm thử E2E trình duyệt đa ứng dụng.

### Phase 6 — Phạm Vi 9 Phân Hệ Chi Tiết

| Phân hệ | Tên | Mô tả |
| :---: | :--- | :--- |
| 6.1 | Core Order & Table Lifecycle | Nền tảng vòng đời đơn hàng, liên kết bàn ăn, cấu trúc đợt gọi món (`rounds[]`) và danh sách món (`items[]`) |
| 6.2 | State Machine & Business Invariants | Máy trạng thái đơn hàng (`WaitingConfirmation` → `Preparing` → `Ready` → `Served` → `Paid` / `Cancelled`), duyệt/hủy round, hủy món, tính lại `subTotal`, RBAC chuyển trạng thái |
| 6.3 | POS Cashier & Billing Flows | Thu ngân POS, hóa đơn, VAT, phí dịch vụ, chiết khấu, thanh toán tiền mặt (tính tiền thừa `changeAmount`), thanh toán VietQR, quick-pay |
| 6.4 | Customer QR Ordering | Khách quét QR gọi món theo đợt (`WaitingConfirmation`), nhân viên duyệt, bảo vệ chống mở đơn trùng lặp |
| 6.5 | Idempotency Key & Concurrency Control | Header `X-Idempotency-Key` chặn request trùng lặp, Atomic Payment Claim đa luồng, bảo vệ bất biến tài chính |
| 6.6 | Table ↔ Order Sync & Transfer/Merge | Đổi bàn, gộp bàn, di chuyển món, tách hóa đơn, CAS lock, OCC retry |
| 6.7 | Order Query & Multi-Branch Optimization | Lọc khoảng thời gian, nhân viên, đa trạng thái, phương thức thanh toán, regex search an toàn, phân trang, compound indexes, cách ly chi nhánh |
| 6.8 | Frontend Monorepo Integration | Tích hợp `imenu-menudientu`, endpoint QR table context (`GET /api/orders/public/table-context`), duyệt đơn QR POS & KDS guard, xem trước hóa đơn, bảo mật phòng WebSocket Realtime (`AUD-6.8-01`) |
| 6.9 | Master Hardening & Final Closure Gate | E2E browser 9 checkpoints, Master Test Orchestrator, đặc tả kiến trúc máy in nhiệt Phase 8, khung nghiệm thu 365 ca test |

### Phase 6 — Giới Hạn & Ranh Giới Kiến Trúc Đã Biết

- **Máy in nhiệt phần cứng**: Phase 6 chỉ cung cấp tài liệu đặc tả kiến trúc ESC/POS (`thermal-printer-spec.md`). Tuyệt đối không triển khai driver phần cứng, WebUSB/WebSerial, hay ESC/POS binary builder. Tích hợp phần cứng thực tế được hoạch định cho Phase 8.
- **Redis Pub/Sub & kiến trúc messaging đa node**: Chưa triển khai. Hệ thống realtime hiện tại sử dụng EventEmitter2 + Socket.IO trên tiến trình đơn (single-process). Kiến trúc phân tán đa node là phạm vi mở rộng tương lai.
- **Phase 7 KDS**: Chức năng KDS nâng cao thuộc Phase 7, không nằm trong phạm vi Phase 6.
- **Bằng chứng giải phóng bàn**: Bộ kiểm thử xác minh trạng thái cuối cùng của bàn (`Available`) và tính idempotency thanh toán. Tuy nhiên, bằng chứng này không chứng minh được chính xác số lượng mutation vật lý tại cơ sở dữ liệu cho thao tác giải phóng bàn.

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
| | `POST` | `/api/tables/move-items` | Di chuyển món giữa các bàn | POS.VIEW |
| **Table Zones** | `GET` | `/api/table-zones` | Danh sách khu vực bàn | POS.VIEW |
| | `POST` | `/api/table-zones` | Tạo khu vực bàn riêng mới | TABLE.UPDATE |
| **Menu** | `GET` | `/api/categories` | Danh sách danh mục thực đơn | Public |
| | `GET` | `/api/menu-items` | Danh sách món ăn kèm giá chi nhánh | Public |
| **Orders** | `POST` | `/api/orders` | Tạo đơn hàng mới từ POS | POS.ORDER |
| | `GET` | `/api/orders` | Truy vấn danh sách đơn hàng (lọc, search, phân trang) | POS.VIEW |
| | `GET` | `/api/orders/:id` | Xem chi tiết đơn hàng | POS.VIEW |
| | `GET` | `/api/orders/:id/bill-preview` | Xem trước hóa đơn (VAT, phí, chiết khấu) | POS.VIEW |
| | `POST` | `/api/orders/:id/pay` | Thanh toán hóa đơn (Cash / VietQR) | POS.CONFIRM |
| | `PATCH` | `/api/orders/:id/items/:itemId/status` | Bếp cập nhật trạng thái món | KDS.COOK |
| | `POST` | `/api/orders/:id/rounds/:roundNumber/confirm` | Duyệt đợt gọi món QR | POS.ORDER |
| | `POST` | `/api/orders/:id/rounds/:roundNumber/cancel` | Hủy đợt gọi món QR | POS.ORDER |
| | `GET` | `/api/orders/public/table-context` | Ngữ cảnh bàn ăn công khai cho QR | Public |
| | `POST` | `/api/orders/customer` | Khách đặt món qua QR | Public |
| | `POST` | `/api/orders/customer/items` | Khách gọi thêm món đợt sau qua QR | Public |

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

### Cấu hình Biến Môi trường & Bảo Mật Xác Thực (Credentials Security)

Bảng các biến môi trường xác thực cốt lõi cần thiết lập trong file `.env`:

| Biến môi trường | Mục đích | Giá trị trong `.env.example` | Giá trị chạy local (`.env`) |
| :--- | :--- | :--- | :--- |
| `SUPERADMIN_EMAIL` | Email tài khoản quản trị hệ thống cao nhất | `superadmin@imenu.vn` | `superadmin@imenu.vn` |
| `SUPERADMIN_PASSWORD` | Mật khẩu tài khoản Super Admin | `your_superadmin_password_here` | *(Thiết lập mật khẩu an toàn nội bộ)* |
| `DEMO_USER_PASSWORD` | Mật khẩu khởi tạo 5 tài khoản demo (`owner`, `manager`, `cashier`, `kitchen`, `waiter`) | `your_demo_password_here` | *(Thiết lập mật khẩu demo nội bộ)* |

> [!IMPORTANT]
> **Quy Tắc Bảo Mật & Phòng Chống Cảnh Báo Khi Gộp Nhánh Main**:
> - Toàn bộ mã nguồn Git-tracked **tuyệt đối không chứa mật khẩu hardcode**.
> - Tệp `.env.example` chỉ chứa placeholder an toàn (`your_demo_password_here`), cam kết không rò rỉ bí mật khi commit và vượt qua các bộ kiểm tra Secret Scanning (GitHub Secret Scanning, TruffleHog, SonarQube).
> - Mật khẩu thật chỉ được lưu trong tệp `.env` cục bộ và được bảo vệ nghiêm ngặt bởi `.gitignore`.

---

## 10. 🧪 Bộ Kiểm Thử Tự Động (Automated Test Suites)

Hệ sinh thái kiểm thử iMenu gồm **365 ca test tự động toàn diện** (Zero Garbage — tự động dọn sạch fixture sau khi test), phủ toàn bộ Phase 2 đến Phase 6.

### Bộ Điều Phối Master Test Runner

```bash
# Chế độ Phát triển (270 backend + 9 SDK = 279 ca bắt buộc, cho phép SKIP E2E nếu thiếu server UI)
npm run test:phase6:all

# Chế độ Nghiệm Thu Đóng Phase (365 ca bắt buộc: 0 FAIL, 0 SKIP, 0 BLOCKED)
npm run test:phase6:acceptance
```

> **Quan trọng:** `test:phase6:all` (chế độ `--mode=dev`) và `test:phase6:acceptance` (chế độ `--mode=acceptance`) đều sử dụng Master Test Orchestrator (`run-all-phase6.ts`). Chế độ acceptance yêu cầu tất cả 365 ca test đạt 100% PASS. Chế độ dev cho phép SKIP E2E nếu các server giao diện chưa khởi động.

### Kiểm Thử Theo Từng Phase (Hồi Quy)

```bash
# Phase 2: Auth, Nhà hàng & Multi-Branch (24 ca)
npm run test:phase2:all

# Phase 3: Nhân sự & Phân quyền RBAC (16 ca)
npm run test:phase3

# Phase 4: Thực đơn, Danh mục & Toppings (17 ca)
npm run test:phase4

# Phase 5: Bàn ăn, Đơn hàng & Realtime KDS (20 ca)
npm run test:phase5

# Toàn bộ hồi quy Phases 2–5 (77 ca):
npm run test:regression:phase2-5
```

### Kiểm Thử Phase 6 (Order & POS)

```bash
# Chạy 6 suite backend cơ bản (241 ca — không bao gồm sub-phase 6.8 Integration):
npm run test:phase6

# Chạy riêng lẻ từng phân hệ:
npm run test:phase6:transitions  # Sub-phase 6.2: State Machine (56 ca)
npm run test:phase6:pos          # Sub-phase 6.3: POS Cashier (30 ca)
npm run test:phase6:customer-qr  # Sub-phase 6.4: Customer QR (43 ca)
npm run test:phase6:concurrency  # Sub-phase 6.5: Idempotency (32 ca)
npm run test:phase6:sync         # Sub-phase 6.6: Table Sync (38 ca)
npm run test:phase6:query        # Sub-phase 6.7: Order Query (42 ca)
npm run test:phase6:integration  # Sub-phase 6.8: Frontend Monorepo Integration (29 ca)

# Kiểm thử Browser E2E đa ứng dụng (yêu cầu API:3001, Admin:3003, Menu:3005):
npm run test:phase6:e2e
```

> **Lưu ý:** Lệnh `npm run test:phase6` chạy 6 suite backend cơ bản (241 ca). Để chạy toàn bộ 270 ca backend + 9 SDK + 9 E2E + 77 hồi quy = 365 ca, sử dụng `npm run test:phase6:acceptance`. Script `test:sdk` không tồn tại riêng lẻ trong `package.json`; suite SDK Contract (9 ca) được tích hợp trực tiếp trong Master Test Orchestrator.

### Bảng Đối Chiếu 365 Ca Test

```
┌────────────────────────────────────────────────────────────────────────┐
│  HỆ SINH THÁI KIỂM THỬ IMENU — 365 CA TEST TỰ ĐỘNG CHUẨN XÁC           │
├────────────────────────────────┬──────────────────────┬────────────────┤
│ Nhóm Kiểm Thử                  │ Tệp Nguồn / Vị Trí   │ Số Ca Test     │
├────────────────────────────────┼──────────────────────┼────────────────┤
│ 1. Phase 6 Backend (7 suites)  │ tests/phase-06-order │ 270            │
│ 2. Frontend SDK Contract       │ imenu-menudientu     │ 9              │
│ 3. Browser E2E (9 checkpoints) │ scripts/e2e-order    │ 9              │
│ 4. Phase 2–5 Regression        │ tests/phase-02..05   │ 77             │
├────────────────────────────────┴──────────────────────┼────────────────┤
│ TỔNG CỘNG HỆ SINH THÁI (ACCEPTANCE CLOSURE REQUIREMENT)│ 365 CA TEST    │
└───────────────────────────────────────────────────────┴────────────────┘
```

### Tài liệu Kiểm Thử Chi Tiết

- **Mục lục kiểm thử tổng thể:** [tests/README.md](tests/README.md) (Tiếng Việt) | [tests/README_en.md](tests/README_en.md) (English)
- **Tài liệu Phase 6 chi tiết:** [tests/phase-06-order-pos/README.md](tests/phase-06-order-pos/README.md) (Tiếng Việt) | [tests/phase-06-order-pos/README_en.md](tests/phase-06-order-pos/README_en.md) (English)
- **Đặc tả máy in nhiệt Phase 8:** [tests/phase-06-order-pos/thermal-printer-spec.md](tests/phase-06-order-pos/thermal-printer-spec.md)

---

## 11. 📊 Trạng Thái Dự Án & Nghiệm Thu

### Trạng Thái Phase 6: ✅ ĐÃ NGHIỆM THU — ĐÓNG CHÍNH THỨC

Phase 6 (Order & POS) đã hoàn thành toàn bộ 9 phân hệ (Sub-phase 6.1 đến 6.9) và đã được nghiệm thu chính thức thông qua cổng kiểm tra đóng Phase (Master Closure Gate).

**Kết quả nghiệm thu cuối cùng:**

| Nhóm Kiểm Thử | Số Ca Test | Kết Quả |
| :--- | :---: | :---: |
| Phase 6 Backend (7 suites) | 270 | ✅ PASS |
| Frontend SDK Contract | 9 | ✅ PASS |
| Browser E2E (9 checkpoints) | 9 | ✅ PASS |
| Phase 2–5 Regression (5 suites) | 77 | ✅ PASS |
| **TỔNG CỘNG** | **365** | **365/365 PASS** |

- **FAIL:** 0
- **SKIP:** 0
- **BLOCKED:** 0

> **Lưu ý:** Kết quả 365/365 PASS được báo cáo bởi Master Test Orchestrator (`run-all-phase6.ts --mode=acceptance`). Phase 6 là một milestone hoàn thành; dự án iMenu vẫn tiếp tục phát triển các Phase tiếp theo.

### Lộ Trình Tổng Thể

| Phase | Trạng Thái |
| :--- | :--- |
| Phase 1: Nền tảng API & Bảo mật | ✅ Hoàn thành |
| Phase 2: Đa Nhà Hàng & Chi Nhánh | ✅ Hoàn thành |
| Phase 3: Phân Quyền RBAC & Nhân Sự | ✅ Hoàn thành |
| Phase 4: Quản Lý Thực Đơn & Toppings | ✅ Hoàn thành |
| Phase 5: Bàn Ăn, POS & KDS Realtime | ✅ Hoàn thành |
| Phase 6: Vận Hành Order & POS | ✅ Nghiệm thu & Đóng chính thức |
| Phase 7+: Các giai đoạn tiếp theo | 🔜 Chưa triển khai |
