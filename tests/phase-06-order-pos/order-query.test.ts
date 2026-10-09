import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types, Model } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { RolesService } from '../../src/modules/roles/roles.service';
import { Order, OrderDocument } from '../../src/modules/orders/entities/order.entity';
import { JwtConstants } from '../../src/shared/common/constants/envConstants';

const TEST_PORT = 3102;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let app: INestApplication;
let orderModel: Model<OrderDocument>;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function pass(name: string, detail?: string) {
  console.log(`  ${colors.green}✔ PASS:${colors.reset} ${name}${detail ? ` (${detail})` : ''}`);
}

function fail(name: string, error: any) {
  console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${name}`);
  console.error(`    ${colors.red}${typeof error === 'object' ? JSON.stringify(error) : error}${colors.reset}`);
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  iMenu API - Sub-phase 6.7: Order Query, Filters, Search & Multi-Branch ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // 1. Khởi động NestJS App trên cổng độc lập
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const connection: Connection = app.get(getConnectionToken());
  const rolesService = app.get(RolesService);
  await rolesService.seedDefaultRoles();

  orderModel = connection.model<OrderDocument>(Order.name);
  await orderModel.syncIndexes();

  await app.listen(TEST_PORT);
  console.log(`  Test server đã khởi động trên cổng ${TEST_PORT}!\n`);

  // --- DỌN DẸP TRƯỚC KIỂM THỬ ---
  const db = connection.db;
  if (!db) {
    throw new Error('Không thể kết nối đến test database');
  }

  const prefix = `test_p67_${Date.now()}`;
  const restaurantCol = db.collection('restaurants');
  const userCol = db.collection('users');
  const tableCol = db.collection('tables');
  const zoneCol = db.collection('tablezones');
  const roleCol = db.collection('roles');

  const cashierRole = await roleCol.findOne({ slug: 'cashier' });
  const adminRole = await roleCol.findOne({ slug: 'restaurant_admin' });
  const superAdminRole = await roleCol.findOne({ slug: 'system_admin' });

  // 2. TẠO DỮ LIỆU FIXTURES
  // 2.1 Nhà hàng A (Chính)
  const restAId = new Types.ObjectId();
  const branch1ObjId = new Types.ObjectId();
  const branch1Id = branch1ObjId.toString(); // Main Branch HQ
  const branch2ObjId = new Types.ObjectId();
  const branch2Id = branch2ObjId.toString(); // Sub-Branch CN2

  await restaurantCol.insertOne({
    _id: restAId,
    name: `Nhà hàng A ${prefix}`,
    slug: `rest-a-${prefix}`,
    branches: [
      { _id: branch1ObjId, name: 'Chi nhánh Trụ sở chính (HQ)', isMainBranch: true, isActive: true },
      { _id: branch2ObjId, name: 'Chi nhánh Quận 2 (Sub)', isMainBranch: false, isActive: true },
    ],
    isActive: true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 2.2 Nhà hàng B (Dùng kiểm thử Phân lập Đa Người Thuê)
  const restBId = new Types.ObjectId();
  const branchBObjId = new Types.ObjectId();
  const branchBId = branchBObjId.toString();

  await restaurantCol.insertOne({
    _id: restBId,
    name: `Nhà hàng B ${prefix}`,
    slug: `rest-b-${prefix}`,
    branches: [{ _id: branchBObjId, name: 'Chi nhánh B', isMainBranch: true, isActive: true }],
    isActive: true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 2.3 Người dùng & Nhân sự
  const staff1Id = new Types.ObjectId();
  const staff2Id = new Types.ObjectId();
  const mainManagerId = new Types.ObjectId();
  const subManagerId = new Types.ObjectId();
  const restBUserId = new Types.ObjectId();
  const superAdminId = new Types.ObjectId();
  const unassignedUserId = new Types.ObjectId();

  await userCol.insertMany([
    {
      _id: staff1Id,
      email: `staff1_${prefix}@example.com`,
      fullName: 'Nhân viên 01',
      role: cashierRole?._id,
      restaurantId: restAId,
      branchId: branch1Id,
      isRoleActive: true,
      status: 'ACTIVE',
      isDeleted: false,
    },
    {
      _id: staff2Id,
      email: `staff2_${prefix}@example.com`,
      fullName: 'Nhân viên 02',
      role: cashierRole?._id,
      restaurantId: restAId,
      branchId: branch2Id,
      isRoleActive: true,
      status: 'ACTIVE',
      isDeleted: false,
    },
    {
      _id: mainManagerId,
      email: `main_${prefix}@example.com`,
      fullName: 'Quản lý Trụ sở chính',
      role: adminRole?._id,
      restaurantId: restAId,
      branchId: branch1Id,
      isRoleActive: true,
      status: 'ACTIVE',
      isDeleted: false,
    },
    {
      _id: subManagerId,
      email: `sub_${prefix}@example.com`,
      fullName: 'Quản lý Chi nhánh 2',
      role: cashierRole?._id,
      restaurantId: restAId,
      branchId: branch2Id,
      isRoleActive: true,
      status: 'ACTIVE',
      isDeleted: false,
    },
    {
      _id: restBUserId,
      email: `restb_${prefix}@example.com`,
      fullName: 'Admin Nhà hàng B',
      role: adminRole?._id,
      restaurantId: restBId,
      branchId: branchBId,
      isRoleActive: true,
      status: 'ACTIVE',
      isDeleted: false,
    },
    {
      _id: superAdminId,
      email: `superadmin_${prefix}@example.com`,
      fullName: 'Super Admin',
      role: superAdminRole?._id,
      isRoleActive: true,
      status: 'ACTIVE',
      isDeleted: false,
    },
    {
      _id: unassignedUserId,
      email: `unassigned_${prefix}@example.com`,
      fullName: 'Nhân viên chưa gán chi nhánh',
      role: cashierRole?._id,
      restaurantId: restAId,
      branchId: '',
      isRoleActive: true,
      status: 'ACTIVE',
      isDeleted: false,
    },
  ]);

  // 2.4 Đăng nhập lấy Bearer Tokens
  const jwt = await import('jsonwebtoken');
  const makeToken = (payload: any) => jwt.sign(payload, JwtConstants.secret, { expiresIn: '1h' });

  const mainToken = makeToken({
    id: mainManagerId.toString(),
    userId: mainManagerId.toString(),
    email: `main_${prefix}@example.com`,
    roleId: adminRole?._id.toString(),
    roleSlug: 'restaurant_admin',
    restaurantId: restAId.toString(),
    branchId: branch1Id,
  });

  const subToken = makeToken({
    id: subManagerId.toString(),
    userId: subManagerId.toString(),
    email: `sub_${prefix}@example.com`,
    roleId: cashierRole?._id.toString(),
    roleSlug: 'cashier',
    restaurantId: restAId.toString(),
    branchId: branch2Id,
  });

  const unassignedToken = makeToken({
    id: unassignedUserId.toString(),
    userId: unassignedUserId.toString(),
    email: `unassigned_${prefix}@example.com`,
    roleId: cashierRole?._id.toString(),
    roleSlug: 'cashier',
    restaurantId: restAId.toString(),
    branchId: '',
    isMainBranch: false,
  });

  const restBToken = makeToken({
    id: restBUserId.toString(),
    userId: restBUserId.toString(),
    email: `restb_${prefix}@example.com`,
    roleId: adminRole?._id.toString(),
    roleSlug: 'restaurant_admin',
    restaurantId: restBId.toString(),
    branchId: branchBId,
  });

  const superAdminToken = makeToken({
    id: superAdminId.toString(),
    userId: superAdminId.toString(),
    email: `superadmin_${prefix}@example.com`,
    roleId: superAdminRole?._id.toString(),
    roleSlug: 'system_admin',
    restaurantId: restAId.toString(),
    branchId: branch1Id,
    isSuperAdmin: true,
  });


  // 2.5 Bàn ăn
  const zoneAId = new Types.ObjectId();
  await zoneCol.insertOne({
    _id: zoneAId,
    name: 'Khu vực Tầng 1',
    restaurantId: restAId,
    branchId: branch1Id,
  });

  const table1Id = new Types.ObjectId();
  const table2Id = new Types.ObjectId();
  const tableVIPId = new Types.ObjectId();
  const tableCN2Id = new Types.ObjectId();

  await tableCol.insertMany([
    {
      _id: table1Id,
      name: 'Bàn 01',
      code: `b01_${prefix}`,
      zone: zoneAId,
      restaurantId: restAId,
      branchId: branch1Id,
      status: 'Occupied',
    },
    {
      _id: table2Id,
      name: 'Bàn 02',
      code: `b02_${prefix}`,
      zone: zoneAId,
      restaurantId: restAId,
      branchId: branch1Id,
      status: 'Occupied',
    },
    {
      _id: tableVIPId,
      name: 'Bàn VIP 01',
      code: `bvip_${prefix}`,
      zone: zoneAId,
      restaurantId: restAId,
      branchId: branch1Id,
      status: 'Available',
    },
    {
      _id: tableCN2Id,
      name: 'Bàn CN2-01',
      code: `bcn2_${prefix}`,
      zone: zoneAId,
      restaurantId: restAId,
      branchId: branch2Id,
      status: 'Occupied',
    },
  ]);

  // 2.6 Khởi tạo 8 Đơn hàng mẫu phục vụ kiểm thử
  const now = Date.now();
  const h1 = 3600 * 1000;

  const order1Id = new Types.ObjectId();
  const order2Id = new Types.ObjectId();
  const order3Id = new Types.ObjectId();
  const order4Id = new Types.ObjectId();
  const order5Id = new Types.ObjectId();
  const order6Id = new Types.ObjectId();
  const orderLegacyId = new Types.ObjectId();
  const orderRestBId = new Types.ObjectId();

  await orderModel.insertMany([
    // Đơn 1: Branch 1, Bàn 01, Preparing, Staff 1 tạo, tiền 150k
    {
      _id: order1Id,
      orderCode: `ORD-${prefix}-001`,
      restaurantId: restAId,
      branchId: branch1Id,
      tableId: table1Id,
      tableName: 'Bàn 01',
      status: 'Preparing',
      orderSource: 'STAFF_POS',
      subTotal: 150000,
      totalAmount: 150000,
      isPaid: false,
      openedAt: new Date(now - 3 * h1),
      createdAt: new Date(now - 3 * h1),
      updatedAt: new Date(now - 3 * h1),
      createdBy: staff1Id,
      rounds: [],
      items: [],
    },
    // Đơn 2: Branch 1, Bàn 02, WaitingConfirmation, Staff 2 tạo, tiền 250k
    {
      _id: order2Id,
      orderCode: `ORD-${prefix}-002`,
      restaurantId: restAId,
      branchId: branch1Id,
      tableId: table2Id,
      tableName: 'Bàn 02',
      status: 'WaitingConfirmation',
      orderSource: 'QR_CUSTOMER',
      subTotal: 250000,
      totalAmount: 250000,
      isPaid: false,
      openedAt: new Date(now - 2 * h1),
      createdAt: new Date(now - 2 * h1),
      updatedAt: new Date(now - 2 * h1),
      createdBy: staff2Id,
      rounds: [],
      items: [],
    },
    // Đơn 3: Branch 1, Bàn 01, Paid (VietQR), Staff 1 tạo, Staff 2 thu, tiền 500k
    {
      _id: order3Id,
      orderCode: `ORD-${prefix}-003`,
      restaurantId: restAId,
      branchId: branch1Id,
      tableId: table1Id,
      tableName: 'Bàn 01',
      status: 'Paid',
      orderSource: 'STAFF_POS',
      subTotal: 500000,
      totalAmount: 500000,
      isPaid: true,
      paymentMethod: 'VietQR',
      openedAt: new Date(now - 2 * h1),
      closedAt: new Date(now - 30 * 60 * 1000), // đóng cách đây 30 phút
      createdAt: new Date(now - 2 * h1),
      updatedAt: new Date(now - 30 * 60 * 1000),
      createdBy: staff1Id,
      paidBy: staff2Id,
      rounds: [],
      items: [],
    },
    // Đơn 4: Branch 1, Bàn VIP 01, Paid (Cash), Staff 2 tạo, Staff 1 thu, tiền 800k
    {
      _id: order4Id,
      orderCode: `ORD-${prefix}-004`,
      restaurantId: restAId,
      branchId: branch1Id,
      tableId: tableVIPId,
      tableName: 'Bàn VIP 01',
      status: 'Paid',
      orderSource: 'STAFF_POS',
      subTotal: 800000,
      totalAmount: 800000,
      isPaid: true,
      paymentMethod: 'Cash',
      openedAt: new Date(now - 6 * h1),
      closedAt: new Date(now - 5 * h1),
      createdAt: new Date(now - 6 * h1),
      updatedAt: new Date(now - 5 * h1),
      createdBy: staff2Id,
      paidBy: staff1Id,
      rounds: [],
      items: [],
    },
    // Đơn 5: Branch 2 (Sub-branch), Bàn CN2-01, Served, Staff 1 tạo, tiền 120k
    {
      _id: order5Id,
      orderCode: `ORD-${prefix}-005`,
      restaurantId: restAId,
      branchId: branch2Id,
      tableId: tableCN2Id,
      tableName: 'Bàn CN2-01',
      status: 'Served',
      orderSource: 'STAFF_POS',
      subTotal: 120000,
      totalAmount: 120000,
      isPaid: false,
      openedAt: new Date(now - 1 * h1),
      createdAt: new Date(now - 1 * h1),
      updatedAt: new Date(now - 1 * h1),
      createdBy: staff1Id,
      rounds: [],
      items: [],
    },
    // Đơn 6: Branch 2 (Sub-branch), Bàn CN2-01, Paid (VietQR), Staff 2 tạo & thu, tiền 350k
    {
      _id: order6Id,
      orderCode: `ORD-${prefix}-006`,
      restaurantId: restAId,
      branchId: branch2Id,
      tableId: tableCN2Id,
      tableName: 'Bàn CN2-01',
      status: 'Paid',
      orderSource: 'STAFF_POS',
      subTotal: 350000,
      totalAmount: 350000,
      isPaid: true,
      paymentMethod: 'VietQR',
      openedAt: new Date(now - 4 * h1),
      closedAt: new Date(now - 3 * h1),
      createdAt: new Date(now - 4 * h1),
      updatedAt: new Date(now - 3 * h1),
      createdBy: staff2Id,
      paidBy: staff2Id,
      rounds: [],
      items: [],
    },
    // Đơn 8: Đơn thuộc Nhà hàng B
    {
      _id: orderRestBId,
      orderCode: `ORD-${prefix}-RESTB`,
      restaurantId: restBId,
      branchId: branchBId,
      tableId: new Types.ObjectId(),
      tableName: 'Bàn Quán B',
      status: 'Preparing',
      orderSource: 'STAFF_POS',
      subTotal: 99000,
      totalAmount: 99000,
      isPaid: false,
      openedAt: new Date(now - 1 * h1),
      createdAt: new Date(now - 1 * h1),
      updatedAt: new Date(now - 1 * h1),
      rounds: [],
      items: [],
    },
  ]);

  // Insert đơn legacy trực tiếp qua mongodb driver để giả lập dữ liệu cũ thiếu branchId
  await db.collection('orders').insertOne({
    _id: orderLegacyId,
    orderCode: `ORD-${prefix}-LEGACY`,
    restaurantId: restAId,
    branchId: '',
    tableId: table1Id,
    tableName: 'Bàn Legacy',
    status: 'Cancelled',
    orderSource: 'STAFF_POS',
    subTotal: 0,
    totalAmount: 0,
    isPaid: false,
    openedAt: new Date(now - 10 * h1),
    createdAt: new Date(now - 10 * h1),
    updatedAt: new Date(now - 10 * h1),
    rounds: [],
    items: [],
  });

  // =========================================================================
  // BẮT ĐẦU TEST SUITES SUB-PHASE 6.7
  // =========================================================================

  // -------------------------------------------------------------------------
  // SUITE 1: DATE & TIME RANGE FILTERING (AC-6.7.1)
  // -------------------------------------------------------------------------
  console.log(`\n--- 1. KIỂM THỬ LỌC KHOẢNG THỜI GIAN (AC-6.7.1) ---`);

  // 1.1 Lọc theo createdAt từ T-3.5h đến T-0.5h
  try {
    const from = new Date(now - 3.5 * h1).toISOString();
    const to = new Date(now - 0.5 * h1).toISOString();
    const res = await request(`/orders?fromDate=${from}&toDate=${to}`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200 && Array.isArray(res.data.data.data)) {
      const codes = res.data.data.data.map((o: any) => o.orderCode);
      // Kỳ vọng: ORD-001 (T-3h), ORD-002 (T-2h), ORD-003 (T-2h), ORD-005 (T-1h)
      if (codes.includes(`ORD-${prefix}-001`) && codes.includes(`ORD-${prefix}-002`) && !codes.includes(`ORD-${prefix}-004`)) {
        pass('1.1: Lọc khoảng thời gian createdAt (T-3.5h đến T-0.5h) thành công');
        passed++;
      } else {
        fail('1.1: Lọc createdAt trả về kết quả không khớp', codes);
        failed++;
      }
    } else {
      fail('1.1: Gọi API lọc ngày giờ thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('1.1: Ngoại lệ', e);
    failed++;
  }

  // 1.2 Lọc theo closedAt (thời điểm đóng hóa đơn)
  try {
    const from = new Date(now - 1 * h1).toISOString();
    const to = new Date(now).toISOString();
    const res = await request(`/orders?dateField=closedAt&fromDate=${from}&toDate=${to}`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200 && Array.isArray(res.data.data.data)) {
      const codes = res.data.data.data.map((o: any) => o.orderCode);
      // Kỳ vọng: chỉ có ORD-003 đóng cách đây 30m
      if (codes.length === 1 && codes[0] === `ORD-${prefix}-003`) {
        pass('1.2: Lọc theo closedAt thành công', `Mã đơn: ${codes[0]}`);
        passed++;
      } else {
        fail('1.2: Lọc closedAt trả về kết quả không khớp', codes);
        failed++;
      }
    } else {
      fail('1.2: Gọi API lọc closedAt thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('1.2: Ngoại lệ', e);
    failed++;
  }

  // 1.2b Lọc theo openedAt
  try {
    const from = new Date(now - 3.5 * h1).toISOString();
    const to = new Date(now - 1.5 * h1).toISOString();
    const res = await request(`/orders?dateField=openedAt&fromDate=${from}&toDate=${to}`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200 && Array.isArray(res.data.data.data)) {
      const codes = res.data.data.data.map((o: any) => o.orderCode);
      if (codes.includes(`ORD-${prefix}-001`) && codes.includes(`ORD-${prefix}-002`) && codes.includes(`ORD-${prefix}-003`)) {
        pass('1.2b: Lọc theo openedAt thành công');
        passed++;
      } else {
        fail('1.2b: Lọc openedAt trả về kết quả không khớp', codes);
        failed++;
      }
    } else {
      fail('1.2b: Gọi API lọc openedAt thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('1.2b: Ngoại lệ', e);
    failed++;
  }

  // 1.3 Bắt lỗi when fromDate > toDate (Negative test)
  try {
    const from = new Date(now).toISOString();
    const to = new Date(now - 1 * h1).toISOString();
    const res = await request(`/orders?fromDate=${from}&toDate=${to}`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 400) {
      pass('1.3: Chặn fromDate > toDate (HTTP 400 Bad Request thành công)');
      passed++;
    } else {
      fail('1.3: Không chặn fromDate > toDate', res);
      failed++;
    }
  } catch (e) {
    fail('1.3: Ngoại lệ', e);
    failed++;
  }

  // 1.4 Bắt lỗi fromDate không đúng chuẩn ISO (Negative test)
  try {
    const res = await request(`/orders?fromDate=not-a-date`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 400) {
      pass('1.4: Chặn fromDate định dạng sai (HTTP 400 Bad Request thành công)');
      passed++;
    } else {
      fail('1.4: Không chặn fromDate sai', res);
      failed++;
    }
  } catch (e) {
    fail('1.4: Ngoại lệ', e);
    failed++;
  }

  // 1.5 Bắt lỗi dateField không thuộc danh sách cho phép (Negative test)
  try {
    const res = await request(`/orders?dateField=invalidField`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 400) {
      pass('1.5: Chặn dateField không hợp lệ (HTTP 400 Bad Request thành công)');
      passed++;
    } else {
      fail('1.5: Không chặn dateField sai', res);
      failed++;
    }
  } catch (e) {
    fail('1.5: Ngoại lệ', e);
    failed++;
  }

  // -------------------------------------------------------------------------
  // SUITE 2: STAFF FILTERING (AC-6.7.2)
  // -------------------------------------------------------------------------
  console.log(`\n--- 2. KIỂM THỬ LỌC THEO NHÂN VIÊN (AC-6.7.2) ---`);

  // 2.1 Lọc theo staffId (khớp createdBy HOẶC paidBy)
  try {
    const res = await request(`/orders?staffId=${staff1Id.toString()}`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200) {
      const codes = res.data.data.data.map((o: any) => o.orderCode);
      // Staff 1 tạo: 001, 003, 005. Staff 1 thu: 004
      if (
        codes.includes(`ORD-${prefix}-001`) &&
        codes.includes(`ORD-${prefix}-003`) &&
        codes.includes(`ORD-${prefix}-004`) &&
        codes.includes(`ORD-${prefix}-005`) &&
        !codes.includes(`ORD-${prefix}-002`)
      ) {
        pass('2.1: Lọc theo staffId khớp cả đơn tạo và đơn thanh toán thành công');
        passed++;
      } else {
        fail('2.1: Lọc staffId sai kết quả', codes);
        failed++;
      }
    } else {
      fail('2.1: Lọc staffId thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('2.1: Ngoại lệ', e);
    failed++;
  }

  // 2.2 Lọc riêng createdBy
  try {
    const res = await request(`/orders?createdBy=${staff2Id.toString()}`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200) {
      const codes = res.data.data.data.map((o: any) => o.orderCode);
      // Staff 2 tạo: 002, 004, 006
      if (
        codes.includes(`ORD-${prefix}-002`) &&
        codes.includes(`ORD-${prefix}-004`) &&
        codes.includes(`ORD-${prefix}-006`) &&
        !codes.includes(`ORD-${prefix}-001`)
      ) {
        pass('2.2: Lọc riêng createdBy thành công');
        passed++;
      } else {
        fail('2.2: Lọc createdBy sai kết quả', codes);
        failed++;
      }
    } else {
      fail('2.2: Lọc createdBy thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('2.2: Ngoại lệ', e);
    failed++;
  }

  // 2.3 Lọc riêng paidBy
  try {
    const res = await request(`/orders?paidBy=${staff2Id.toString()}`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200) {
      const codes = res.data.data.data.map((o: any) => o.orderCode);
      // Staff 2 thu: 003, 006
      if (
        codes.includes(`ORD-${prefix}-003`) &&
        codes.includes(`ORD-${prefix}-006`) &&
        !codes.includes(`ORD-${prefix}-004`)
      ) {
        pass('2.3: Lọc riêng paidBy thành công');
        passed++;
      } else {
        fail('2.3: Lọc paidBy sai kết quả', codes);
        failed++;
      }
    } else {
      fail('2.3: Lọc paidBy thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('2.3: Ngoại lệ', e);
    failed++;
  }

  // 2.4 Bắt lỗi staffId không phải ObjectId (Negative test)
  try {
    const res = await request(`/orders?staffId=123-invalid`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 400) {
      pass('2.4: Chặn staffId không phải ObjectId hợp lệ (HTTP 400 Bad Request thành công)');
      passed++;
    } else {
      fail('2.4: Không chặn staffId sai', res);
      failed++;
    }
  } catch (e) {
    fail('2.4: Ngoại lệ', e);
    failed++;
  }

  // -------------------------------------------------------------------------
  // SUITE 3: STATUS & MULTI-STATUS FILTERING (AC-6.7.3)
  // -------------------------------------------------------------------------
  console.log(`\n--- 3. KIỂM THỬ LỌC TRẠNG THÁI & ĐA TRẠNG THÁI (AC-6.7.3) ---`);

  // 3.1 Lọc 1 trạng thái
  try {
    const res = await request(`/orders?status=Preparing`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200) {
      const data = res.data.data.data;
      const allPreparing = data.every((o: any) => o.status === 'Preparing');
      if (allPreparing && data.length >= 1) {
        pass('3.1: Lọc đơn trạng thái status=Preparing thành công');
        passed++;
      } else {
        fail('3.1: Lọc đơn trạng thái sai kết quả', data);
        failed++;
      }
    } else {
      fail('3.1: Lọc đơn trạng thái thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('3.1: Ngoại lệ', e);
    failed++;
  }

  // 3.2 Lọc đa trạng thái phân tách bằng dấu phẩy
  try {
    const res = await request(`/orders?status=Preparing,WaitingConfirmation`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200) {
      const data = res.data.data.data;
      const allMatched = data.every(
        (o: any) => o.status === 'Preparing' || o.status === 'WaitingConfirmation',
      );
      const codes = data.map((o: any) => o.orderCode);
      if (allMatched && codes.includes(`ORD-${prefix}-001`) && codes.includes(`ORD-${prefix}-002`)) {
        pass('3.2: Lọc đa trạng thái (Preparing,WaitingConfirmation) thành công');
        passed++;
      } else {
        fail('3.2: Lọc đa trạng thái sai kết quả', codes);
        failed++;
      }
    } else {
      fail('3.2: Lọc đa trạng thái thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('3.2: Ngoại lệ', e);
    failed++;
  }

  // 3.3 Bỏ qua lọc khi status=all
  try {
    const res = await request(`/orders?status=all`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200 && res.data.data.total >= 6) {
      pass('3.3: Lọc status=all bỏ qua filter trạng thái thành công');
      passed++;
    } else {
      fail('3.3: status=all thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('3.3: Ngoại lệ', e);
    failed++;
  }

  // 3.4 Bắt lỗi trạng thái lạ không tồn tại (Negative test)
  try {
    const res = await request(`/orders?status=Preparing,BogusStatus`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 400) {
      pass('3.4: Chặn trạng thái không hợp lệ trong chuỗi đa trạng thái (HTTP 400 thành công)');
      passed++;
    } else {
      fail('3.4: Không chặn trạng thái sai', res);
      failed++;
    }
  } catch (e) {
    fail('3.4: Ngoại lệ', e);
    failed++;
  }

  // -------------------------------------------------------------------------
  // SUITE 4: PAYMENT METHOD FILTERING (AC-6.7.4)
  // -------------------------------------------------------------------------
  console.log(`\n--- 4. KIỂM THỬ LỌC PHƯƠNG THỨC THANH TOÁN (AC-6.7.4) ---`);

  // 4.1 Lọc VietQR
  try {
    const res = await request(`/orders?paymentMethod=VietQR`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200) {
      const data = res.data.data.data;
      const allVietQR = data.every((o: any) => o.paymentMethod === 'VietQR');
      const codes = data.map((o: any) => o.orderCode);
      if (allVietQR && codes.includes(`ORD-${prefix}-003`) && codes.includes(`ORD-${prefix}-006`)) {
        pass('4.1: Lọc paymentMethod=VietQR thành công');
        passed++;
      } else {
        fail('4.1: Lọc VietQR sai', codes);
        failed++;
      }
    } else {
      fail('4.1: Lọc VietQR thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('4.1: Ngoại lệ', e);
    failed++;
  }

  // 4.2 Lọc Cash
  try {
    const res = await request(`/orders?paymentMethod=Cash`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200) {
      const data = res.data.data.data;
      const allCash = data.every((o: any) => o.paymentMethod === 'Cash');
      const codes = data.map((o: any) => o.orderCode);
      if (allCash && codes.includes(`ORD-${prefix}-004`) && !codes.includes(`ORD-${prefix}-003`)) {
        pass('4.2: Lọc paymentMethod=Cash thành công');
        passed++;
      } else {
        fail('4.2: Lọc Cash sai', codes);
        failed++;
      }
    } else {
      fail('4.2: Lọc Cash thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('4.2: Ngoại lệ', e);
    failed++;
  }

  // 4.3 Bắt lỗi phương thức thanh toán sai (Negative test)
  try {
    const res = await request(`/orders?paymentMethod=CryptoCoin`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 400) {
      pass('4.3: Chặn phương thức thanh toán không hợp lệ (HTTP 400 thành công)');
      passed++;
    } else {
      fail('4.3: Không chặn phương thức thanh toán sai', res);
      failed++;
    }
  } catch (e) {
    fail('4.3: Ngoại lệ', e);
    failed++;
  }

  // -------------------------------------------------------------------------
  // SUITE 5: SEARCH SUPPORT (AC-6.7.5)
  // -------------------------------------------------------------------------
  console.log(`\n--- 5. KIỂM THỬ TÌM KIẾM THEO MÃ ĐƠN & TÊN BÀN (AC-6.7.5) ---`);

  // 5.1 Tìm theo tiền tố mã đơn
  try {
    const res = await request(`/orders?search=ORD-${prefix}-001`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200 && res.data.data.data.length === 1) {
      pass('5.1: Tìm kiếm chính xác mã đơn ORD-...-001 thành công');
      passed++;
    } else {
      fail('5.1: Tìm mã đơn thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('5.1: Ngoại lệ', e);
    failed++;
  }

  // 5.2 Tìm theo tên bàn
  try {
    const res = await request(`/orders?search=Bàn VIP`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200) {
      const codes = res.data.data.data.map((o: any) => o.orderCode);
      if (codes.includes(`ORD-${prefix}-004`)) {
        pass('5.2: Tìm kiếm theo tên bàn "Bàn VIP" thành công');
        passed++;
      } else {
        fail('5.2: Tìm tên bàn không khớp', codes);
        failed++;
      }
    } else {
      fail('5.2: Tìm tên bàn thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('5.2: Ngoại lệ', e);
    failed++;
  }

  // 5.2b Tìm kiếm chuỗi con chữ thường và tiền tố (Case-insensitive & Prefix search)
  try {
    const res = await request(`/orders?search=bàn vip`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    const resPrefix = await request(`/orders?search=ord-`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200 && resPrefix.status === 200) {
      const codes = res.data.data.data.map((o: any) => o.orderCode);
      const prefixCount = resPrefix.data.data.data.length;
      if (codes.includes(`ORD-${prefix}-004`) && prefixCount >= 4) {
        pass('5.2b: Tìm kiếm chuỗi con chữ thường và tiền tố (case-insensitive) thành công');
        passed++;
      } else {
        fail('5.2b: Tìm kiếm hoa thường/tiền tố không khớp', { codes, prefixCount });
        failed++;
      }
    } else {
      fail('5.2b: Tìm kiếm hoa thường/tiền tố thất bại', { res, resPrefix });
      failed++;
    }
  } catch (e) {
    fail('5.2b: Ngoại lệ', e);
    failed++;
  }

  // 5.3 Tìm với ký tự đặc biệt Regex (Xử lý an toàn không crash)
  try {
    const res = await request(`/orders?search=Bàn (VIP+01)*`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200 && Array.isArray(res.data.data.data)) {
      pass('5.3: Tìm kiếm với ký tự đặc biệt Regex an toàn, không gây crash');
      passed++;
    } else {
      fail('5.3: Tìm kiếm ký tự đặc biệt thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('5.3: Ngoại lệ', e);
    failed++;
  }

  // 5.3b Bắt lỗi search quá dài (> 100 ký tự)
  try {
    const longString = 'a'.repeat(101);
    const res = await request(`/orders?search=${longString}`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 400) {
      pass('5.3b: Chặn chuỗi tìm kiếm quá dài > 100 ký tự (HTTP 400 Bad Request thành công)');
      passed++;
    } else {
      fail('5.3b: Không chặn search quá dài', res);
      failed++;
    }
  } catch (e) {
    fail('5.3b: Ngoại lệ', e);
    failed++;
  }

  // 5.4 Tìm từ khóa không tồn tại trả về rỗng
  try {
    const res = await request(`/orders?search=NonExistentKeyword_999`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200 && res.data.data.data.length === 0 && res.data.data.total === 0) {
      pass('5.4: Tìm từ khóa không tồn tại trả về danh sách rỗng thành công');
      passed++;
    } else {
      fail('5.4: Tìm từ khóa không tồn tại sai kết quả', res);
      failed++;
    }
  } catch (e) {
    fail('5.4: Ngoại lệ', e);
    failed++;
  }

  // -------------------------------------------------------------------------
  // SUITE 6: PAGINATION & DETERMINISTIC SORTING (AC-6.7.6)
  // -------------------------------------------------------------------------
  console.log(`\n--- 6. KIỂM THỬ PHÂN TRANG & SẮP XẾP XÁC ĐỊNH (AC-6.7.6) ---`);

  // 6.1 Phân trang không trùng lặp bản ghi và tính toán totalPages
  try {
    const resP1 = await request(`/orders?page=1&limit=3`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    const resP2 = await request(`/orders?page=2&limit=3`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });

    if (resP1.status === 200 && resP2.status === 200) {
      const idsP1 = resP1.data.data.data.map((o: any) => o._id);
      const idsP2 = resP2.data.data.data.map((o: any) => o._id);
      const overlap = idsP1.some((id: string) => idsP2.includes(id));

      const total = resP1.data.data.total;
      const expectedPages = Math.ceil(total / 3);

      if (!overlap && resP1.data.data.totalPages === expectedPages) {
        pass('6.1: Phân trang trang 1 và 2 tách biệt, totalPages tính toán chính xác');
        passed++;
      } else {
        fail('6.1: Phân trang bị trùng bản ghi hoặc sai totalPages', { overlap, totalPages: resP1.data.data.totalPages });
        failed++;
      }
    } else {
      fail('6.1: Phân trang thất bại', { resP1, resP2 });
      failed++;
    }
  } catch (e) {
    fail('6.1: Ngoại lệ', e);
    failed++;
  }

  // 6.2 Sắp xếp tăng dần theo totalAmount (Deterministic tie-breaker test)
  try {
    const res = await request(`/orders?sortBy=totalAmount&sortOrder=asc&limit=10`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200) {
      const amounts = res.data.data.data.map((o: any) => o.totalAmount);
      const isSortedAsc = amounts.every((val: number, i: number, arr: number[]) => !i || arr[i - 1] <= val);
      if (isSortedAsc && amounts.length >= 4) {
        pass('6.2: Sắp xếp tăng dần theo totalAmount thành công', `Mảng giá trị: ${amounts.join(', ')}`);
        passed++;
      } else {
        fail('6.2: Sắp xếp totalAmount asc không đúng', amounts);
        failed++;
      }
    } else {
      fail('6.2: Gọi API sort thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('6.2: Ngoại lệ', e);
    failed++;
  }

  // 6.2b Sắp xếp giảm dần theo openedAt
  try {
    const res = await request(`/orders?sortBy=openedAt&sortOrder=desc&limit=10`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200) {
      const openedAts = res.data.data.data.map((o: any) => new Date(o.openedAt).getTime());
      const isSortedDesc = openedAts.every((val: number, i: number, arr: number[]) => !i || arr[i - 1] >= val);
      if (isSortedDesc && openedAts.length >= 4) {
        pass('6.2b: Sắp xếp giảm dần theo openedAt thành công');
        passed++;
      } else {
        fail('6.2b: Sắp xếp openedAt desc không đúng', openedAts);
        failed++;
      }
    } else {
      fail('6.2b: Gọi API sort openedAt desc thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('6.2b: Ngoại lệ', e);
    failed++;
  }

  // 6.2c Chặn sortBy không thuộc whitelist (Negative test)
  try {
    const res = await request(`/orders?sortBy=unauthorizedField`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 400) {
      pass('6.2c: Chặn sortBy không thuộc danh sách cho phép (HTTP 400 Bad Request thành công)');
      passed++;
    } else {
      fail('6.2c: Không chặn sortBy không hợp lệ', res);
      failed++;
    }
  } catch (e) {
    fail('6.2c: Ngoại lệ', e);
    failed++;
  }

  // 6.2d Sắp xếp ổn định khi nhiều bản ghi có cùng giá trị (Deterministic tie-breaker _id: -1)
  try {
    const res1 = await request(`/orders?sortBy=createdAt&sortOrder=asc&limit=10`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    const res2 = await request(`/orders?sortBy=createdAt&sortOrder=asc&limit=10`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res1.status === 200 && res2.status === 200) {
      const ids1 = res1.data.data.data.map((o: any) => o._id);
      const ids2 = res2.data.data.data.map((o: any) => o._id);
      const isIdentical = ids1.every((id: string, idx: number) => id === ids2[idx]);
      if (isIdentical && ids1.length >= 4) {
        pass('6.2d: Sắp xếp ổn định xác định với tie-breaker _id (Deterministic ordering) thành công');
        passed++;
      } else {
        fail('6.2d: Sắp xếp không có tính ổn định lặp lại', { ids1, ids2 });
        failed++;
      }
    } else {
      fail('6.2d: Gọi API kiểm tra deterministic sorting thất bại', { res1, res2 });
      failed++;
    }
  } catch (e) {
    fail('6.2d: Ngoại lệ', e);
    failed++;
  }

  // 6.3 Bắt lỗi limit > 100 (Negative test)
  try {
    const res = await request(`/orders?limit=150`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 400) {
      pass('6.3: Chặn limit > 100 (HTTP 400 Bad Request thành công)');
      passed++;
    } else {
      fail('6.3: Không chặn limit > 100', res);
      failed++;
    }
  } catch (e) {
    fail('6.3: Ngoại lệ', e);
    failed++;
  }

  // 6.4 Bắt lỗi page < 1 (Negative test)
  try {
    const res = await request(`/orders?page=0`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 400) {
      pass('6.4: Chặn page < 1 (HTTP 400 Bad Request thành công)');
      passed++;
    } else {
      fail('6.4: Không chặn page < 1', res);
      failed++;
    }
  } catch (e) {
    fail('6.4: Ngoại lệ', e);
    failed++;
  }

  // -------------------------------------------------------------------------
  // SUITE 7: MULTI-BRANCH & MULTI-TENANT ISOLATION (AC-6.7.7)
  // -------------------------------------------------------------------------
  console.log(`\n--- 7. KIỂM THỬ PHÂN LẬP ĐA CHI NHÁNH & NHÀ HÀNG (AC-6.7.7) ---`);

  // 7.1 Nhân viên chi nhánh con chỉ nhìn thấy đơn thuộc chi nhánh mình
  try {
    const res = await request(`/orders`, {
      headers: { Authorization: `Bearer ${subToken}` },
    });
    if (res.status === 200) {
      const data = res.data.data.data;
      const allBranch2 = data.every((o: any) => o.branchId === branch2Id);
      const codes = data.map((o: any) => o.orderCode);
      // Kỳ vọng: Chỉ chứa ORD-005 và ORD-006; Tuyệt đối không chứa ORD-001..004 và không chứa ORD-LEGACY!
      if (
        allBranch2 &&
        codes.includes(`ORD-${prefix}-005`) &&
        codes.includes(`ORD-${prefix}-006`) &&
        !codes.includes(`ORD-${prefix}-001`) &&
        !codes.includes(`ORD-${prefix}-LEGACY`)
      ) {
        pass('7.1: Nhân viên chi nhánh con CHỈ thấy đơn chi nhánh mình (Zero data leak)');
        passed++;
      } else {
        fail('7.1: Chi nhánh con bị rò rỉ đơn hàng khác', codes);
        failed++;
      }
    } else {
      fail('7.1: Chi nhánh con query thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('7.1: Ngoại lệ', e);
    failed++;
  }

  // 7.2 Nhân viên chi nhánh con cố tình truyền branchId của chi nhánh khác bị 403
  try {
    const res = await request(`/orders?branchId=${branch1Id}`, {
      headers: { Authorization: `Bearer ${subToken}` },
    });
    if (res.status === 403) {
      pass('7.2: Chặn chi nhánh con truy vấn branchId khác (HTTP 403 Forbidden thành công)');
      passed++;
    } else {
      fail('7.2: Không chặn chi nhánh con vượt rào', res);
      failed++;
    }
  } catch (e) {
    fail('7.2: Ngoại lệ', e);
    failed++;
  }

  // 7.2b Chặn nhân viên chưa được gán chi nhánh hợp lệ xem đơn (HTTP 403 Forbidden)
  try {
    const res = await request(`/orders`, {
      headers: { Authorization: `Bearer ${unassignedToken}` },
    });
    if (res.status === 403) {
      pass('7.2b: Chặn nhân viên chưa được gán chi nhánh xem đơn (HTTP 403 Forbidden thành công)');
      passed++;
    } else {
      fail('7.2b: Không chặn nhân viên chưa gán branchId', res);
      failed++;
    }
  } catch (e) {
    fail('7.2b: Ngoại lệ', e);
    failed++;
  }

  // 7.3 Main Branch xem toàn chuỗi (không truyền branchId)
  try {
    const res = await request(`/orders`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200) {
      const codes = res.data.data.data.map((o: any) => o.orderCode);
      if (codes.includes(`ORD-${prefix}-001`) && codes.includes(`ORD-${prefix}-005`)) {
        pass('7.3: Quản lý Trụ sở chính (Main Branch) xem được đơn toàn chuỗi');
        passed++;
      } else {
        fail('7.3: Main Branch không thấy toàn chuỗi', codes);
        failed++;
      }
    } else {
      fail('7.3: Main Branch query thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('7.3: Ngoại lệ', e);
    failed++;
  }

  // 7.4 Main Branch chỉ định lọc branch con
  try {
    const res = await request(`/orders?branchId=${branch2Id}`, {
      headers: { Authorization: `Bearer ${mainToken}` },
    });
    if (res.status === 200) {
      const data = res.data.data.data;
      const allBranch2 = data.every((o: any) => o.branchId === branch2Id);
      if (allBranch2 && data.length >= 2) {
        pass('7.4: Main Branch lọc chỉ định chi nhánh con thành công');
        passed++;
      } else {
        fail('7.4: Main Branch lọc branchId sai kết quả', data);
        failed++;
      }
    } else {
      fail('7.4: Main Branch lọc branchId thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('7.4: Ngoại lệ', e);
    failed++;
  }

  // 7.5 Phân lập Đa Người Thuê: Nhà hàng B không thấy bất kỳ đơn nào của Nhà hàng A
  try {
    const res = await request(`/orders`, {
      headers: { Authorization: `Bearer ${restBToken}` },
    });
    if (res.status === 200) {
      const codes = res.data.data.data.map((o: any) => o.orderCode);
      const hasRestA = codes.some((c: string) => c.startsWith(`ORD-${prefix}-00`));
      if (!hasRestA && codes.includes(`ORD-${prefix}-RESTB`)) {
        pass('7.5: Phân lập Đa Người Thuê tuyệt đối (Nhà hàng B không thấy đơn Nhà hàng A)');
        passed++;
      } else {
        fail('7.5: Bị rò rỉ đơn hàng xuyên nhà hàng', codes);
        failed++;
      }
    } else {
      fail('7.5: Nhà hàng B query thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('7.5: Ngoại lệ', e);
    failed++;
  }

  // 7.6 Super Admin truy vấn hợp lệ
  try {
    const res = await request(`/orders?branchId=${branch2Id}`, {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'x-restaurant-id': restAId.toString(),
      },
    });
    if (res.status === 200 && res.data.data.data.length >= 2) {
      pass('7.6: Super Admin truy vấn lọc chi nhánh thành công');
      passed++;
    } else {
      fail('7.6: Super Admin query thất bại', res);
      failed++;
    }
  } catch (e) {
    fail('7.6: Ngoại lệ', e);
    failed++;
  }

  // -------------------------------------------------------------------------
  // SUITE 8: INDEX PERFORMANCE VERIFICATION (AC-6.7.8)
  // -------------------------------------------------------------------------
  console.log(`\n--- 8. KIỂM THỬ HIỆU NĂNG INDEX (EXPLAIN PLAN) (AC-6.7.8) ---`);

  try {
    const explainResult: any = await orderModel
      .find({
        restaurantId: restAId,
        branchId: branch1Id,
        status: 'Preparing',
      })
      .sort({ createdAt: -1, _id: -1 })
      .explain('executionStats');

    const winningPlan = explainResult?.queryPlanner?.winningPlan;
    const planStr = JSON.stringify(winningPlan || {});

    // Phải là IXSCAN (hoặc FETCH/SORT bọc quanh IXSCAN), không được phép là COLLSCAN
    const isIndexScan = planStr.includes('"stage":"IXSCAN"') && !planStr.includes('"stage":"COLLSCAN"');

    if (isIndexScan) {
      pass('8.1: Query sử dụng Compound Index (IXSCAN), không quét toàn bảng COLLSCAN');
      passed++;
    } else {
      fail('8.1: Query không dùng index tối ưu', winningPlan?.stage);
      failed++;
    }

  } catch (e) {
    fail('8.1: Ngoại lệ explain', e);
    failed++;
  }

  // 8.2 Xác minh danh sách Compound Indexes thực tế tồn tại trên Collection
  try {
    const indexes = await orderModel.collection.indexes();
    const indexNames = indexes.map((idx: any) => idx.name);
    const requiredIndexes = [
      'restaurantId_1_branchId_1_createdAt_-1',
      'restaurantId_1_branchId_1_openedAt_-1',
      'restaurantId_1_branchId_1_closedAt_-1',
      'restaurantId_1_branchId_1_paymentMethod_1_createdAt_-1',
      'restaurantId_1_createdBy_1_createdAt_-1',
      'restaurantId_1_paidBy_1_createdAt_-1',
    ];

    const allExist = requiredIndexes.every((reqIdx) => indexNames.includes(reqIdx));
    if (allExist) {
      pass('8.2: Xác minh đầy đủ 6 Compound Indexes dự kiến tồn tại trên MongoDB Collection');
      passed++;
    } else {
      fail('8.2: Thiếu một số compound index', { requiredIndexes, indexNames });
      failed++;
    }
  } catch (e) {
    fail('8.2: Ngoại lệ kiểm tra indexes', e);
    failed++;
  }

  // --- DỌN DẸP DỮ LIỆU KIỂM THỬ (TEARDOWN) ---
  console.log(`\n--- DỌN DẸP TÀI NGUYÊN KIỂM THỬ (TEARDOWN) ---`);
  try {
    await orderModel.deleteMany({
      _id: {
        $in: [
          order1Id,
          order2Id,
          order3Id,
          order4Id,
          order5Id,
          order6Id,
          orderLegacyId,
          orderRestBId,
        ],
      },
    });
    await userCol.deleteMany({
      _id: {
        $in: [staff1Id, staff2Id, mainManagerId, subManagerId, restBUserId, superAdminId, unassignedUserId],
      },
    });
    await tableCol.deleteMany({ _id: { $in: [table1Id, table2Id, tableVIPId, tableCN2Id] } });
    await zoneCol.deleteOne({ _id: zoneAId });
    await restaurantCol.deleteMany({ _id: { $in: [restAId, restBId] } });
    console.log('  Đã dọn dẹp sạch sẽ toàn bộ tài nguyên kiểm thử Sub-phase 6.7!\n');
  } catch (err) {
    console.error('  Lỗi khi dọn dẹp:', err);
  }

  await app.close();

  console.log(`----------------------------------------------------------------`);
  console.log(`Kết quả kiểm thử Sub-phase 6.7: ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : colors.reset}${failed} failed${colors.reset}`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error trong test runner:', err);
  process.exit(1);
});
