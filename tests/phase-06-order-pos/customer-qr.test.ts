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
  const zoneBId = new Types.ObjectId();

  const table1Id = new Types.ObjectId();
  const table2Id = new Types.ObjectId();
  const table3InactiveId = new Types.ObjectId();
  const table4RevokedId = new Types.ObjectId();
  const tableItemTestId = new Types.ObjectId();
  const tableB1Id = new Types.ObjectId();

  const menuItem1Id = new Types.ObjectId();
  const menuItem2Id = new Types.ObjectId();
  const menuItemDeletedId = new Types.ObjectId();
  const menuItemBId = new Types.ObjectId();

  const qrTokenT1 = `token-t1-${timestamp}`;
  const qrTokenT2 = `token-t2-${timestamp}`;
  const qrTokenT3 = `token-t3-${timestamp}`;
  const qrTokenT4 = `token-t4-${timestamp}`;
  const qrTokenItemTest = `token-item-test-${timestamp}`;
  const qrTokenTB = `token-tb-${timestamp}`;

  let createdOrder1Id = '';
  let createdOrder2Id = '';
  let createdOrderBId = '';
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

    // 3. Tạo Khu vực bàn
    await connection.collection('table_zones').insertMany([
      {
        _id: zoneAId,
        name: 'Khu vực Tầng 1',
        restaurantId: restAId,
        branchId: branchAId,
        isDeleted: false,
      },
      {
        _id: zoneBId,
        name: 'Khu vực B',
        restaurantId: restBId,
        branchId: branchBId,
        isDeleted: false,
      },
    ]);

    // 4. Tạo Bàn ăn cho Nhà hàng A
    await connection.collection('tables').insertMany([
      // Bàn 1: Active QR
      {
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
      },
      // Bàn 2: Active QR (để test gọi chéo bàn)
      {
        _id: table2Id,
        code: 'ban-02',
        name: 'Bàn 02',
        zone: zoneAId,
        restaurantId: restAId,
        branchId: branchAId,
        status: 'Available',
        qrToken: qrTokenT2,
        qrStatus: 'active',
        isDeleted: false,
      },
      // Bàn 3: Inactive QR
      {
        _id: table3InactiveId,
        code: 'ban-03-inactive',
        name: 'Bàn 03 Inactive',
        zone: zoneAId,
        restaurantId: restAId,
        branchId: branchAId,
        status: 'Available',
        qrToken: qrTokenT3,
        qrStatus: 'inactive',
        isDeleted: false,
      },
      // Bàn 4: Revoked QR
      {
        _id: table4RevokedId,
        code: 'ban-04-revoked',
        name: 'Bàn 04 Revoked',
        zone: zoneAId,
        restaurantId: restAId,
        branchId: branchAId,
        status: 'Available',
        qrToken: qrTokenT4,
        qrStatus: 'revoked',
        isDeleted: false,
      },
      // Bàn kiểm tra Item lỗi (luôn Available, không có active order)
      {
        _id: tableItemTestId,
        code: 'ban-item-test',
        name: 'Bàn Test Items',
        zone: zoneAId,
        restaurantId: restAId,
        branchId: branchAId,
        status: 'Available',
        qrToken: qrTokenItemTest,
        qrStatus: 'active',
        isDeleted: false,
      },
    ]);

    // 5. Tạo Bàn ăn cho Nhà hàng B (Bàn TB-01 có cùng code 'ban-01')
    await connection.collection('tables').insertOne({
      _id: tableB1Id,
      code: 'ban-01',
      name: 'Bàn 01 Nhà Hàng B',
      zone: zoneBId,
      restaurantId: restBId,
      branchId: branchBId,
      status: 'Available',
      qrToken: qrTokenTB,
      qrStatus: 'active',
      isDeleted: false,
    });

    // 6. Tạo Danh mục & Thực đơn
    const catAId = new Types.ObjectId();
    const catBId = new Types.ObjectId();

    await connection.collection('menu_categories').insertMany([
      {
        _id: catAId,
        name: 'Món Chính A',
        slug: 'mon-chinh-a',
        restaurantId: restAId,
        branches: [branchAId],
        isActive: true,
        order: 1,
      },
      {
        _id: catBId,
        name: 'Món Chính B',
        slug: 'mon-chinh-b',
        restaurantId: restBId,
        branches: [branchBId],
        isActive: true,
        order: 1,
      },
    ]);

    await connection.collection('menu_items').insertMany([
      {
        _id: menuItem1Id,
        restaurantId: restAId,
        category: catAId,
        name: 'Phở Bò Đặc Biệt',
        slug: 'pho-bo-dac-biet',
        price: 65000,
        isAvailable: true,
        isDeleted: false,
        options: [
          {
            id: 'opt-meat',
            name: 'Thịt thêm',
            required: false,
            multiple: true,
            values: [
              { id: 'extra-beef', name: 'Bò tái thêm', priceDelta: 15000 },
            ],
          },
        ],
      },
      {
        _id: menuItem2Id,
        restaurantId: restAId,
        category: catAId,
        name: 'Trà Đào Cam Sả',
        slug: 'tra-dao-cam-sa',
        price: 30000,
        isAvailable: true,
        isDeleted: false,
      },
      {
        _id: menuItemDeletedId,
        restaurantId: restAId,
        category: catAId,
        name: 'Món Đã Ngừng Bán',
        slug: 'mon-da-ngung-ban',
        price: 45000,
        isAvailable: true,
        isDeleted: true, // Soft-deleted
      },
      {
        _id: menuItemBId,
        restaurantId: restBId,
        category: catBId,
        name: 'Bún Bò Huế (Nhà Hàng B)',
        slug: 'bun-bo-hue-b',
        price: 70000,
        isAvailable: true,
        isDeleted: false,
      },
    ]);

    // 7. Tạo tài khoản Cashier cho Nhà hàng A để test tương tác POS
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
    // SECTION 1: VALID QR CUSTOMER ORDER CREATION (ITEMS 1, 8, 9, 10, 11)
    // ========================================================================
    console.log(`${colors.bold}--- PHẦN 1: TẠO ĐƠN HÀNG QR CÔNG KHAI (KHÔNG CẦN STAFF JWT) ---${colors.reset}`);

    const validCreatePayload = {
      restaurantSlug: restASlug,
      tableCode: 'ban-01',
      qrToken: qrTokenT1,
      customerNote: 'Khách bàn 01 tự đặt',
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
          note: 'Ít đường',
        },
      ],
    };

    // 1.1: Tạo đơn thành công không cần Bearer JWT (Item 1 & 8)
    const resCreate = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify(validCreatePayload),
    });

    if (resCreate.status === 201 || resCreate.status === 200) {
      const order = resCreate.data?.data;
      createdOrder1Id = order._id;

      // Item 9: Created Order = WaitingConfirmation
      const orderStatusWaiting = order.status === 'WaitingConfirmation';
      // Item 10: Created Round 1 = WaitingConfirmation
      const round1 = order.rounds?.[0];
      const round1Waiting = round1?.status === 'WaitingConfirmation' && round1?.roundNumber === 1 && round1?.source === 'QR_CUSTOMER';
      // Item 11: Created OrderItems = WaitingConfirmation
      const itemsWaiting = order.items?.every((it: any) => it.status === 'WaitingConfirmation');

      // Giá món: (65,000 + 15,000) * 2 + 30,000 * 1 = 190,000 đ
      const expectedSubTotal = (65000 + 15000) * 2 + 30000;
      const subTotalCorrect = order.subTotal === expectedSubTotal && order.totalAmount === expectedSubTotal;

      if (orderStatusWaiting && round1Waiting && itemsWaiting && subTotalCorrect) {
        pass('TC-01: Tạo đơn hàng QR thành công không cần Staff JWT (Mục 1, 8)');
        pass('TC-02: Created Order = WaitingConfirmation (Mục 9)', `Status: ${order.status}`);
        pass('TC-03: Created Round 1 = WaitingConfirmation, source = QR_CUSTOMER (Mục 10)', `Round status: ${round1.status}`);
        pass('TC-04: Created OrderItems = WaitingConfirmation (Mục 11)', `All items: WaitingConfirmation`);
        pass('TC-05: Price snapshot DB chính xác bao gồm option priceDelta', `Subtotal: ${order.subTotal}đ`);
        passed += 5;
      } else {
        fail('TC-01..05: Tạo đơn hàng QR thành công', JSON.stringify(order));
        failed += 5;
      }
    } else {
      fail('TC-01..05: Tạo đơn hàng QR thành công', resCreate.data);
      failed += 5;
    }

    // 1.2: Bàn ăn tự động Occupied
    const table1InDb: any = await connection.collection('tables').findOne({ _id: table1Id });
    if (table1InDb?.status === 'Occupied' && table1InDb?.currentOrderId?.toString() === createdOrder1Id) {
      pass('TC-06: Bàn 01 chuyển trạng thái sang Occupied và gắn currentOrderId');
      passed++;
    } else {
      fail('TC-06: Bàn 01 chuyển trạng thái sang Occupied', JSON.stringify(table1InDb));
      failed++;
    }

    // 1.3: Chặn tạo trùng Active Order trên cùng bàn (Partial Unique Index Protection)
    const resDup = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify(validCreatePayload),
    });
    if (resDup.status === 409) {
      pass('TC-07: Chặn tạo đơn mới khi bàn đang có đơn hoạt động (409 Conflict)');
      passed++;
    } else {
      fail('TC-07: Chặn tạo đơn mới khi bàn đang có đơn hoạt động', `Status: ${resDup.status}`);
      failed++;
    }

    // 1.4: Alias route (POST /api/orders/public/customer)
    // Tạo đơn cho Bàn 2 qua alias route
    const resAlias = await request('/orders/public/customer', {
      method: 'POST',
      body: JSON.stringify({
        ...validCreatePayload,
        tableCode: 'ban-02',
        qrToken: qrTokenT2,
        items: [{ menuItemId: menuItem2Id.toString(), quantity: 1 }],
      }),
    });
    if (resAlias.status === 201 || resAlias.status === 200) {
      createdOrder2Id = resAlias.data?.data?._id;
      pass('TC-08: Alias endpoint /orders/public/customer hoạt động chuẩn xác', `Order 2: ${resAlias.data?.data?.orderCode}`);
      passed++;
    } else {
      fail('TC-08: Alias endpoint /orders/public/customer', resAlias.data);
      failed++;
    }

    // ========================================================================
    // SECTION 2: NEGATIVE & SECURITY TESTS (ITEMS 2, 3, 4, 5, 6, 7, 18)
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 2: BẢO MẬT & CÁC TRƯỜNG HỢP BIÊN TIÊU CỰC (NEGATIVE & SECURITY TESTS) ---${colors.reset}`);

    // 2.1: Missing QR credentials (Mục negative: missing credentials)
    const resMissSlug = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({ tableCode: 'ban-01', qrToken: qrTokenT1, items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }] }),
    });
    const resMissCode = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({ restaurantSlug: restASlug, qrToken: qrTokenT1, items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }] }),
    });
    const resMissToken = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({ restaurantSlug: restASlug, tableCode: 'ban-01', items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }] }),
    });

    if (resMissSlug.status === 400 && resMissCode.status === 400 && resMissToken.status === 400) {
      pass('TC-09: Chặn tạo đơn khi thiếu thông tin xác thực QR (Missing Slug/Code/Token -> HTTP 400)');
      passed++;
    } else {
      fail('TC-09: Chặn tạo đơn khi thiếu thông tin xác thực QR', `Statuses: ${resMissSlug.status}, ${resMissCode.status}, ${resMissToken.status}`);
      failed++;
    }

    // 2.2: Malformed QR credentials (Mục negative: malformed credentials)
    const resEmptySlug = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({ restaurantSlug: '   ', tableCode: 'ban-01', qrToken: qrTokenT1, items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }] }),
    });
    const resEmptyCode = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({ restaurantSlug: restASlug, tableCode: '', qrToken: qrTokenT1, items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }] }),
    });
    if ((resEmptySlug.status === 400 || resEmptySlug.status === 404) && resEmptyCode.status === 400) {
      pass('TC-10: Chặn tạo đơn với định danh QR bị rỗng hoặc chuỗi trắng (Malformed Credentials -> HTTP 400)');
      passed++;
    } else {
      fail('TC-10: Chặn tạo đơn với định danh QR bị rỗng', `Statuses: ${resEmptySlug.status}, ${resEmptyCode.status}`);
      failed++;
    }

    // 2.3: Invalid restaurantSlug (Item 2)
    const resInvSlug = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({ ...validCreatePayload, restaurantSlug: 'nha-hang-khong-ton-tai-xyz' }),
    });
    if (resInvSlug.status === 404) {
      pass('TC-11: Chặn khi restaurantSlug không tồn tại (Mục 2 -> HTTP 404 Not Found)');
      passed++;
    } else {
      fail('TC-11: Chặn khi restaurantSlug không tồn tại', `Status: ${resInvSlug.status}`);
      failed++;
    }

    // 2.4: Invalid tableCode (Item 3)
    const resInvCode = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({ ...validCreatePayload, tableCode: 'ban-khong-co-that' }),
    });
    if (resInvCode.status === 404) {
      pass('TC-12: Chặn khi tableCode không tồn tại trong nhà hàng (Mục 3 -> HTTP 404 Not Found)');
      passed++;
    } else {
      fail('TC-12: Chặn khi tableCode không tồn tại', `Status: ${resInvCode.status}`);
      failed++;
    }

    // 2.5: Invalid qrToken (Item 4)
    const resInvToken = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({ ...validCreatePayload, qrToken: 'token-sai-lech-999' }),
    });
    if (resInvToken.status === 400) {
      pass('TC-13: Chặn khi qrToken không khớp với bàn (Mục 4 -> HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-13: Chặn khi qrToken không khớp', `Status: ${resInvToken.status}`);
      failed++;
    }

    // 2.6: restaurant/table/token mismatch (Item 5)
    // Gửi tableCode của Bàn 1 nhưng qrToken của Bàn 2
    const resMismatchToken = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({ ...validCreatePayload, tableCode: 'ban-01', qrToken: qrTokenT2 }),
    });
    if (resMismatchToken.status === 400) {
      pass('TC-14: Chặn khi tableCode và qrToken không tương thích (Mục 5 -> HTTP 400)');
      passed++;
    } else {
      fail('TC-14: Chặn khi tableCode và qrToken không tương thích', `Status: ${resMismatchToken.status}`);
      failed++;
    }

    // 2.7: Inactive QR rejection (Item 6)
    const resInactive = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        ...validCreatePayload,
        tableCode: 'ban-03-inactive',
        qrToken: qrTokenT3,
      }),
    });
    if (resInactive.status === 400) {
      pass('TC-15: Chặn tạo đơn khi mã QR của bàn ở trạng thái INACTIVE (Mục 6 -> HTTP 400)');
      passed++;
    } else {
      fail('TC-15: Chặn tạo đơn khi QR INACTIVE', `Status: ${resInactive.status}`);
      failed++;
    }

    // 2.8: Revoked QR rejection (Item 6 mở rộng)
    const resRevoked = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        ...validCreatePayload,
        tableCode: 'ban-04-revoked',
        qrToken: qrTokenT4,
      }),
    });
    if (resRevoked.status === 400) {
      pass('TC-16: Chặn tạo đơn khi mã QR của bàn đã bị thu hồi REVOKED (Mục 6 -> HTTP 400)');
      passed++;
    } else {
      fail('TC-16: Chặn tạo đơn khi QR REVOKED', `Status: ${resRevoked.status}`);
      failed++;
    }

    // 2.9: Cross-restaurant isolation (Item 7 & Mục cross-tenant)
    // Bàn 'ban-01' thuộc Nhà hàng B nhưng gửi kèm slug của Nhà hàng A
    const resCrossRest = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-01',
        qrToken: qrTokenTB, // Token của Nhà hàng B
        items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }],
      }),
    });
    if (resCrossRest.status === 400 || resCrossRest.status === 404) {
      pass('TC-17: Phân lập đa người thuê - Chặn tấn công Cross-Restaurant (Mục 7 -> HTTP 400/404)');
      passed++;
    } else {
      fail('TC-17: Phân lập đa người thuê - Chặn Cross-Restaurant', `Status: ${resCrossRest.status}`);
      failed++;
    }

    // 2.10: Invalid item/menu references rejection (Item 18)
    const itemTestPayload = {
      restaurantSlug: restASlug,
      tableCode: 'ban-item-test',
      qrToken: qrTokenItemTest,
    };

    // Món không tồn tại
    const resNonExistItem = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        ...itemTestPayload,
        items: [{ menuItemId: new Types.ObjectId().toString(), quantity: 1 }],
      }),
    });
    // Món thuộc Nhà hàng B nhưng gọi ở Nhà hàng A (Cross-restaurant menu item)
    const resCrossItem = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        ...itemTestPayload,
        items: [{ menuItemId: menuItemBId.toString(), quantity: 1 }],
      }),
    });
    // Món đã bị xóa (Soft-deleted isDeleted: true)
    const resDeletedItem = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        ...itemTestPayload,
        items: [{ menuItemId: menuItemDeletedId.toString(), quantity: 1 }],
      }),
    });
    // Món có ID định dạng sai (malformed string)
    const resMalformedItem = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        ...itemTestPayload,
        items: [{ menuItemId: 'not-a-valid-object-id', quantity: 1 }],
      }),
    });
    // Mảng items rỗng
    const resEmptyItems = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({ ...itemTestPayload, items: [] }),
    });

    if (
      resNonExistItem.status === 404 &&
      resCrossItem.status === 404 &&
      resDeletedItem.status === 404 &&
      resMalformedItem.status === 404 &&
      resEmptyItems.status === 400
    ) {
      pass('TC-18: Từ chối món ăn không tồn tại, món nhà hàng khác, món đã xóa hoặc ID sai định dạng (Mục 18 -> HTTP 404/400)');
      passed++;
    } else {
      fail(
        'TC-18: Từ chối món ăn không hợp lệ',
        `nonExist: ${resNonExistItem.status}, cross: ${resCrossItem.status}, deleted: ${resDeletedItem.status}, malformed: ${resMalformedItem.status}, empty: ${resEmptyItems.status}`,
      );
      failed++;
    }

    // ========================================================================
    // SECTION 3: CUSTOMER ADD-ITEMS BOUNDARY (ITEMS 12, 13, 14, 15, 16)
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 3: KHÁCH HÀNG GỌI THÊM MÓN & QUẢN LÝ ĐỢT GỌI (ADD-ITEMS & ROUNDS) ---${colors.reset}`);

    // Snapshot lại trạng thái Round 1 và Items của Order 1 trước khi gọi thêm
    const order1BeforeAdd: any = await connection.collection('orders').findOne({ _id: new Types.ObjectId(createdOrder1Id) });
    const round1Before = JSON.stringify(order1BeforeAdd.rounds[0]);
    const items1Before = JSON.stringify(order1BeforeAdd.items);

    // 3.1: Gọi thêm món qua POST /api/orders/customer/items không cần staff JWT (Item 12, 13)
    const addPayload = {
      restaurantSlug: restASlug,
      tableCode: 'ban-01',
      qrToken: qrTokenT1,
      note: 'Giao nhanh giúp em',
      items: [
        {
          menuItemId: menuItem2Id.toString(),
          quantity: 2, // 30,000 * 2 = 60,000 đ
          note: 'Không đá',
        },
      ],
    };

    const resAddRound2 = await request('/orders/customer/items', {
      method: 'POST',
      body: JSON.stringify(addPayload),
    });

    if (resAddRound2.status === 200) {
      const order = resAddRound2.data?.data;
      const round2 = order.rounds?.find((r: any) => r.roundNumber === 2);
      const round2Items = order.items?.filter((it: any) => it.roundNumber === 2);

      // Item 13: Creates a new OrderRound
      const hasRound2 = order.rounds?.length === 2 && !!round2;
      // Item 14: New round = WaitingConfirmation
      const round2Waiting = round2?.status === 'WaitingConfirmation' && round2?.source === 'QR_CUSTOMER';
      // Item 15: New items = WaitingConfirmation
      const round2ItemsWaiting = round2Items?.length === 1 && round2Items[0].status === 'WaitingConfirmation';
      // Item 16: Existing rounds/items remain unchanged
      const round1After = JSON.stringify(order.rounds[0]);
      const items1After = JSON.stringify(order.items.slice(0, 2));
      const previousUnchanged = round1Before === round1After && items1Before === items1After;

      // SubTotal mới: 190,000 + 60,000 = 250,000 đ
      const subTotalUpdated = order.subTotal === 250000;

      if (hasRound2 && round2Waiting && round2ItemsWaiting && previousUnchanged && subTotalUpdated) {
        pass('TC-19: Khách gọi thêm món thành công với QR hợp lệ (Mục 12)');
        pass('TC-20: Gọi thêm món tạo Round 2 mới thành công (Mục 13)', `Total rounds: ${order.rounds.length}`);
        pass('TC-21: Round 2 = WaitingConfirmation (Mục 14)', `Round 2 status: ${round2.status}`);
        pass('TC-22: Các món mới thêm = WaitingConfirmation (Mục 15)', `Items count: ${round2Items.length}`);
        pass('TC-23: Các Round và Món trước đó được bảo toàn bất biến (Mục 16)', 'Round 1 & Items 1 unchanged');
        pass('TC-24: Tổng tiền hóa đơn được tính toán lũy kế chính xác', `New subTotal: ${order.subTotal}đ`);
        passed += 6;
      } else {
        fail(
          'TC-19..24: Khách gọi thêm món thành công',
          `hasRound2: ${hasRound2}, round2Waiting: ${round2Waiting}, round2ItemsWaiting: ${round2ItemsWaiting}, previousUnchanged: ${previousUnchanged}, subTotalUpdated: ${subTotalUpdated}`,
        );
        failed += 6;
      }
    } else {
      fail('TC-19..24: Khách gọi thêm món thành công', resAddRound2.data);
      failed += 6;
    }

    // 3.2: Gọi thêm món qua POST /api/orders/customer/:id/items (Round 3)
    const resAddRound3 = await request(`/orders/customer/${createdOrder1Id}/items`, {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-01',
        qrToken: qrTokenT1,
        items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }], // +65,000 -> 315,000 đ
      }),
    });

    if (resAddRound3.status === 200 && resAddRound3.data?.data?.rounds?.length === 3) {
      pass('TC-25: Gọi thêm món theo ID đơn trong path (POST /orders/customer/:id/items) tạo Round 3 thành công');
      passed++;
    } else {
      fail('TC-25: Gọi thêm món theo ID đơn trong path', resAddRound3.data);
      passed++;
    }

    // ========================================================================
    // SECTION 4: SECURITY TESTS FOR ADD-ITEMS (ANOTHER TABLE & CROSS-TENANT)
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 4: KIỂM THỬ BẢO MẬT GỌI THÊM MÓN (CROSS-TABLE & CROSS-TENANT) ---${colors.reset}`);

    // 4.1: Attempting to operate on another table (Mục security: another table)
    // Khách có QR của Bàn 1 (tableCode: ban-01, qrTokenT1) nhưng cố ý thêm món vào Order 2 của Bàn 2
    const resOperateAnotherTable = await request(`/orders/customer/${createdOrder2Id}/items`, {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-01',
        qrToken: qrTokenT1,
        items: [{ menuItemId: menuItem2Id.toString(), quantity: 1 }],
      }),
    });

    if (resOperateAnotherTable.status === 404) {
      pass(
        'TC-26: Chặn thao tác thêm món vào đơn của bàn khác (F-02: Unified HTTP 404 Not Found chống Oracle lộ danh tính)',
        resOperateAnotherTable.data?.message,
      );
      passed++;
    } else {
      fail('TC-26: Chặn thao tác thêm món vào đơn của bàn khác', `Status: ${resOperateAnotherTable.status}`);
      failed++;
    }

    // 4.2: Attempting to operate on an order of another restaurant (Mục security: cross-tenant access)
    // Tạo đơn tại Nhà hàng B
    const createOrderBRes = await connection.collection('orders').insertOne({
      orderCode: `ORD-RESTB-${timestamp}`,
      restaurantId: restBId,
      branchId: branchBId,
      tableId: tableB1Id,
      tableName: 'Bàn 01 Nhà Hàng B',
      status: 'WaitingConfirmation',
      orderSource: 'QR_CUSTOMER',
      rounds: [],
      items: [],
      subTotal: 70000,
      totalAmount: 70000,
      isPaid: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    createdOrderBId = createOrderBRes.insertedId.toString();

    // Khách ở Nhà hàng A gửi QR Nhà hàng A nhưng truyền ID đơn của Nhà hàng B
    const resOperateCrossTenant = await request(`/orders/customer/${createdOrderBId}/items`, {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-01',
        qrToken: qrTokenT1,
        items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }],
      }),
    });

    if (resOperateCrossTenant.status === 404) {
      pass('TC-27: Chặn thao tác thêm món vào đơn của nhà hàng khác (Security: Cross-Tenant -> HTTP 404 Not Found)');
      passed++;
    } else {
      fail('TC-27: Chặn thao tác thêm món vào đơn của nhà hàng khác', `Status: ${resOperateCrossTenant.status}`);
      failed++;
    }

    // 4.3: Attempting to operate on an order with arbitrary invalid orderId in path
    const resArbitraryId = await request(`/orders/customer/${new Types.ObjectId().toString()}/items`, {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-01',
        qrToken: qrTokenT1,
        items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }],
      }),
    });
    if (resArbitraryId.status === 404) {
      pass('TC-28: Chặn thêm món khi orderId không thuộc danh tính QR (HTTP 404 Not Found)');
      passed++;
    } else {
      fail('TC-28: Chặn thêm món khi orderId không thuộc danh tính QR', `Status: ${resArbitraryId.status}`);
      failed++;
    }

    // ========================================================================
    // SECTION 5: IMMUTABLE PRICE SNAPSHOT VERIFICATION (ITEM 17)
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 5: BẢO TOÀN BẤT BIẾN SNAPSHOT GIÁ (IMMUTABLE PRICE SNAPSHOTS) ---${colors.reset}`);

    // Thay đổi giá món trong Database thực đơn (ví dụ tăng giá Phở từ 65k lên 999k)
    await connection.collection('menu_items').updateOne(
      { _id: menuItem1Id },
      { $set: { price: 999000, name: 'Phở Bò Đổi Giá Siêu Đắt' } },
    );

    // Lấy lại Order 1 từ Database
    const order1SnapshotCheck: any = await connection.collection('orders').findOne({ _id: new Types.ObjectId(createdOrder1Id) });
    const phoItem = order1SnapshotCheck.items.find((it: any) => it.menuItemId.toString() === menuItem1Id.toString());

    // Giá lưu trong Order 1 phải giữ nguyên snapshot cũ (65,000 đ), không bị đội lên 999,000 đ
    if (phoItem && phoItem.price === 65000 && order1SnapshotCheck.subTotal === 315000) {
      pass(
        'TC-29: Snapshot giá hoàn toàn bất biến khi giá gốc trong thực đơn bị thay đổi (Mục 17)',
        `Giá gốc đổi thành 999k, giá trong đơn vẫn giữ ${phoItem.price}đ, subTotal: ${order1SnapshotCheck.subTotal}đ`,
      );
      passed++;
    } else {
      fail('TC-29: Snapshot giá hoàn toàn bất biến', `Current price in order: ${phoItem?.price}`);
      failed++;
    }

    // Khôi phục lại giá gốc cho các test tiếp theo
    await connection.collection('menu_items').updateOne(
      { _id: menuItem1Id },
      { $set: { price: 65000, name: 'Phở Bò Đặc Biệt' } },
    );

    // ========================================================================
    // SECTION 6: GET ACTIVE ORDER BY QR QUERY
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 6: TRA CỨU ĐƠN HÀNG HOẠT ĐỘNG CỦA BÀN QUA QR ---${colors.reset}`);

    const resGetActive = await request(
      `/orders/customer/active?restaurantSlug=${restASlug}&tableCode=ban-01&qrToken=${qrTokenT1}`,
    );
    if (resGetActive.status === 200 && resGetActive.data?.data?._id === createdOrder1Id) {
      pass('TC-30: Khách hàng tra cứu đơn hàng hoạt động của bàn qua mã QR thành công không cần JWT');
      passed++;
    } else {
      fail('TC-30: Khách hàng tra cứu đơn hàng hoạt động qua mã QR', resGetActive.data);
      failed++;
    }

    // ========================================================================
    // SECTION 7: POS CASHIER LIFECYCLE INTERACTION & TERMINAL STATE LOCKS
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 7: TƯƠNG TÁC THU NGÂN POS & KHÓA CHẶT TERMINAL STATES ---${colors.reset}`);

    // 7.1: Thu ngân POS duyệt Round 1
    const resConfirmR1 = await request(`/orders/${createdOrder1Id}/rounds/1/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    if (resConfirmR1.status === 200) {
      const order = resConfirmR1.data?.data;
      const r1 = order.rounds?.find((r: any) => r.roundNumber === 1);
      const r1ItemsWaiting = order.items?.filter((it: any) => it.roundNumber === 1).every((it: any) => it.status === 'Waiting');
      if (r1?.status === 'Confirmed' && r1ItemsWaiting && order.status === 'Preparing') {
        pass('TC-31: Thu ngân POS duyệt Round 1 thành công (Round 1 = Confirmed, Items = Waiting, Order = Preparing)');
        passed++;
      } else {
        fail('TC-31: Thu ngân POS duyệt Round 1 thành công', JSON.stringify(r1));
        failed++;
      }
    } else {
      fail('TC-31: Thu ngân POS duyệt Round 1 thành công', resConfirmR1.data);
      failed++;
    }

    // 7.2: Thu ngân POS duyệt Round 2 và Round 3
    await request(`/orders/${createdOrder1Id}/rounds/2/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    await request(`/orders/${createdOrder1Id}/rounds/3/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    // 7.3: Thu ngân thanh toán đơn (POST /api/orders/:id/pay)
    const resPay = await request(`/orders/${createdOrder1Id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash', amountReceived: 500000 }),
    });

    if (resPay.status === 200) {
      const paidOrder = resPay.data?.data?.order;
      const freedTable: any = await connection.collection('tables').findOne({ _id: table1Id });
      if (paidOrder?.status === 'Paid' && paidOrder?.isPaid === true && freedTable?.status === 'Available') {
        pass('TC-32: Thu ngân thanh toán đơn QR thành công & Bàn 01 giải phóng Available');
        passed++;
      } else {
        fail('TC-32: Thu ngân thanh toán đơn QR thành công', JSON.stringify(paidOrder));
        failed++;
      }
    } else {
      fail('TC-32: Thu ngân thanh toán đơn QR thành công', resPay.data);
      failed++;
    }

    // 7.4: Chặn khách hàng thêm món vào đơn đã thanh toán (Paid is Terminal)
    const resAddPaid = await request(`/orders/customer/${createdOrder1Id}/items`, {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-01',
        qrToken: qrTokenT1,
        items: [{ menuItemId: menuItem2Id.toString(), quantity: 1 }],
      }),
    });
    if (resAddPaid.status === 400) {
      pass('TC-33: Chặn khách gọi thêm món vào đơn đã thanh toán (Paid is Terminal -> HTTP 400)');
      passed++;
    } else {
      fail('TC-33: Chặn khách gọi thêm món vào đơn đã thanh toán', `Status: ${resAddPaid.status}`);
      failed++;
    }

    // 7.5: Chặn khách hàng thêm món vào đơn đã hủy (Cancelled is Terminal)
    // Cập nhật Order 2 của Bàn 2 sang Cancelled trong Database
    await connection.collection('orders').updateOne(
      { _id: new Types.ObjectId(createdOrder2Id) },
      { $set: { status: 'Cancelled' } },
    );
    const resAddCancelled = await request(`/orders/customer/${createdOrder2Id}/items`, {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-02',
        qrToken: qrTokenT2,
        items: [{ menuItemId: menuItem2Id.toString(), quantity: 1 }],
      }),
    });
    if (resAddCancelled.status === 400) {
      pass('TC-34: Chặn khách gọi thêm món vào đơn đã hủy (Cancelled is Terminal -> HTTP 400)');
      passed++;
    } else {
      fail('TC-34: Chặn khách gọi thêm món vào đơn đã hủy', `Status: ${resAddCancelled.status}`);
      failed++;
    }

    // ========================================================================
    // SECTION 8: REGRESSION CHECK - EXISTING POS ORDER CREATION (ITEM 19)
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 8: KIỂM THỬ HỒI QUY - TẠO ĐƠN TẠI QUẦY POS (MỤC 19) ---${colors.reset}`);

    // Bàn 1 hiện đã Available -> Thu ngân tạo đơn trực tiếp tại quầy POS với Staff JWT
    const posPayload = {
      tableId: table1Id.toString(),
      orderSource: 'STAFF_POS',
      items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }],
    };

    const resPosCreate = await request('/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'x-restaurant-id': restAId.toString(),
      },
      body: JSON.stringify(posPayload),
    });

    if (resPosCreate.status === 201 || resPosCreate.status === 200) {
      const posOrder = resPosCreate.data?.data;
      const isPreparing = posOrder?.status === 'Preparing';
      const round1Confirmed = posOrder?.rounds?.[0]?.status === 'Confirmed' && posOrder?.rounds?.[0]?.source === 'STAFF_POS';
      const itemsWaiting = posOrder?.items?.[0]?.status === 'Waiting';

      if (isPreparing && round1Confirmed && itemsWaiting) {
        pass(
          'TC-35: POS tạo đơn trực tiếp tại quầy hoạt động chuẩn xác (Order = Preparing, Round 1 = Confirmed, Items = Waiting) (Mục 19)',
          `Order: ${posOrder.orderCode}`,
        );
        passed++;
      } else {
        fail('TC-35: POS tạo đơn trực tiếp tại quầy', JSON.stringify(posOrder));
        failed++;
      }
    } else {
      fail('TC-35: POS tạo đơn trực tiếp tại quầy', resPosCreate.data);
      failed++;
    }

    // ========================================================================
    // SECTION 9: HARDENING TESTS FOR 4 OPEN AUDIT FINDINGS (F-01, F-02, F-03, F-04)
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 9: KIỂM THỬ HARDENING 4 OPEN FINDINGS (F-01, F-02, F-03, F-04) ---${colors.reset}`);

    // H-01.1 (F-01): Chặn client gửi priceDelta âm
    const resNegativePriceDelta = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-02',
        qrToken: qrTokenT2,
        items: [
          {
            menuItemId: menuItem1Id.toString(),
            quantity: 1,
            selectedOptions: [
              {
                groupId: 'opt-meat',
                groupName: 'Thịt thêm',
                valueId: 'extra-beef',
                valueName: 'Bò tái thêm',
                priceDelta: -15000,
              },
            ],
          },
        ],
      }),
    });
    if (resNegativePriceDelta.status === 400) {
      pass('TC-H01.1: Chặn client gửi priceDelta âm (F-01 Price Integrity -> HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-H01.1: Chặn client gửi priceDelta âm', `Status: ${resNegativePriceDelta.status}`);
      failed++;
    }

    // H-01.2 (F-01): Chặn client gửi priceDelta sai lệch so với DB (VD gửi 0đ cho topping 15,000đ)
    const resTamperedPriceDelta = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-02',
        qrToken: qrTokenT2,
        items: [
          {
            menuItemId: menuItem1Id.toString(),
            quantity: 1,
            selectedOptions: [
              {
                groupId: 'opt-meat',
                groupName: 'Thịt thêm',
                valueId: 'extra-beef',
                valueName: 'Bò tái thêm',
                priceDelta: 0,
              },
            ],
          },
        ],
      }),
    });
    if (resTamperedPriceDelta.status === 400) {
      pass('TC-H01.2: Chặn client gửi priceDelta sai lệch so với DB (F-01 Price Integrity -> HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-H01.2: Chặn client gửi priceDelta sai lệch so với DB', `Status: ${resTamperedPriceDelta.status}`);
      failed++;
    }

    // H-01.3 (F-01): Chặn client gửi nhóm tùy chọn không tồn tại (Fake option group)
    const resFakeGroup = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-02',
        qrToken: qrTokenT2,
        items: [
          {
            menuItemId: menuItem1Id.toString(),
            quantity: 1,
            selectedOptions: [
              {
                groupId: 'fake-group',
                groupName: 'Nhóm giả',
                valueId: 'extra-beef',
                valueName: 'Bò tái thêm',
                priceDelta: 15000,
              },
            ],
          },
        ],
      }),
    });
    if (resFakeGroup.status === 400) {
      pass('TC-H01.3: Chặn client gửi nhóm tùy chọn không tồn tại trong DB (F-01 Price Integrity -> HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-H01.3: Chặn client gửi nhóm tùy chọn không tồn tại', `Status: ${resFakeGroup.status}`);
      failed++;
    }

    // H-01.4 (F-01): Chặn client gửi giá trị tùy chọn không tồn tại (Fake option value)
    const resFakeValue = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-02',
        qrToken: qrTokenT2,
        items: [
          {
            menuItemId: menuItem1Id.toString(),
            quantity: 1,
            selectedOptions: [
              {
                groupId: 'opt-meat',
                groupName: 'Thịt thêm',
                valueId: 'fake-value',
                valueName: 'Giá trị giả',
                priceDelta: 15000,
              },
            ],
          },
        ],
      }),
    });
    if (resFakeValue.status === 400) {
      pass('TC-H01.4: Chặn client gửi giá trị tùy chọn không tồn tại trong DB (F-01 Price Integrity -> HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-H01.4: Chặn client gửi giá trị tùy chọn không tồn tại', `Status: ${resFakeValue.status}`);
      failed++;
    }

    // H-01.5 (F-01): Chặn client gửi tùy chọn cho món không có tùy chọn nào (menuItem2 Trà đào)
    const resOptionOnNoOptionItem = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-02',
        qrToken: qrTokenT2,
        items: [
          {
            menuItemId: menuItem2Id.toString(),
            quantity: 1,
            selectedOptions: [
              {
                groupId: 'opt-meat',
                groupName: 'Thịt thêm',
                valueId: 'extra-beef',
                valueName: 'Bò tái thêm',
                priceDelta: 15000,
              },
            ],
          },
        ],
      }),
    });
    if (resOptionOnNoOptionItem.status === 400) {
      pass('TC-H01.5: Chặn client gửi tùy chọn cho món không có tùy chọn (F-01 Price Integrity -> HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-H01.5: Chặn client gửi tùy chọn cho món không có tùy chọn', `Status: ${resOptionOnNoOptionItem.status}`);
      failed++;
    }

    // H-03 (F-03): Chặn số lượng món là số thực / số thập phân (quantity: 1.5)
    const resFractionalQty = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-02',
        qrToken: qrTokenT2,
        items: [{ menuItemId: menuItem1Id.toString(), quantity: 1.5 }],
      }),
    });
    if (resFractionalQty.status === 400) {
      pass('TC-H03: Chặn số lượng món là số thập phân (F-03 Quantity Validation -> HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-H03: Chặn số lượng món là số thập phân', `Status: ${resFractionalQty.status}`);
      failed++;
    }

    // H-04.1 (F-04): Chặn mảng items rỗng ở DTO tạo đơn (CustomerCreateOrderDto items: [])
    const resEmptyItemsCreate = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-02',
        qrToken: qrTokenT2,
        items: [],
      }),
    });
    if (resEmptyItemsCreate.status === 400) {
      pass('TC-H04.1: Chặn mảng items rỗng tại DTO tạo đơn (F-04 ArrayNotEmpty -> HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-H04.1: Chặn mảng items rỗng tại DTO tạo đơn', `Status: ${resEmptyItemsCreate.status}`);
      failed++;
    }

    // H-04.2 (F-04): Chặn mảng items rỗng ở DTO gọi thêm món (CustomerAddItemsDto items: [])
    const resEmptyItemsAdd = await request('/orders/customer/items', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-02',
        qrToken: qrTokenT2,
        items: [],
      }),
    });
    if (resEmptyItemsAdd.status === 400) {
      pass('TC-H04.2: Chặn mảng items rỗng tại DTO gọi thêm món (F-04 ArrayNotEmpty -> HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-H04.2: Chặn mảng items rỗng tại DTO gọi thêm món', `Status: ${resEmptyItemsAdd.status}`);
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
