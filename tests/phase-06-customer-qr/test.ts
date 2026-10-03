import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { RolesService } from '../../src/modules/roles/roles.service';
import { UsersService } from '../../src/modules/users/users.service';
import { OrdersService } from '../../src/modules/orders/orders.service';

const TEST_PORT = 3096;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let app: INestApplication;

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
  console.log(`${colors.bold}${colors.cyan}  iMenu API - Sub-phase 6.4: Customer QR Ordering Test Suite            ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  console.log('Khởi động test server trên port', TEST_PORT, '...');
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const connection: Connection = app.get(getConnectionToken());
  const rolesService = app.get(RolesService);
  await rolesService.seedDefaultRoles();

  const usersService = app.get(UsersService);
  await usersService.initAdmin();

  const ordersService = app.get(OrdersService);

  await app.listen(TEST_PORT);
  console.log('Test server đã sẵn sàng!\n');

  const timestamp = Date.now();
  const restASlug = `rest-qr-a-${timestamp}`;
  const restBSlug = `rest-qr-b-${timestamp}`;

  const restAId = new Types.ObjectId();
  const restBId = new Types.ObjectId();
  const branchAId = 'branch-main-a';
  const branchBId = 'branch-main-b';

  const zoneAId = new Types.ObjectId();
  const table1Id = new Types.ObjectId();
  const table2InactiveId = new Types.ObjectId();
  const table3RevokedId = new Types.ObjectId();

  const zoneBId = new Types.ObjectId();
  const tableB1Id = new Types.ObjectId();

  const menuItem1Id = new Types.ObjectId();
  const menuItem2Id = new Types.ObjectId();

  const qrTokenT1 = `token-t1-${timestamp}`;
  const qrTokenT2 = `token-t2-${timestamp}`;
  const qrTokenT3 = `token-t3-${timestamp}`;
  const qrTokenTB = `token-tb-${timestamp}`;

  let createdOrder1Id = '';
  let cashierToken = '';

  try {
    // ------------------------------------------------------------------------
    // SETUP: Tạo Nhà hàng A, Nhà hàng B, Bàn ăn, Thực đơn trực tiếp qua DB
    // ------------------------------------------------------------------------
    console.log(`${colors.bold}--- THIẾT LẬP DỮ LIỆU KIỂM THỬ ---${colors.reset}`);

    // 1. Tạo Nhà hàng A
    await connection.collection('restaurants').insertOne({
      _id: restAId,
      name: 'Nhà Hàng QR Test A',
      slug: restASlug,
      phone: '0901111222',
      address: '123 Đường Test A',
      isOpen: true,
      branches: [
        {
          _id: new Types.ObjectId(),
          name: 'Chi nhánh chính A',
          isMainBranch: true,
          phone: '0901111222',
          address: '123 Đường Test A',
          status: 'Active',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Tạo Nhà hàng B (để kiểm tra phân lập đa người thuê / Cross-restaurant)
    await connection.collection('restaurants').insertOne({
      _id: restBId,
      name: 'Nhà Hàng QR Test B',
      slug: restBSlug,
      phone: '0903333444',
      address: '456 Đường Test B',
      isOpen: true,
      branches: [
        {
          _id: new Types.ObjectId(),
          name: 'Chi nhánh chính B',
          isMainBranch: true,
          phone: '0903333444',
          address: '456 Đường Test B',
          status: 'Active',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Tạo Zone và Tables cho Nhà hàng A
    await connection.collection('table_zones').insertOne({
      _id: zoneAId,
      name: 'Khu vực Tầng 1',
      restaurantId: restAId,
      branchId: branchAId,
      isDeleted: false,
    });

    // Tạo Zone cho Nhà hàng B
    await connection.collection('table_zones').insertOne({
      _id: zoneBId,
      name: 'Khu vực B',
      restaurantId: restBId,
      branchId: branchBId,
      isDeleted: false,
    });

    // Bàn 1: Active QR
    await connection.collection('tables').insertOne({
      _id: table1Id,
      code: 'ban-01',
      name: 'Bàn 01',
      zone: zoneAId,
      restaurantId: restAId,
      branchId: branchAId,
      status: 'Available',
      qrToken: qrTokenT1,
      qrStatus: 'active',
      isDeleted: false,
    });

    // Bàn 2: Inactive QR
    await connection.collection('tables').insertOne({
      _id: table2InactiveId,
      code: 'ban-02-inactive',
      name: 'Bàn 02 Inactive',
      zone: zoneAId,
      restaurantId: restAId,
      branchId: branchAId,
      status: 'Available',
      qrToken: qrTokenT2,
      qrStatus: 'inactive',
      isDeleted: false,
    });

    // Bàn 3: Revoked QR
    await connection.collection('tables').insertOne({
      _id: table3RevokedId,
      code: 'ban-03-revoked',
      name: 'Bàn 03 Revoked',
      zone: zoneAId,
      restaurantId: restAId,
      branchId: branchAId,
      status: 'Available',
      qrToken: qrTokenT3,
      qrStatus: 'revoked',
      isDeleted: false,
    });

    // 4. Tạo Table cho Nhà hàng B (Bàn TB-01)
    await connection.collection('tables').insertOne({
      _id: tableB1Id,
      code: 'ban-01', // Cùng code 'ban-01' nhưng thuộc Nhà hàng B
      name: 'Bàn 01 Nhà Hàng B',
      zone: zoneBId,
      restaurantId: restBId,
      branchId: branchBId,
      status: 'Available',
      qrToken: qrTokenTB,
      qrStatus: 'active',
      isDeleted: false,
    });

    // 5. Tạo Danh mục & Menu Items cho Nhà hàng A
    const catId = new Types.ObjectId();
    await connection.collection('menu_categories').insertOne({
      _id: catId,
      name: 'Món Chính',
      slug: 'mon-chinh',
      restaurantId: restAId,
      branches: [branchAId],
      isActive: true,
      order: 1,
    });

    await connection.collection('menu_items').insertMany([
      {
        _id: menuItem1Id,
        restaurantId: restAId,
        category: catId,
        name: 'Phở Bò Đặc Biệt',
        slug: 'pho-bo-dac-biet',
        price: 65000,
        isAvailable: true,
        isDeleted: false,
      },
      {
        _id: menuItem2Id,
        restaurantId: restAId,
        category: catId,
        name: 'Trà Đào Cam Sả',
        slug: 'tra-dao-cam-sa',
        price: 30000,
        isAvailable: true,
        isDeleted: false,
      },
    ]);

    // 6. Tạo tài khoản Cashier cho Nhà hàng A để test luồng tích hợp duyệt đơn
    const cashierRole = await connection.collection('roles').findOne({ slug: 'cashier' });
    const cashierId = new Types.ObjectId();
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('123456', 10);

    await connection.collection('users').insertOne({
      _id: cashierId,
      username: `cashier_${timestamp}`,
      email: `cashier_${timestamp}@test.com`,
      phone: `0987${Math.floor(100000 + Math.random() * 900000)}`,
      password: hashedPassword,
      name: 'Thu Ngân Test',
      restaurantId: restAId,
      branchId: branchAId,
      role: cashierRole?._id,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `cashier_${timestamp}@test.com`,
        password: '123456',
      }),
    });
    cashierToken = loginRes.data?.data?.accessToken || '';

    console.log(`  ${colors.green}✔ Đã thiết lập xong môi trường kiểm thử Sub-phase 6.4${colors.reset}\n`);

    // ========================================================================
    // PHẦN A: KIỂM THỬ XÁC THỰC BỘ BA BẢO MẬT QR (UNIT / LOGICAL VALIDATION)
    // ========================================================================
    console.log(`${colors.bold}--- PHẦN A: KIỂM THỬ XÁC THỰC BẢO MẬT MÃ QR (QR SESSION VALIDATOR) ---${colors.reset}`);

    // TC-6.4-V01: Xác thực hợp lệ
    try {
      const res = await ordersService.validateQrSession(restASlug, 'ban-01', qrTokenT1);
      if (res.restaurant.slug === restASlug && res.table.code === 'ban-01') {
        pass('TC-6.4-V01: validateQrSession thành công với bộ ba hợp lệ', `slug: ${restASlug}, table: ban-01`);
        passed++;
      } else {
        fail('TC-6.4-V01: validateQrSession thành công', 'Kết quả không khớp');
        failed++;
      }
    } catch (e: any) {
      fail('TC-6.4-V01: validateQrSession thành công', e.message);
      failed++;
    }

    // TC-6.4-V02: Chặn khi restaurantSlug không tồn tại (404)
    try {
      await ordersService.validateQrSession('non-existent-restaurant', 'ban-01', qrTokenT1);
      fail('TC-6.4-V02: Chặn restaurantSlug không tồn tại', 'Lẽ ra phải ném lỗi 404');
      failed++;
    } catch (e: any) {
      if (e.status === 404 || e.name === 'NotFoundException') {
        pass('TC-6.4-V02: Chặn restaurantSlug không tồn tại', 'Ném NotFoundException 404');
        passed++;
      } else {
        fail('TC-6.4-V02: Chặn restaurantSlug không tồn tại', e.message);
        failed++;
      }
    }

    // TC-6.4-V03: Chặn khi tableCode không tồn tại trong nhà hàng (404)
    try {
      await ordersService.validateQrSession(restASlug, 'ban-999', qrTokenT1);
      fail('TC-6.4-V03: Chặn tableCode không tồn tại', 'Lẽ ra phải ném lỗi 404');
      failed++;
    } catch (e: any) {
      if (e.status === 404 || e.name === 'NotFoundException') {
        pass('TC-6.4-V03: Chặn tableCode không tồn tại', 'Ném NotFoundException 404');
        passed++;
      } else {
        fail('TC-6.4-V03: Chặn tableCode không tồn tại', e.message);
        failed++;
      }
    }

    // TC-6.4-V04: Chặn khi qrToken không khớp (400)
    try {
      await ordersService.validateQrSession(restASlug, 'ban-01', 'wrong-qr-token');
      fail('TC-6.4-V04: Chặn qrToken sai lệch', 'Lẽ ra phải ném lỗi 400');
      failed++;
    } catch (e: any) {
      if (e.status === 400 || e.name === 'BadRequestException') {
        pass('TC-6.4-V04: Chặn qrToken sai lệch', 'Ném BadRequestException 400');
        passed++;
      } else {
        fail('TC-6.4-V04: Chặn qrToken sai lệch', e.message);
        failed++;
      }
    }

    // TC-6.4-V05: Chặn khi qrStatus = 'inactive' (400)
    try {
      await ordersService.validateQrSession(restASlug, 'ban-02-inactive', qrTokenT2);
      fail('TC-6.4-V05: Chặn bàn có QR Inactive', 'Lẽ ra phải ném lỗi 400');
      failed++;
    } catch (e: any) {
      if (e.status === 400 || e.name === 'BadRequestException') {
        pass('TC-6.4-V05: Chặn bàn có QR Inactive', 'Ném BadRequestException 400');
        passed++;
      } else {
        fail('TC-6.4-V05: Chặn bàn có QR Inactive', e.message);
        failed++;
      }
    }

    // TC-6.4-V06: Chặn khi qrStatus = 'revoked' (400)
    try {
      await ordersService.validateQrSession(restASlug, 'ban-03-revoked', qrTokenT3);
      fail('TC-6.4-V06: Chặn bàn có QR Revoked', 'Lẽ ra phải ném lỗi 400');
      failed++;
    } catch (e: any) {
      if (e.status === 400 || e.name === 'BadRequestException') {
        pass('TC-6.4-V06: Chặn bàn có QR Revoked', 'Ném BadRequestException 400');
        passed++;
      } else {
        fail('TC-6.4-V06: Chặn bàn có QR Revoked', e.message);
        failed++;
      }
    }

    // TC-6.4-V07: Chặn truy cập chéo nhà hàng (Cross-restaurant attack)
    // Bàn 'ban-01' thuộc Nhà hàng B nhưng kẻ tấn công gửi kèm slug của Nhà hàng A và token của Nhà hàng B
    try {
      await ordersService.validateQrSession(restASlug, 'ban-01', qrTokenTB);
      fail('TC-6.4-V07: Chặn truy cập chéo nhà hàng (Cross-Restaurant Attack)', 'Lẽ ra phải bị chặn');
      failed++;
    } catch (e: any) {
      // Vì Bàn 01 của Nhà hàng A có qrTokenT1 != qrTokenTB -> Bị chặn 400
      pass('TC-6.4-V07: Chặn truy cập chéo nhà hàng (Token mismatch hoặc không tìm thấy bàn)', e.message);
      passed++;
    }

    // ========================================================================
    // PHẦN B: KIỂM THỬ HTTP INTEGRATION ENDPOINTS (CUSTOMER QR ORDERING)
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN B: KIỂM THỬ HTTP ENDPOINTS GỌI MÓN CÔNG KHAI (KHÔNG CẦN JWT) ---${colors.reset}`);

    // TC-6.4-01: Tạo đơn hàng QR công khai (POST /api/orders/customer) không có Header Authorization
    const createOrderPayload = {
      restaurantSlug: restASlug,
      tableCode: 'ban-01',
      qrToken: qrTokenT1,
      customerNote: 'Bàn 01 gọi món qua QR',
      items: [
        {
          menuItemId: menuItem1Id.toString(),
          quantity: 2,
          selectedOptions: [
            {
              groupId: 'opt-meat',
              groupName: 'Thịt thêm',
              valueId: 'extra-beef',
              valueName: 'Bò tái thêm',
              priceDelta: 15000,
            },
          ],
          note: 'Không hành tây',
        },
        {
          menuItemId: menuItem2Id.toString(),
          quantity: 1,
          note: 'Ít ngọt',
        },
      ],
    };

    const res01 = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify(createOrderPayload),
    });

    if (res01.status === 201 || res01.status === 200) {
      const order = res01.data?.data;
      createdOrder1Id = order._id;

      // 1 món phở: (65,000 + 15,000) * 2 = 160,000
      // 1 món trà đào: 30,000 * 1 = 30,000
      // Tổng cộng: 190,000
      const expectedSubTotal = (65000 + 15000) * 2 + 30000;

      const orderWaiting = order.status === 'WaitingConfirmation';
      const round1Waiting = order.rounds?.[0]?.status === 'WaitingConfirmation';
      const round1Source = order.rounds?.[0]?.source === 'QR_CUSTOMER';
      const itemsWaiting = order.items?.every((it: any) => it.status === 'WaitingConfirmation');
      const correctSubTotal = order.subTotal === expectedSubTotal;

      if (orderWaiting && round1Waiting && round1Source && itemsWaiting && correctSubTotal) {
        pass(
          'TC-6.4-01: Khách tạo đơn hàng qua QR thành công (Không cần staff JWT)',
          `Order: ${order.orderCode}, Status: ${order.status}, Round 1: ${order.rounds[0].status}, subTotal: ${order.subTotal}đ`,
        );
        passed++;
      } else {
        fail(
          'TC-6.4-01: Khách tạo đơn hàng qua QR thành công',
          `orderWaiting: ${orderWaiting}, round1Waiting: ${round1Waiting}, round1Source: ${round1Source}, itemsWaiting: ${itemsWaiting}, correctSubTotal: ${correctSubTotal}`,
        );
        failed++;
      }
    } else {
      fail('TC-6.4-01: Khách tạo đơn hàng qua QR thành công', res01.data);
      failed++;
    }

    // TC-6.4-02: Kiểm tra trạng thái bàn ăn đã được cập nhật sang Occupied
    const tableAfterOrder: any = await connection.collection('tables').findOne({ _id: table1Id });
    if (
      tableAfterOrder?.status === 'Occupied' &&
      tableAfterOrder?.currentOrderId?.toString() === createdOrder1Id
    ) {
      pass(
        'TC-6.4-02: Bàn ăn tự động chuyển sang Occupied và liên kết currentOrderId',
        `status: ${tableAfterOrder.status}, currentOrderId: ${tableAfterOrder.currentOrderId}`,
      );
      passed++;
    } else {
      fail('TC-6.4-02: Bàn ăn tự động chuyển sang Occupied', JSON.stringify(tableAfterOrder));
      failed++;
    }

    // TC-6.4-03: Chặn tạo đơn mới khi bàn đang có đơn hoạt động chưa thanh toán (HTTP 409 Conflict)
    const res03 = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify(createOrderPayload),
    });
    if (res03.status === 409) {
      pass(
        'TC-6.4-03: Chặn tạo đơn mới khi bàn đang có đơn hoạt động (HTTP 409 Conflict)',
        res03.data?.message,
      );
      passed++;
    } else {
      fail('TC-6.4-03: Chặn tạo đơn mới khi bàn đang có đơn hoạt động', `Status: ${res03.status}`);
      failed++;
    }

    // TC-6.4-04: Chặn tạo đơn khi restaurantSlug không hợp lệ (HTTP 404)
    const res04 = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        ...createOrderPayload,
        restaurantSlug: 'invalid-slug-xyz',
      }),
    });
    if (res04.status === 404) {
      pass('TC-6.4-04: Chặn tạo đơn với restaurantSlug không tồn tại (HTTP 404 Not Found)');
      passed++;
    } else {
      fail('TC-6.4-04: Chặn tạo đơn với restaurantSlug không tồn tại', `Status: ${res04.status}`);
      failed++;
    }

    // TC-6.4-05: Chặn tạo đơn khi tableCode không tồn tại trong nhà hàng (HTTP 404)
    const res05 = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        ...createOrderPayload,
        tableCode: 'ban-khong-ton-tai',
      }),
    });
    if (res05.status === 404) {
      pass('TC-6.4-05: Chặn tạo đơn với tableCode không thuộc nhà hàng (HTTP 404 Not Found)');
      passed++;
    } else {
      fail('TC-6.4-05: Chặn tạo đơn với tableCode không thuộc nhà hàng', `Status: ${res05.status}`);
      failed++;
    }

    // TC-6.4-06: Chặn tạo đơn khi qrToken sai lệch (HTTP 400)
    const res06 = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        ...createOrderPayload,
        qrToken: 'wrong-token-12345',
      }),
    });
    if (res06.status === 400) {
      pass('TC-6.4-06: Chặn tạo đơn khi qrToken không khớp (HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-6.4-06: Chặn tạo đơn khi qrToken không khớp', `Status: ${res06.status}`);
      failed++;
    }

    // TC-6.4-07: Chặn tạo đơn khi qrStatus = 'inactive' (HTTP 400)
    const res07 = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        ...createOrderPayload,
        tableCode: 'ban-02-inactive',
        qrToken: qrTokenT2,
      }),
    });
    if (res07.status === 400) {
      pass('TC-6.4-07: Chặn tạo đơn khi mã QR bàn bị vô hiệu hóa (qrStatus: inactive) (HTTP 400)');
      passed++;
    } else {
      fail('TC-6.4-07: Chặn tạo đơn khi mã QR bàn bị vô hiệu hóa', `Status: ${res07.status}`);
      failed++;
    }

    // TC-6.4-08: Chặn tạo đơn khi qrStatus = 'revoked' (HTTP 400)
    const res08 = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        ...createOrderPayload,
        tableCode: 'ban-03-revoked',
        qrToken: qrTokenT3,
      }),
    });
    if (res08.status === 400) {
      pass('TC-6.4-08: Chặn tạo đơn khi mã QR bàn đã bị thu hồi (qrStatus: revoked) (HTTP 400)');
      passed++;
    } else {
      fail('TC-6.4-08: Chặn tạo đơn khi mã QR bàn đã bị thu hồi', `Status: ${res08.status}`);
      failed++;
    }

    // TC-6.4-09: Chặn tạo đơn không có món ăn (HTTP 400)
    const res09 = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        ...createOrderPayload,
        items: [],
      }),
    });
    if (res09.status === 400) {
      pass('TC-6.4-09: Chặn tạo đơn không chứa món ăn nào (HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-6.4-09: Chặn tạo đơn không chứa món ăn nào', `Status: ${res09.status}`);
      failed++;
    }

    // TC-6.4-10: Khách hàng xem đơn hàng hoạt động qua QR (GET /api/orders/customer/active)
    const res10 = await request(
      `/orders/customer/active?restaurantSlug=${restASlug}&tableCode=ban-01&qrToken=${qrTokenT1}`,
    );
    if (res10.status === 200 && res10.data?.data?._id === createdOrder1Id) {
      pass(
        'TC-6.4-10: Khách hàng xem đơn hàng hoạt động của bàn qua mã QR thành công (Không cần staff JWT)',
        `orderCode: ${res10.data.data.orderCode}`,
      );
      passed++;
    } else {
      fail('TC-6.4-10: Khách hàng xem đơn hàng hoạt động của bàn qua mã QR', res10.data);
      failed++;
    }

    // TC-6.4-11: Khách hàng gọi thêm món (Round 2) qua QR (POST /api/orders/customer/items) không cần JWT
    const addItemsPayload = {
      restaurantSlug: restASlug,
      tableCode: 'ban-01',
      qrToken: qrTokenT1,
      note: 'Giao đợt 2 nhanh giúp em',
      items: [
        {
          menuItemId: menuItem2Id.toString(),
          quantity: 2, // 30,000 * 2 = 60,000
          note: 'Không đá',
        },
      ],
    };

    const res11 = await request('/orders/customer/items', {
      method: 'POST',
      body: JSON.stringify(addItemsPayload),
    });

    if (res11.status === 200) {
      const order = res11.data?.data;
      const round2 = order.rounds?.find((r: any) => r.roundNumber === 2);
      const round2Items = order.items?.filter((it: any) => it.roundNumber === 2);

      const round2Valid =
        round2 &&
        round2.status === 'WaitingConfirmation' &&
        round2.source === 'QR_CUSTOMER' &&
        round2.roundSubTotal === 60000;

      const itemsValid =
        round2Items?.length === 1 &&
        round2Items[0].status === 'WaitingConfirmation' &&
        round2Items[0].quantity === 2;

      // SubTotal mới = 190,000 + 60,000 = 250,000
      const subTotalValid = order.subTotal === 250000;

      if (round2Valid && itemsValid && subTotalValid) {
        pass(
          'TC-6.4-11: Khách gọi thêm món (Round 2) thành công ở trạng thái WaitingConfirmation',
          `Rounds: ${order.rounds.length}, Round 2 SubTotal: ${round2.roundSubTotal}đ, New SubTotal: ${order.subTotal}đ`,
        );
        passed++;
      } else {
        fail(
          'TC-6.4-11: Khách gọi thêm món (Round 2) thành công',
          `round2Valid: ${round2Valid}, itemsValid: ${itemsValid}, subTotalValid: ${subTotalValid}`,
        );
        failed++;
      }
    } else {
      fail('TC-6.4-11: Khách gọi thêm món (Round 2) thành công', res11.data);
      failed++;
    }

    // TC-6.4-12: Khách hàng gọi thêm món bằng cách chỉ định orderId trong path (POST /api/orders/customer/:id/items)
    const addItemsPayloadWithId = {
      restaurantSlug: restASlug,
      tableCode: 'ban-01',
      qrToken: qrTokenT1,
      items: [
        {
          menuItemId: menuItem1Id.toString(),
          quantity: 1, // 65,000
        },
      ],
    };

    const res12 = await request(`/orders/customer/${createdOrder1Id}/items`, {
      method: 'POST',
      body: JSON.stringify(addItemsPayloadWithId),
    });

    if (res12.status === 200) {
      const order = res12.data?.data;
      const round3 = order.rounds?.find((r: any) => r.roundNumber === 3);
      if (
        round3 &&
        round3.status === 'WaitingConfirmation' &&
        round3.roundSubTotal === 65000 &&
        order.subTotal === 315000
      ) {
        pass(
          'TC-6.4-12: Gọi thêm món chỉ định orderId trong path (POST /orders/customer/:id/items) thành công (Round 3)',
          `Round 3 Status: ${round3.status}, Order SubTotal: ${order.subTotal}đ`,
        );
        passed++;
      } else {
        fail('TC-6.4-12: Gọi thêm món chỉ định orderId trong path', JSON.stringify(round3));
        failed++;
      }
    } else {
      fail('TC-6.4-12: Gọi thêm món chỉ định orderId trong path', res12.data);
      failed++;
    }

    // TC-6.4-13: Chặn gọi thêm món nếu chỉ định orderId không thuộc bàn ăn của QR session (HTTP 400)
    const fakeOrderId = new Types.ObjectId().toString();
    const res13 = await request(`/orders/customer/${fakeOrderId}/items`, {
      method: 'POST',
      body: JSON.stringify(addItemsPayloadWithId),
    });
    if (res13.status === 404) {
      pass('TC-6.4-13: Chặn gọi thêm món với orderId không tồn tại (HTTP 404 Not Found)');
      passed++;
    } else {
      fail('TC-6.4-13: Chặn gọi thêm món với orderId không tồn tại', `Status: ${res13.status}`);
      failed++;
    }

    // TC-6.4-14: Test Alias URL (POST /api/orders/public/customer/items) hoạt động đồng nhất
    const res14 = await request('/orders/public/customer/items', {
      method: 'POST',
      body: JSON.stringify({
        ...addItemsPayload,
        items: [
          {
            menuItemId: menuItem2Id.toString(),
            quantity: 1, // 30,000
          },
        ],
      }),
    });
    if (res14.status === 200 && res14.data?.data?.rounds?.length === 4) {
      pass('TC-6.4-14: Alias endpoint /orders/public/customer/items hoạt động chuẩn xác (Round 4)');
      passed++;
    } else {
      fail('TC-6.4-14: Alias endpoint /orders/public/customer/items', res14.data);
      failed++;
    }

    // ========================================================================
    // PHẦN C: KIỂM THỬ TƯƠNG TÁC ĐẦU CUỐI: KHÁCH QR ĐẶT MÓN -> THU NGÂN POS DUYỆT & THANH TOÁN
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN C: KIỂM THỬ TƯƠNG TÁC ĐẦU CUỐI (KHÁCH QR ➔ THU NGÂN POS ➔ BẾP ➔ THANH TOÁN) ---${colors.reset}`);

    // TC-6.4-15: Thu ngân duyệt Round 1 (POST /api/orders/:id/rounds/1/confirm)
    const res15 = await request(`/orders/${createdOrder1Id}/rounds/1/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    if (res15.status === 200) {
      const order = res15.data?.data;
      const r1 = order.rounds?.find((r: any) => r.roundNumber === 1);
      const r1Items = order.items?.filter((it: any) => it.roundNumber === 1);
      const allR1ItemsWaiting = r1Items.every((it: any) => it.status === 'Waiting');

      // Khi Round 1 được duyệt, các món của Round 1 sang 'Waiting', Reducer suy luận order sang 'Preparing'
      if (r1?.status === 'Confirmed' && allR1ItemsWaiting && order.status === 'Preparing') {
        pass(
          'TC-6.4-15: Thu ngân POS duyệt Round 1 thành công (Round 1 = Confirmed, Items = Waiting, Order = Preparing)',
          `Order Status: ${order.status}`,
        );
        passed++;
      } else {
        fail(
          'TC-6.4-15: Thu ngân POS duyệt Round 1 thành công',
          `r1Status: ${r1?.status}, allR1ItemsWaiting: ${allR1ItemsWaiting}, orderStatus: ${order.status}`,
        );
        failed++;
      }
    } else {
      fail('TC-6.4-15: Thu ngân POS duyệt Round 1 thành công', res15.data);
      failed++;
    }

    // TC-6.4-16: Thu ngân POS duyệt tất cả các Round còn lại (Round 2, 3, 4)
    await request(`/orders/${createdOrder1Id}/rounds/2/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    await request(`/orders/${createdOrder1Id}/rounds/3/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    const res16 = await request(`/orders/${createdOrder1Id}/rounds/4/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    if (res16.status === 200) {
      const order = res16.data?.data;
      const allRoundsConfirmed = order.rounds?.every((r: any) => r.status === 'Confirmed');
      if (allRoundsConfirmed) {
        pass('TC-6.4-16: Thu ngân POS duyệt toàn bộ các Round còn lại thành công');
        passed++;
      } else {
        fail('TC-6.4-16: Thu ngân POS duyệt toàn bộ các Round còn lại', 'Không phải tất cả round đều Confirmed');
        failed++;
      }
    } else {
      fail('TC-6.4-16: Thu ngân POS duyệt toàn bộ các Round còn lại', res16.data);
      failed++;
    }

    // TC-6.4-17: Thu ngân thanh toán hóa đơn (POST /api/orders/:id/pay)
    const payRes = await request(`/orders/${createdOrder1Id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        paymentMethod: 'Cash',
        amountReceived: 500000,
      }),
    });

    if (payRes.status === 200) {
      const paidOrder = payRes.data?.data?.order;
      const updatedTable: any = await connection.collection('tables').findOne({ _id: table1Id });

      if (paidOrder?.status === 'Paid' && paidOrder?.isPaid === true && updatedTable?.status === 'Available') {
        pass(
          'TC-6.4-17: Thu ngân thanh toán đơn QR thành công & Bàn ăn được giải phóng sang Available',
          `Order: Paid, Table Status: ${updatedTable.status}`,
        );
        passed++;
      } else {
        fail('TC-6.4-17: Thu ngân thanh toán đơn QR thành công', JSON.stringify(paidOrder));
        failed++;
      }
    } else {
      fail('TC-6.4-17: Thu ngân thanh toán đơn QR thành công', payRes.data);
      failed++;
    }

    // TC-6.4-18: Chặn khách hàng gọi thêm món sau khi đơn đã thanh toán (HTTP 400)
    const res18 = await request(`/orders/customer/${createdOrder1Id}/items`, {
      method: 'POST',
      body: JSON.stringify(addItemsPayloadWithId),
    });
    if (res18.status === 400) {
      pass('TC-6.4-18: Chặn khách gọi thêm món vào đơn đã thanh toán (Paid is Terminal) (HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-6.4-18: Chặn khách gọi thêm món vào đơn đã thanh toán', `Status: ${res18.status}`);
      failed++;
    }

    // TC-6.4-19: Bàn đã Available có thể bắt đầu phiên gọi món QR mới
    const res19 = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-01',
        qrToken: qrTokenT1,
        items: [{ menuItemId: menuItem2Id.toString(), quantity: 1 }],
      }),
    });
    if (res19.status === 201 || res19.status === 200) {
      pass(
        'TC-6.4-19: Bàn sau khi giải phóng có thể bắt đầu phiên gọi món QR mới thành công',
        `Mã đơn mới: ${res19.data?.data?.orderCode}`,
      );
      passed++;
    } else {
      fail('TC-6.4-19: Bàn sau khi giải phóng có thể bắt đầu phiên gọi món QR mới', res19.data);
      failed++;
    }

    // TC-6.4-20: Regression check - POS Cashier tạo đơn trực tiếp tại quầy vẫn hoạt động bình thường
    const posPayload = {
      tableId: table1Id.toString(),
      orderSource: 'STAFF_POS',
      items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }],
    };
    // Vì Bàn 01 đang có đơn từ TC-6.4-19 -> POS tạo đơn sẽ bị Conflict 409
    const posConflictRes = await request('/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'x-restaurant-id': restAId.toString(),
      },
      body: JSON.stringify(posPayload),
    });
    if (posConflictRes.status === 409) {
      pass('TC-6.4-20: POS bảo toàn quy tắc One Active Order per Table (409 Conflict khi bàn đã có đơn)');
      passed++;
    } else {
      fail('TC-6.4-20: POS bảo toàn quy tắc One Active Order per Table', `Status: ${posConflictRes.status}`);
      failed++;
    }
  } catch (err: any) {
    console.error('Unhandled Exception in Test:', err);
    failed++;
  } finally {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Kết quả kiểm thử Sub-phase 6.4: ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : colors.green}${failed} failed${colors.reset}`);
    console.log(`----------------------------------------------------------------\n`);

    console.log('[Teardown] Dọn dẹp tài nguyên kiểm thử Sub-phase 6.4...');
    try {
      await connection.collection('orders').deleteMany({ restaurantId: { $in: [restAId, restBId] } });
      await connection.collection('tables').deleteMany({ restaurantId: { $in: [restAId, restBId] } });
      await connection.collection('table_zones').deleteMany({ restaurantId: { $in: [restAId, restBId] } });
      await connection.collection('menu_items').deleteMany({ restaurantId: { $in: [restAId, restBId] } });
      await connection.collection('menu_categories').deleteMany({ restaurantId: { $in: [restAId, restBId] } });
      await connection.collection('users').deleteMany({ restaurantId: { $in: [restAId, restBId] } });
      await connection.collection('restaurants').deleteMany({ _id: { $in: [restAId, restBId] } });
      console.log(`  ${colors.green}✔ Đã dọn dẹp sạch sẽ toàn bộ dữ liệu kiểm thử (Zero Garbage)${colors.reset}\n`);
    } catch (cleanErr: any) {
      console.error('Lỗi khi dọn dẹp DB:', cleanErr.message);
    }

    if (app) {
      await app.close();
    }

    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
