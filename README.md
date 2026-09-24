# 🍽️ iMenu Backend API

<div align="center">

[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongoosejs.com/)
[![JWT](https://img.shields.io/badge/Security-JWT%20%26%20RBAC-black?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![Swagger](https://img.shields.io/badge/API%20Docs-Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)](https://swagger.io/)

**Nền tảng Backend API Quản lý Nhà hàng & Thực đơn Điện tử Thông minh iMenu**  
*Enterprise-grade Backend API for the iMenu Smart Restaurant & Digital Menu Management Platform*

---

**Ngôn ngữ / Language:**  
[🇻🇳 Tiếng Việt](#-tiếng-việt) &nbsp; | &nbsp; [🇬🇧 English](#-english)

---

</div>

<br />

---

# 🇻🇳 Tiếng Việt

## 1. 📖 Giới thiệu & Mục đích Dự án

**iMenu API** là hệ thống Backend RESTful API hiệu năng cao, được xây dựng theo kiến trúc hướng module (Modular Architecture) trên nền tảng **NestJS** và **MongoDB**. Dự án là trái tim xử lý dữ liệu cho toàn bộ hệ sinh thái Quản trị Nhà hàng & Menu Điện tử **iMenu**, cung cấp nền tảng số hóa toàn diện từ khâu gọi món đến thanh toán và vận hành.

### iMenu API được dùng để làm gì?
Hệ thống giải quyết trọn vẹn chu trình vận hành nhà hàng F&B hiện đại:
- **Thực khách (Diner)**: Quét mã QR đặt tại từng bàn ăn để truy cập thực đơn điện tử (Digital Menu), tùy chỉnh món ăn (ghi chú, số lượng, combo), và gửi yêu cầu gọi món tức thì không cần chờ phục vụ.
- **Nhân viên Phục vụ (Waiter)**: Theo dõi trạng thái từng bàn theo thời gian thực (Trống, Đang phục vụ, Đã đặt trước), hỗ trợ mở bàn, tiếp nhận đơn và phục vụ món đã nấu xong.
- **Nhân viên Bếp (KDS - Kitchen Display System)**: Nhận order trực tiếp từ bàn/quầy theo thời gian thực, điều phối thứ tự ưu tiên chế biến và cập nhật tiến độ (Đang nấu, Đã sẵn sàng).
- **Thu ngân (POS Cashier)**: Quản lý order tại quầy, ghép/tách bàn, tính hóa đơn (thuế, giảm giá, phụ phí), in hóa đơn và hoàn tất thanh toán.
- **Chủ nhà hàng / Quản lý (Admin / Manager)**: Quản lý danh mục thực đơn, danh sách bàn & mã QR, phân quyền nhân viên (RBAC), tra cứu nhật ký kiểm toán (Audit Log) và xem báo cáo doanh thu.
- **Mô hình SaaS Đa Chi Nhánh (Multi-Tenant Ready)**: Hỗ trợ cấu hình quản lý theo từng nhà hàng và chuỗi chi nhánh riêng biệt.

---

## 2. 🛠️ Công nghệ Sử dụng (Tech Stack)

| Hạng mục | Công nghệ | Phiên bản | Mô tả chi tiết |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | [NestJS](https://nestjs.com/) | `^11.0.0` | Framework TypeScript cấp tiến cho Node.js, cung cấp cơ chế Dependency Injection, kiến trúc module chặt chẽ |
| **Ngôn ngữ** | [TypeScript](https://www.typescriptlang.org/) | `^5.1.3` | Đảm bảo tính nhất quán của kiểu dữ liệu, giảm thiểu lỗi runtime |
| **Cơ sở dữ liệu & ODM** | [MongoDB](https://www.mongodb.com/) & [Mongoose](https://mongoosejs.com/) | `^8.0.0` | Cơ sở dữ liệu NoSQL linh hoạt kết hợp Mongoose Schema, hỗ trợ `mongoose-autopopulate` |
| **Xác thực & Phân quyền** | [Passport](http://www.passportjs.org/) & [JWT](https://jwt.io/) | `^11.0.0` | Xác thực người dùng qua Access Token & Refresh Token, kiểm soát truy cập dựa trên vai trò (RBAC) |
| **Mã hóa Mật khẩu** | [bcryptjs](https://www.npmjs.com/package/bcryptjs) | `^2.4.3` | Thuật toán băm mật khẩu một chiều an toàn |
| **Bảo mật HTTP** | [Helmet](https://helmetjs.github.io/) | `^7.1.0` | Thiết lập các HTTP security headers chuẩn phòng chống các lỗ hổng web phổ biến (XSS, Clickjacking) |
| **CORS** | Built-in NestJS CORS | Native | Quản lý whitelist các origin frontend được phép gọi API (cho phép credentials/cookies) |
| **Validation & DTO** | `class-validator`, `class-transformer` | `^0.14.1` | Ràng buộc dữ liệu đầu vào (Input validation) tự động qua Data Transfer Objects (DTO) |
| **Tài liệu hóa API** | [Swagger / OpenAPI 3.0](https://swagger.io/) | `^11.0.0` | Tự động tạo giao diện tương tác và tài liệu API trực quan tại `/api-docs` |
| **Hệ thống Ghi log** | [Winston](https://github.com/winstonjs/winston) & [Morgan](https://github.com/expressjs/morgan) | `^3.13.0` | Morgan ghi vết HTTP Request; Winston ghi file log xoay vòng theo ngày (`winston-daily-rotate-file`) |
| **Xử lý Sự kiện** | [@nestjs/event-emitter](https://docs.nestjs.com/techniques/events) | `^3.0.1` | Hỗ trợ phát và lắng nghe sự kiện nội bộ hệ thống (Event-driven) |

---

## 3. 🏗️ Kiến trúc Hệ thống (Architecture)

Hệ thống được thiết kế theo mô hình **Modular Architecture + Shared Kernel**, tuân thủ nghiêm ngặt nguyên lý SOLID và phân tách trách nhiệm rõ ràng (Separation of Concerns):

```text
HTTP Request (Client / Browser / App)
  │
  ├──► [Morgan Logger Middleware] (Ghi nhận request HTTP)
  ├──► [Helmet Security Headers] (Bảo mật header)
  ├──► [CORS Filter] (Kiểm tra nguồn gốc origin)
  ├──► [Global ValidationPipe] (Lọc rác & xác thực DTO)
  ├──► [JwtAuthGuard] (Kiểm tra Access Token - Bỏ qua với @Public())
  ├──► [PermissionsGuard] (Kiểm tra quyền Resource x Action)
  ├──► [AuditLogInterceptor] (Tự động ghi nhận log nếu có thao tác thay đổi dữ liệu)
  │
  ▼
[Controller] (Nhận request, đọc DTO/Params, gọi Service)
  │
  ▼
[Service] (Xử lý toàn bộ nghiệp vụ, logic kiểm tra điều kiện)
  │
  ▼
[Mongoose Model / Repository] (Tương tác với schema & indexes)
  │
  ▼
[MongoDB Database] (Lưu trữ dữ liệu)
```

### Cấu trúc thư mục nguồn (`src/`)

```text
src/
├── app.controller.ts            # Root endpoint (/) & Health Check (/health)
├── app.service.ts               # Logic kiểm tra trạng thái máy chủ & database
├── app.module.ts                # Module gốc kết nối cơ sở dữ liệu và các feature modules
├── main.ts                      # Điểm khởi động (Bootstrap), cấu hình middleware, pipe & Swagger
│
├── shared/                      # SHARED KERNEL: Các tài nguyên dùng chung toàn dự án
│   ├── configs/                 # Đọc và chuẩn hóa cấu hình (env, mongo, swagger)
│   ├── common/                  # Các thành phần dùng chung
│   │   ├── constants/           # Mã quyền (IMENU_PERMISSIONS), ResourceType, ActionType
│   │   ├── decorators/          # @Public(), @RequirePermissions(), @CurrentUser()
│   │   ├── guards/              # JwtAuthGuard, PermissionsGuard
│   │   ├── filters/             # AllExceptionsFilter (chuẩn hóa toàn bộ phản hồi lỗi)
│   │   ├── dto/                 # DTO chuẩn: Phân trang (paginate), kết quả trả về
│   │   └── utils/               # Tiện ích băm mật khẩu, xử lý chuỗi slug
│   └── loggers/                 # Cấu hình Winston Logger & Morgan Middleware
│
└── modules/                     # DOMAIN MODULES: Các module nghiệp vụ độc lập
    ├── auth/                    # Xác thực: Đăng nhập, làm mới token, thông tin phiên
    ├── users/                   # Quản lý người dùng, nhân viên, gán vai trò
    ├── roles/                   # Quản lý vai trò & ma trận 17 quyền hạn chuẩn
    ├── restaurants/             # Quản lý nhà hàng, thông tin thương hiệu, chi nhánh
    ├── tables/                  # Quản lý sơ đồ bàn, khu vực và mã QR định danh bàn
    ├── menu/                    # Quản lý danh mục món ăn, nhóm món, giá bán
    ├── orders/                  # Quản lý đơn hàng (tại bàn, mang về) & trạng thái chế biến
    ├── bills/                   # Quản lý xuất hóa đơn, VAT, phụ thu & thanh toán
    └── activity-log/            # Nhật ký kiểm toán: Ghi vết toàn bộ thao tác thêm/sửa/xóa
```

### Điểm nổi bật trong kiến trúc:
1. **Global Authentication & Public Exemption**: Mọi route trong hệ thống đều mặc định được bảo vệ bởi `JwtAuthGuard`. Những route công khai (như Đăng nhập, Health Check, Menu dành cho khách) được chỉ định rõ ràng qua decorator `@Public()`.
2. **Hệ thống Phân quyền Linh hoạt (RBAC Matrix)**: Phân quyền theo ma trận **Tài nguyên (ResourceType)** $\times$ **Hành động (ActionType)**. Được bảo vệ chặt chẽ thông qua `@RequirePermissions(...)`.
3. **Cơ chế Tự động Khởi tạo Dữ liệu (Auto-Seed on Startup)**: Khi server khởi chạy lần đầu tiên, hệ thống sẽ tự động quét và khởi tạo 6 vai trò hệ thống mặc định cùng tài khoản Quản trị viên Tối cao (Super Admin) nếu cơ sở dữ liệu chưa có.
4. **Chuẩn hóa Phản hồi & Xử lý Lỗi Toàn cục**: Bộ lọc `AllExceptionsFilter` bắt toàn bộ ngoại lệ và trả về định dạng JSON thống nhất, đảm bảo tính ổn định cho phía Frontend.

---

## 4. 🚀 Hướng dẫn Cài đặt & Vận hành

### Điều kiện tiên quyết (Prerequisites)
- **Node.js**: Phiên bản `>= 18.x` (khuyến nghị phiên bản LTS `20.x` hoặc `22.x`)
- **Package Manager**: `npm` (kèm theo Node.js) hoặc `pnpm` / `yarn`
- **MongoDB**: Phiên bản `>= 6.0` đang chạy cục bộ (Local) hoặc kết nối qua MongoDB Atlas

---

### A. Chạy lần đầu tiên (First-time Run)

Thực hiện lần lượt các bước dưới đây để thiết lập dự án từ đầu:

#### Bước 1: Cài đặt các gói phụ thuộc (Dependencies)
Mở terminal tại thư mục gốc của dự án `imenu-api`:
```bash
npm install
```

#### Bước 2: Thiết lập file cấu hình môi trường (.env)
Sao chép file mẫu `.env.example` thành `.env`:
```bash
cp .env.example .env
```
*(Trên Windows PowerShell: `Copy-Item .env.example .env`)*

#### Bước 3: Cập nhật thông số trong file `.env`
Mở file `.env` vừa tạo và kiểm tra/điều chỉnh các thông số phù hợp với môi trường của bạn:

```env
# Cổng chạy HTTP Server
PORT=3001

# Môi trường thực thi (development | production | test)
NODE_ENV=development

# Chuỗi kết nối MongoDB (Mặc định dùng cơ sở dữ liệu imenu-db)
MONGODB_URL=mongodb://localhost:27017/imenu-db
MONGODB_USERNAME=
MONGODB_PASSWORD=

# Khóa bí mật ký mã xác thực JWT (Hãy đổi chuỗi này trong môi trường thực tế)
JWT_SECRET=imenu_jwt_secret_key_super_secure_2026
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# Danh sách Origin Frontend được phép gọi API (ngăn cách bởi dấu phẩy)
CORS_ORIGINS=http://localhost:3000,http://localhost:3003,http://localhost:3004,http://localhost:3005

# Đường dẫn truy cập Swagger UI
SWAGGER_PATH=api-docs
```

#### Bước 4: Khởi động cơ sở dữ liệu MongoDB
Hãy chắc chắn MongoDB service đang chạy trên máy của bạn.
- *Nếu dùng Docker:*
  ```bash
  docker run -d --name imenu-mongo -p 27017:27017 -v mongo_data:/data/db mongo:7
  ```
- *Nếu dùng MongoDB Service cục bộ:* Hãy đảm bảo service `mongod` đã được bật.

#### Bước 5: Khởi chạy ứng dụng ở chế độ Phát triển (Development)
```bash
npm run start:dev
```

#### Bước 6: Kiểm tra cơ chế Tự động Khởi tạo Dữ liệu (Auto-seed)
Khi khởi động lần đầu, server sẽ tự động tạo các dữ liệu thiết yếu sau:
- **6 Vai trò hệ thống chuẩn**:
  1. `system_admin`: Quản trị viên Hệ thống (Toàn quyền SaaS)
  2. `restaurant_admin`: Chủ nhà hàng / Chi nhánh
  3. `restaurant_manager`: Quản lý nhà hàng (Menu, Bàn, Bếp, Báo cáo)
  4. `cashier`: Thu ngân (POS, Hóa đơn, Thanh toán)
  5. `kitchen`: Nhân viên Bếp (Theo dõi màn hình KDS)
  6. `waiter`: Nhân viên Phục vụ (Bàn & Gọi món)
- **Tài khoản Super Admin cấu hình từ `.env`**:
  - Tự động đồng bộ và luôn ghi đè password hash từ biến môi trường:
  - **Email**: `SUPERADMIN_EMAIL` (Mặc định: `superadmin@imenu.vn`)
  - **Tên đăng nhập (Username)**: `SUPERADMIN_USERNAME` (Mặc định: `superadmin`)
  - **Mật khẩu (Password)**: `SUPERADMIN_PASSWORD` (Mặc định: `SuperAdmin@2026!`)
  - **Họ và tên**: `SUPERADMIN_FULLNAME` (Mặc định: `Quan Tri Vien He Thong iMenu`)
  - **Số điện thoại**: `SUPERADMIN_PHONE` (Mặc định: `0900000000`)

#### Bước 7: Xác nhận hoạt động
- **Kiểm tra trạng thái máy chủ (Health Check)**:  
  Mở trình duyệt truy cập: [http://localhost:3001/health](http://localhost:3001/health)  
  *Kết quả trả về `{ status: "ok", timestamp: "..." }`*
- **Tài liệu API Swagger**:  
  Truy cập: [http://localhost:3001/api-docs](http://localhost:3001/api-docs) (hoặc `http://localhost:3001/api/v1/api-docs`) để thử nghiệm trực tiếp các API.

---

### B. Chạy các lần sau (Subsequent Runs)

Trong các lần làm việc tiếp theo, bạn chỉ cần mở terminal và chạy lệnh tương ứng với mục đích sử dụng:

#### 1. Dành cho Lập trình viên (Development - Hot-reload)
Tự động biên dịch lại mã nguồn khi có thay đổi trong file:
```bash
npm run start:dev
```

#### 2. Dành cho Chế độ Gỡ lỗi (Debugging)
Khởi chạy kèm debug port (mặc định 9229) để gắn debugger từ VS Code / Chrome DevTools:
```bash
npm run start:debug
```

#### 3. Triển khai Môi trường Sản xuất (Production)
Biên dịch TypeScript sang mã JavaScript tối ưu trong thư mục `dist/` và khởi chạy máy chủ production:
```bash
# Bước 1: Build mã nguồn
npm run build

# Bước 2: Chạy server production
npm run start:prod
```

---

## 5. 📜 Danh mục Lệnh NPM (Scripts)

| Lệnh | Mô tả tác vụ |
| :--- | :--- |
| `npm run start` | Khởi chạy ứng dụng bình thường với Nest CLI |
| `npm run start:dev` | Khởi chạy server ở chế độ watch/hot-reload (khuyên dùng khi lập trình) |
| `npm run start:debug` | Khởi chạy chế độ gỡ lỗi (debug) kèm theo watch mode |
| `npm run build` | Biên dịch toàn bộ mã nguồn TypeScript sang thư mục `dist/` |
| `npm run start:prod` | Chạy ứng dụng từ thư mục `dist/main.js` (dành cho server production) |
| `npm run format` | Tự động định dạng mã nguồn theo chuẩn Prettier |
| `npm run lint` | Quét và tự động sửa các vi phạm chuẩn mã nguồn (ESLint) |
| `npm test` | Chạy bộ kiểm thử tự động (Unit Tests) với Jest |
| `npm run test:watch` | Chạy kiểm thử tự động và theo dõi file thay đổi |
| `npm run test:cov` | Báo cáo độ bao phủ mã nguồn của kiểm thử (Test Coverage) |
| `npm run test:phase2:all` | Chạy toàn bộ 22 kịch bản tích hợp E2E Phase 2 (Auth + Restaurant + Multi-Branch) |
| `npm run test:phase3` | Chạy toàn bộ 16 kịch bản tích hợp E2E Phase 3 (Super Admin, Soft Delete, Phân lập Chi nhánh con, VietQR & RBAC) |

---

## 6. 📡 Tổng quan Danh mục API (Core Endpoints)

Tất cả các endpoint nghiệp vụ đều được gắn tiền tố `/api/v1/`:

| Nhóm chức năng | Endpoint cơ sở | Mô tả chính | Quyền hạn yêu cầu |
| :--- | :--- | :--- | :--- |
| **Health** | `GET /health` | Kiểm tra trạng thái server & database | Công khai (`@Public()`) |
| **Auth** | `/api/v1/auth` | Đăng nhập (`/login`), làm mới token (`/refresh-token`), lấy profile (`/profile`) | Công khai / JWT |
| **Users** | `/api/v1/users` | Quản lý nhân sự, tạo hộ tài khoản, toggle trạng thái (`PATCH /:id/toggle-status`), xóa mềm (`DELETE /:id`), chuyển chi nhánh | JWT (`STAFF` permissions) |
| **Roles** | `/api/v1/roles` | Quản lý vai trò tùy chỉnh, CRUD vai trò, ma trận quyền 17 permissions (`GET /permissions/matrix`) | JWT (`ROLE` / `STAFF` permissions) |
| **Restaurants**| `/api/v1/restaurants` | Danh sách nhà hàng toàn hệ thống (`GET /`), chi tiết (`GET /:id`), cấu hình hiện tại (`GET & PUT /current`) | JWT (`SETTING` permissions / Super Admin) |
| **Branches** | `/api/v1/branches` | Quản lý chi nhánh, hỗ trợ Super Admin lọc đa nhà hàng qua `?restaurantId=...` | JWT (`BRANCH` permissions) |
| **Tables** | `/api/v1/tables` | Quản lý danh sách bàn, khu vực, tạo mã QR gọi món | JWT / Public (QR Scan) |
| **Menu** | `/api/v1/menu` | Danh mục món ăn, danh sách món, trạng thái còn/hết hàng | JWT / Public (Diner Menu) |
| **Orders** | `/api/v1/orders` | Đặt món tại bàn, gửi bếp KDS, chuyển trạng thái chế biến | JWT / Public (Table Session) |
| **Bills** | `/api/v1/bills` | Xuất hóa đơn, tính thuế phí, áp voucher, chốt thanh toán | JWT (`BILL`, `POS` permissions) |
| **Activity Log**| `/api/v1/activity-log` | Xem lịch sử thao tác dữ liệu và nhật ký kiểm toán | JWT (`ACTIVITY_LOG_VIEW`) |

---
---

<br />

# 🇬🇧 English

## 1. 📖 Introduction & Purpose

**iMenu API** is a high-performance RESTful Backend API built with a **Modular Architecture** on top of **NestJS** and **MongoDB**. Serving as the core engine of the **iMenu Smart Restaurant & Digital Menu Management Platform**, this service orchestrates the entire operational lifecycle—from digital contactless table ordering to kitchen execution, cashiering, and business administration.

### What is iMenu API used for?
The system solves the full range of challenges faced in modern F&B restaurant operations:
- **Diners**: Scan dynamic QR codes on dining tables to browse visual interactive menus, customize items (special requests, quantity, options), and submit orders directly without waiting for service staff.
- **Waiters**: Monitor real-time floor plans and table states (Available, Occupied, Reserved), assist with table opening, order adjustments, and dish delivery.
- **Kitchen & Bar Staff (KDS - Kitchen Display System)**: Receive instant order tickets directly from tables or cashier counters, prioritize dish preparation, and update status (Cooking, Ready to Serve).
- **Cashiers (POS - Point of Sale)**: Process counter orders, split/merge tables, calculate taxes and discounts, print receipts, and reconcile payments.
- **Restaurant Owners & Managers**: Configure multi-branch settings, maintain food catalogs and pricing, manage staff access via Role-Based Access Control (RBAC), trace system audit logs, and analyze revenue metrics.
- **Multi-Tenant SaaS Ready**: Structured to isolate and manage individual restaurant brands and multi-branch networks seamlessly.

---

## 2. 🛠️ Tech Stack

| Category | Technology | Version | Description |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | [NestJS](https://nestjs.com/) | `^11.0.0` | Progressive TypeScript framework for Node.js offering dependency injection and robust modular patterns |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `^5.1.3` | Strongly typed JavaScript ensuring high maintainability and runtime safety |
| **Database & ODM** | [MongoDB](https://www.mongodb.com/) & [Mongoose](https://mongoosejs.com/) | `^8.0.0` | Flexible NoSQL document database paired with Mongoose ODM and `mongoose-autopopulate` |
| **Authentication & RBAC**| [Passport](http://www.passportjs.org/) & [JWT](https://jwt.io/) | `^11.0.0` | Stateless token-based authentication (Access & Refresh tokens) with granular permission guards |
| **Password Security** | [bcryptjs](https://www.npmjs.com/package/bcryptjs) | `^2.4.3` | Cryptographic one-way password hashing |
| **HTTP Security** | [Helmet](https://helmetjs.github.io/) | `^7.1.0` | Secures HTTP response headers against standard web vulnerabilities (XSS, Clickjacking) |
| **CORS** | NestJS Built-in CORS | Native | Configurable origins whitelist allowing cross-origin requests with credentials |
| **Validation & DTOs** | `class-validator`, `class-transformer` | `^0.14.1` | Automatic request payload validation and data transformation |
| **API Documentation** | [Swagger / OpenAPI 3.0](https://swagger.io/) | `^11.0.0` | Interactive OpenAPI schema and UI available at `/api-docs` |
| **Logging & Auditing** | [Winston](https://github.com/winstonjs/winston) & [Morgan](https://github.com/expressjs/morgan) | `^3.13.0` | Morgan for HTTP traffic logs; Winston for daily rotating file persistence (`winston-daily-rotate-file`) |
| **Event System** | [@nestjs/event-emitter](https://docs.nestjs.com/techniques/events) | `^3.0.1` | Asynchronous in-app event dispatching and listeners |

---

## 3. 🏗️ System Architecture

The project adheres to a **Modular Architecture + Shared Kernel** paradigm, enforcing SOLID principles and strict separation of concerns:

```text
HTTP Request (Client / Browser / App)
  │
  ├──► [Morgan Logger Middleware] (Logs HTTP traffic)
  ├──► [Helmet Security Headers] (Applies security headers)
  ├──► [CORS Filter] (Validates requesting origin)
  ├──► [Global ValidationPipe] (Validates and sanitizes DTO payloads)
  ├──► [JwtAuthGuard] (Verifies JWT Access Token - bypassed via @Public())
  ├──► [PermissionsGuard] (Enforces Resource x Action permission matrix)
  ├──► [AuditLogInterceptor] (Captures mutating actions into audit collection)
  │
  ▼
[Controller] (Handles HTTP request, consumes DTOs, delegates to Service)
  │
  ▼
[Service] (Executes core business logic, domain rules, transitions)
  │
  ▼
[Mongoose Model / Repository] (Executes database operations and queries)
  │
  ▼
[MongoDB Database] (Stores persistent documents)
```

### Source Code Directory Layout (`src/`)

```text
src/
├── app.controller.ts            # Root info route (/) & Health Check route (/health)
├── app.service.ts               # Server and database health diagnostics
├── app.module.ts                # Root module wiring core providers and domain modules
├── main.ts                      # Bootstrap entry point: middlewares, pipes, Swagger & auto-seed
│
├── shared/                      # SHARED KERNEL: Cross-cutting concerns & shared infrastructure
│   ├── configs/                 # Centralized configuration (env, mongo, swagger)
│   ├── common/                  # Reusable utilities and framework building blocks
│   │   ├── constants/           # Permission dictionary (IMENU_PERMISSIONS), ResourceType, ActionType
│   │   ├── decorators/          # @Public(), @RequirePermissions(), @CurrentUser()
│   │   ├── guards/              # JwtAuthGuard, PermissionsGuard
│   │   ├── filters/             # AllExceptionsFilter (standardized error envelopes)
│   │   ├── dto/                 # Common DTOs: pagination requests & paginated responses
│   │   └── utils/               # Password hashing and slug formatting helpers
│   └── loggers/                 # Winston file logger and Morgan HTTP middleware
│
└── modules/                     # DOMAIN MODULES: Self-contained business features
    ├── auth/                    # Authentication: Login, token refresh, current profile
    ├── users/                   # User and staff management, role assignments
    ├── roles/                   # Role management and 17-permission RBAC matrix
    ├── restaurants/             # Restaurant profiles, branch settings, branding
    ├── tables/                  # Table layout, area assignment, dynamic QR generation
    ├── menu/                    # Menu items, food categories, pricing and availability
    ├── orders/                  # Order placement (Dine-in / Takeaway) and KDS tracking
    ├── bills/                   # Invoicing, taxes, discounts and payment settlements
    └── activity-log/            # Audit trail recording mutating system actions
```

### Key Architectural Highlights:
1. **Default-Deny JWT Authentication**: Every route is guarded by `JwtAuthGuard` by default. Endpoints intended for public consumption (e.g., Login, Health Check, Diner QR Menu) are explicitly marked with `@Public()`.
2. **Granular RBAC Guarding**: Permission authorization evaluates a dynamic **Resource** $\times$ **Action** matrix using `@RequirePermissions(...)`.
3. **Automatic Data Seeding**: During application bootstrap, the server automatically checks and seeds 6 default system roles and the initial Super Admin account if they are not already present in the database.
4. **Standardized Error Handling**: `AllExceptionsFilter` intercepts unhandled exceptions and standardizes HTTP error responses into a consistent JSON envelope.

---

## 4. 🚀 Getting Started & Execution Guide

### Prerequisites
- **Node.js**: Version `>= 18.x` (LTS `20.x` or `22.x` recommended)
- **Package Manager**: `npm` (bundled with Node.js), `yarn`, or `pnpm`
- **MongoDB**: Version `>= 6.0` (Local installation or a remote MongoDB Atlas cluster)

---

### A. First-Time Run (Initial Setup)

Follow these steps sequentially to set up and start the API for the first time:

#### Step 1: Install Project Dependencies
Run the following command in the `imenu-api` root directory:
```bash
npm install
```

#### Step 2: Initialize Environment File
Create your local environment file by copying `.env.example`:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

#### Step 3: Configure Environment Variables
Open the newly created `.env` file and review the parameters:

```env
# HTTP Server Listen Port
PORT=3001

# Application Environment (development | production | test)
NODE_ENV=development

# MongoDB Connection String (Default points to local imenu-db database)
MONGODB_URL=mongodb://localhost:27017/imenu-db
MONGODB_USERNAME=
MONGODB_PASSWORD=

# JWT Authentication Secret Key (Change this in production environments)
JWT_SECRET=imenu_jwt_secret_key_super_secure_2026
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# Allowed Frontend Origins for CORS (Comma-separated list)
CORS_ORIGINS=http://localhost:3000,http://localhost:3003,http://localhost:3004,http://localhost:3005

# Swagger API Documentation URL Path
SWAGGER_PATH=api-docs
```

#### Step 4: Start MongoDB
Ensure that your MongoDB instance is running and accessible:
- *Via Docker:*
  ```bash
  docker run -d --name imenu-mongo -p 27017:27017 -v mongo_data:/data/db mongo:7
  ```
- *Via Local Service:* Verify that your local `mongod` service is started.

#### Step 5: Start the Application in Development Mode
```bash
npm run start:dev
```

#### Step 6: Verify Automatic Data Seeding
During initial startup, the API checks for the presence of essential records and automatically seeds:
- **6 Default System Roles**:
  1. `system_admin`: SaaS System Administrator (full administrative control)
  2. `restaurant_admin`: Restaurant Owner / Franchise Admin
  3. `restaurant_manager`: Restaurant Manager (Floor, Kitchen, Menu, Reports)
  4. `cashier`: Cashier (POS ordering, Invoicing, Payments)
  5. `kitchen`: Kitchen Staff (KDS preparation queues)
  6. `waiter`: Service Waiter (Table operations, Serving)
- **Super Admin Account Configured via `.env`**:
  - Automatically synchronized and always overwrites password hash on server boot:
  - **Email**: `SUPERADMIN_EMAIL` (Default: `superadmin@imenu.vn`)
  - **Username**: `SUPERADMIN_USERNAME` (Default: `superadmin`)
  - **Password**: `SUPERADMIN_PASSWORD` (Default: `SuperAdmin@2026!`)
  - **Full Name**: `SUPERADMIN_FULLNAME` (Default: `Quan Tri Vien He Thong iMenu`)
  - **Phone**: `SUPERADMIN_PHONE` (Default: `0900000000`)

#### Step 7: Verify Server Health & Swagger UI
- **Server Health Check**:  
  Open in browser: [http://localhost:3001/health](http://localhost:3001/health)  
  *Expected response: `{ status: "ok", timestamp: "..." }`*
- **Swagger Interactive API Documentation**:  
  Open in browser: [http://localhost:3001/api-docs](http://localhost:3001/api-docs) (or `http://localhost:3001/api/v1/api-docs`) to inspect and test all endpoints.

---

### B. Subsequent Runs

For daily development or deployment after the initial setup has completed:

#### 1. Daily Development (Hot-Reload Enabled)
Starts the NestJS compiler in watch mode with automatic re-compilation on file changes:
```bash
npm run start:dev
```

#### 2. Debugging Mode
Starts the server with an active V8 inspector on port 9229:
```bash
npm run start:debug
```

#### 3. Production Build & Execution
Compiles TypeScript into production-ready JavaScript in the `dist/` directory and starts the server:
```bash
# Step 1: Build the production bundle
npm run build

# Step 2: Start the production server
npm run start:prod
```

---

## 5. 📜 Useful NPM Scripts

| Command | Action |
| :--- | :--- |
| `npm run start` | Starts the application with Nest CLI |
| `npm run start:dev` | Starts the server in development watch mode (Hot-reload) |
| `npm run start:debug` | Starts the server in debug watch mode with V8 inspector |
| `npm run build` | Compiles TypeScript source files into the `dist/` distribution folder |
| `npm run start:prod` | Runs the compiled application directly using `node dist/main.js` |
| `npm run format` | Automatically formats codebase with Prettier |
| `npm run lint` | Runs ESLint and automatically applies available fixes |
| `npm test` | Runs automated unit tests with Jest |
| `npm run test:watch` | Runs unit tests in continuous watch mode |
| `npm run test:cov` | Generates code coverage reports for tests |
| `npm run test:phase2:all` | Runs all 22 Phase 2 E2E integration tests (Auth + Multi-Branch) |
| `npm run test:phase3` | Runs all 16 Phase 3 E2E integration tests (Super Admin, Soft Delete, Sub-branch Scoping, VietQR & RBAC) |

---

## 6. 📡 Core API Endpoints Reference

All business routes are scoped under the `/api/v1/` prefix:

| Module | Base Path | Key Capabilities | Required Permission |
| :--- | :--- | :--- | :--- |
| **Health** | `GET /health` | Server and database health status | Public (`@Public()`) |
| **Auth** | `/api/v1/auth` | User login (`/login`), token refresh (`/refresh-token`), profile (`/profile`) | Public / JWT Authenticated |
| **Users** | `/api/v1/users` | Staff directory, onboarding assistance, toggle status (`PATCH /:id/toggle-status`), soft delete (`DELETE /:id`), transfer | JWT (`STAFF` permissions) |
| **Roles** | `/api/v1/roles` | Custom role definitions, bidirectional mapping, 17-permission matrix (`GET /permissions/matrix`) | JWT (`ROLE` / `STAFF` permissions) |
| **Restaurants**| `/api/v1/restaurants` | Global restaurant directory (`GET /`), restaurant details (`GET /:id`), current config (`GET & PUT /current`) | JWT (`SETTING` permissions / Super Admin) |
| **Branches** | `/api/v1/branches` | Multi-branch lifecycle & management, multi-tenant queries via `?restaurantId=...` | JWT (`BRANCH` permissions) |
| **Tables** | `/api/v1/tables` | Table floor map, area layout, dynamic table QR code creation | JWT / Public (QR Scan) |
| **Menu** | `/api/v1/menu` | Dish categories, item options, pricing, and stock status | JWT / Public (Diner Menu) |
| **Orders** | `/api/v1/orders` | Table order placement, KDS dispatch, cooking status flow | JWT / Public (Table Session) |
| **Bills** | `/api/v1/bills` | Invoicing, VAT calculations, discount logic, checkout settlement | JWT (`BILL`, `POS` permissions) |
| **Activity Log**| `/api/v1/activity-log` | Audit logs capturing mutating operations across the system | JWT (`ACTIVITY_LOG_VIEW`) |

---

<div align="center">

**iMenu System Team © 2026** — *Empowering Modern F&B Dining Experiences*

</div>
