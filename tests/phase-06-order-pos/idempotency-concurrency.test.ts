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

const TEST_PORT = 3098;
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
  return { status: res.status, headers: res.headers, data };
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  iMenu API - Sub-phase 6.5: Idempotency Key & Concurrency Test Suite   ${colors.reset}`);
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

  // Đảm bảo các chỉ mục (Unique & Partial Unique Index) được tạo đầy đủ trên MongoDB
  await connection.model('Order').syncIndexes();
  await connection.model('IdempotencyKey').syncIndexes();

  await app.listen(TEST_PORT);
  console.log('Test server đã sẵn sàng!\n');

  const timestamp = Date.now();
  const restSlug = `rest-occ-${timestamp}`;
  const restId = new Types.ObjectId();
  const branchId = 'branch-occ-main';
  const zoneId = new Types.ObjectId();

  const table1Id = new Types.ObjectId();
  const table2Id = new Types.ObjectId();
  const table3Id = new Types.ObjectId();
  const table4Id = new Types.ObjectId();
  const table5Id = new Types.ObjectId();

  const menuItem1Id = new Types.ObjectId();
  const menuItem2Id = new Types.ObjectId();

  const qrTokenT1 = `token-t1-${timestamp}`;
  const qrTokenT2 = `token-t2-${timestamp}`;
  const qrTokenT3 = `token-t3-${timestamp}`;
  const qrTokenT4 = `token-t4-${timestamp}`;
  const qrTokenT5 = `token-t5-${timestamp}`;

  try {
    // 1. Tạo Nhà hàng kiểm thử
    await connection.collection('restaurants').insertOne({
      _id: restId,
      name: 'Nhà Hàng Concurrency & Idempotency',
      slug: restSlug,
      email: `rest_${timestamp}@test.com`,
      phone: '0901234567',
      status: 'Active',
      branches: [
        {
          _id: branchId,
          name: 'Chi Nhánh OCC',
          isMainBranch: true,
          status: 'Active',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Tạo Khu vực bàn
    await connection.collection('table_zones').insertOne({
      _id: zoneId,
      name: 'Khu vực Tầng 1',
      restaurantId: restId,
      branchId,
      isDeleted: false,
    });

    // 3. Tạo Bàn ăn
    await connection.collection('tables').insertMany([
      {
        _id: table1Id,
        code: 'ban-01',
        name: 'Bàn 01',
        zone: zoneId,
        restaurantId: restId,
        branchId,
        status: 'Available',
        qrToken: qrTokenT1,
        qrStatus: 'active',
        isDeleted: false,
      },
      {
        _id: table2Id,
        code: 'ban-02',
        name: 'Bàn 02',
        zone: zoneId,
        restaurantId: restId,
        branchId,
        status: 'Available',
        qrToken: qrTokenT2,
        qrStatus: 'active',
        isDeleted: false,
      },
      {
        _id: table3Id,
        code: 'ban-03',
        name: 'Bàn 03',
        zone: zoneId,
        restaurantId: restId,
        branchId,
        status: 'Available',
        qrToken: qrTokenT3,
        qrStatus: 'active',
        isDeleted: false,
      },
      {
        _id: table4Id,
        code: 'ban-04',
        name: 'Bàn 04',
        zone: zoneId,
        restaurantId: restId,
        branchId,
        status: 'Available',
        qrToken: qrTokenT4,
        qrStatus: 'active',
        isDeleted: false,
      },
      {
        _id: table5Id,
        code: 'ban-05',
        name: 'Bàn 05',
        zone: zoneId,
        restaurantId: restId,
        branchId,
        status: 'Available',
        qrToken: qrTokenT5,
        qrStatus: 'active',
        isDeleted: false,
      },
    ]);

    // 4. Tạo Thực đơn
    const catId = new Types.ObjectId();
    await connection.collection('menu_categories').insertOne({
      _id: catId,
      name: 'Món Chính',
      slug: 'mon-chinh',
      restaurantId: restId,
      branches: [branchId],
      isActive: true,
      isDeleted: false,
    });

    await connection.collection('menu_items').insertMany([
      {
        _id: menuItem1Id,
        name: 'Phở Bò Thượng Hạng',
        slug: 'pho-bo-thuong-hang',
        price: 60000,
        category: catId,
        restaurantId: restId,
        branches: [branchId],
        isAvailable: true,
        isDeleted: false,
        options: [
          {
            id: 'opt-meat',
            name: 'Thịt thêm',
            values: [
              { id: 'extra-beef', name: 'Bò tái thêm', priceDelta: 15000 },
            ],
          },
        ],
      },
      {
        _id: menuItem2Id,
        name: 'Trà Chanh Đào',
        slug: 'tra-chanh-dao',
        price: 25000,
        category: catId,
        restaurantId: restId,
        branches: [branchId],
        isAvailable: true,
        isDeleted: false,
        options: [],
      },
    ]);

    console.log(`  ${colors.green}✔ Đã thiết lập môi trường kiểm thử Sub-phase 6.5 thành công${colors.reset}\n`);

    // ========================================================================
    // PHẦN 1: IDEMPOTENCY KEY ENGINE TESTS
    // ========================================================================
    console.log(`${colors.bold}--- PHẦN 1: KIỂM THỬ IDEMPOTENCY KEY ENGINE ---${colors.reset}`);

    const baseCreatePayload = {
      restaurantSlug: restSlug,
      tableCode: 'ban-01',
      qrToken: qrTokenT1,
      customerNote: 'Khách bàn 01 tự đặt món',
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
          note: 'Nhiều hành',
        },
      ],
    };

    // TC-01.1: Tạo đơn lần đầu với Idempotency-Key
    const idempotencyKeyCreate = `key-create-${timestamp}`;
    const resCreate1 = await request('/orders/customer', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKeyCreate },
      body: JSON.stringify(baseCreatePayload),
    });

    let createdOrderId: string = '';
    let createdOrderCode: string = '';

    if (resCreate1.status === 201) {
      createdOrderId = resCreate1.data?.data?._id;
      createdOrderCode = resCreate1.data?.data?.orderCode;
      pass('TC-01.1: Tạo đơn thành công với Idempotency-Key hợp lệ (HTTP 201 Created)', `OrderCode: ${createdOrderCode}`);
      passed++;
    } else {
      fail('TC-01.1: Tạo đơn thất bại', resCreate1.data);
      failed++;
    }

    // TC-01.2: Retry cùng request với cùng Idempotency-Key -> Replay cached response
    const resCreateRetry = await request('/orders/customer', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKeyCreate },
      body: JSON.stringify(baseCreatePayload),
    });

    const isReplayHeader = resCreateRetry.headers.get('x-idempotent-replay') === 'true';
    const sameOrderId = resCreateRetry.data?.data?._id === createdOrderId;
    const sameOrderCode = resCreateRetry.data?.data?.orderCode === createdOrderCode;

    // Kiểm tra trong DB: chỉ có duy nhất 1 order được tạo cho bàn 01
    const orderCountTable1 = await connection.collection('orders').countDocuments({
      restaurantId: restId,
      tableId: table1Id,
    });

    if (resCreateRetry.status === 201 && isReplayHeader && sameOrderId && sameOrderCode && orderCountTable1 === 1) {
      pass('TC-01.2: Retry cùng request nhận đúng cached response replay (X-Idempotent-Replay: true, không tạo duplicate order)');
      passed++;
    } else {
      fail('TC-01.2: Replay thất bại hoặc tạo duplicate order', {
        status: resCreateRetry.status,
        isReplayHeader,
        orderCount: orderCountTable1,
      });
      failed++;
    }

    // TC-02: Cùng Key nhưng khác payload -> HTTP 422 Unprocessable Entity
    const mismatchedPayload = {
      ...baseCreatePayload,
      customerNote: 'Nội dung note đã bị thay đổi!',
    };
    const resMismatch = await request('/orders/customer', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKeyCreate },
      body: JSON.stringify(mismatchedPayload),
    });

    if (resMismatch.status === 422) {
      pass('TC-02: Cùng Idempotency-Key nhưng khác payload bị từ chối với HTTP 422 Unprocessable Entity');
      passed++;
    } else {
      fail('TC-02: Mismatched payload không trả về 422', resMismatch.status);
      failed++;
    }

    // TC-03.1: Gọi thêm món với Idempotency-Key
    const idempotencyKeyAdd = `key-add-${timestamp}`;
    const baseAddItemsPayload = {
      restaurantSlug: restSlug,
      tableCode: 'ban-01',
      qrToken: qrTokenT1,
      note: 'Thêm đồ uống',
      items: [
        {
          menuItemId: menuItem2Id.toString(),
          quantity: 2,
        },
      ],
    };

    const resAdd1 = await request('/orders/customer/items', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKeyAdd },
      body: JSON.stringify(baseAddItemsPayload),
    });

    if (resAdd1.status === 200 && resAdd1.data?.data?.rounds?.length === 2) {
      pass('TC-03.1: Gọi thêm món với Idempotency-Key thành công (Round 2 được tạo)');
      passed++;
    } else {
      fail('TC-03.1: Gọi thêm món thất bại', resAdd1.data);
      failed++;
    }

    // TC-03.2: Retry gọi thêm món với cùng Idempotency-Key -> Replay, không tạo Round 3
    const resAddRetry = await request('/orders/customer/items', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKeyAdd },
      body: JSON.stringify(baseAddItemsPayload),
    });

    const isAddReplay = resAddRetry.headers.get('x-idempotent-replay') === 'true';
    const orderAfterAddRetry = await connection.collection('orders').findOne({ _id: new Types.ObjectId(createdOrderId) });
    const roundsCount = orderAfterAddRetry?.rounds?.length;

    if (resAddRetry.status === 200 && isAddReplay && roundsCount === 2) {
      pass('TC-03.2: Retry gọi thêm món nhận cached response replay (không tạo duplicate round, rounds = 2)');
      passed++;
    } else {
      fail('TC-03.2: Retry gọi thêm món tạo duplicate round', { status: resAddRetry.status, roundsCount });
      failed++;
    }

    // TC-04: Validate Idempotency-Key format (Empty string, Whitespace, > 255 chars)
    const resEmptyKey = await request('/orders/customer', {
      method: 'POST',
      headers: { 'Idempotency-Key': '' },
      body: JSON.stringify(baseCreatePayload),
    });
    if (resEmptyKey.status === 400) {
      pass('TC-04.1: Chặn Idempotency-Key rỗng (HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-04.1: Không chặn key rỗng', resEmptyKey.status);
      failed++;
    }

    const resWhitespaceKey = await request('/orders/customer', {
      method: 'POST',
      headers: { 'Idempotency-Key': '     ' },
      body: JSON.stringify(baseCreatePayload),
    });
    if (resWhitespaceKey.status === 400) {
      pass('TC-04.2: Chặn Idempotency-Key chỉ có khoảng trắng (HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-04.2: Không chặn key khoảng trắng', resWhitespaceKey.status);
      failed++;
    }

    const resOversizedKey = await request('/orders/customer', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k'.repeat(256) },
      body: JSON.stringify(baseCreatePayload),
    });
    if (resOversizedKey.status === 400) {
      pass('TC-04.3: Chặn Idempotency-Key vượt quá 255 ký tự (HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-04.3: Không chặn key > 255 chars', resOversizedKey.status);
      failed++;
    }

    // ========================================================================
    // PHẦN 2: CONCURRENCY & OCC (OPTIMISTIC CONCURRENCY CONTROL) TESTS
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 2: KIỂM THỬ CONCURRENCY & ATOMIC CONDITIONAL UPDATE ---${colors.reset}`);

    // Chuẩn bị Bàn 02 với đơn hàng ban đầu
    const initOrderPayload = {
      restaurantSlug: restSlug,
      tableCode: 'ban-02',
      qrToken: qrTokenT2,
      customerNote: 'Đơn ban đầu Bàn 02',
      items: [
        {
          menuItemId: menuItem1Id.toString(),
          quantity: 1,
        },
      ],
    };

    const resInitTable2 = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify(initOrderPayload),
    });

    const table2OrderId = resInitTable2.data?.data?._id;

    // TC-05: CONCURRENT ADD-ITEMS VỚI KHÁC KEY (OCC RETRY & ZERO LOST UPDATES)
    // Giả lập 2 khách tại Bàn 02 cùng bấm nút gửi thêm món tại cùng một thời điểm bằng Promise.all thực sự
    const addPayloadCustA = {
      restaurantSlug: restSlug,
      tableCode: 'ban-02',
      qrToken: qrTokenT2,
      note: 'Khách A gọi thêm Món 1',
      items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }],
    };

    const addPayloadCustB = {
      restaurantSlug: restSlug,
      tableCode: 'ban-02',
      qrToken: qrTokenT2,
      note: 'Khách B gọi thêm Món 2',
      items: [{ menuItemId: menuItem2Id.toString(), quantity: 2 }],
    };

    console.log('  -> Kích hoạt 2 request gọi thêm món đồng thời bằng Promise.all...');
    const [resConcurrentA, resConcurrentB] = await Promise.all([
      request('/orders/customer/items', {
        method: 'POST',
        headers: { 'Idempotency-Key': `key-occ-a-${timestamp}` },
        body: JSON.stringify(addPayloadCustA),
      }),
      request('/orders/customer/items', {
        method: 'POST',
        headers: { 'Idempotency-Key': `key-occ-b-${timestamp}` },
        body: JSON.stringify(addPayloadCustB),
      }),
    ]);

    const bothSuccess = resConcurrentA.status === 200 && resConcurrentB.status === 200;

    // Kiểm tra tính toàn vẹn dữ liệu trong MongoDB
    const orderTable2 = await connection.collection('orders').findOne({ _id: new Types.ObjectId(table2OrderId) });
    const roundsTable2 = orderTable2?.rounds || [];
    const itemsTable2 = orderTable2?.items || [];

    // Mong đợi:
    // - Cả 2 request đều thành công (HTTP 200) nhờ OCC retry tự động
    // - Tổng số rounds = 3 (Round 1 ban đầu + Round 2 + Round 3)
    // - roundNumber tuần tự: [1, 2, 3] không bị trùng lặp
    // - Tổng số items: 1 (gốc) + 1 (khách A) + 2 (khách B) = 4 items
    // - subTotal chính xác: 60,000 + 60,000 + 25,000 * 2 = 170,000 đ
    const expectedSubTotalT2 = 60000 + 60000 + 25000 * 2;
    const roundNumbers = roundsTable2.map((r: any) => r.roundNumber).sort();
    const sequentialRounds = JSON.stringify(roundNumbers) === JSON.stringify([1, 2, 3]);
    const itemsCountCorrect = itemsTable2.length === 3;
    const totalQuantity = itemsTable2.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0);
    const quantityCorrect = totalQuantity === 4;
    const subTotalCorrect = orderTable2?.subTotal === expectedSubTotalT2;

    if (bothSuccess && sequentialRounds && itemsCountCorrect && quantityCorrect && subTotalCorrect) {
      pass('TC-05.1: 2 request gọi thêm món đồng thời đều thành công (HTTP 200)');
      pass('TC-05.2: OCC tự động tính lại roundNumber tuần tự [1, 2, 3] (Zero Duplicate Rounds)');
      pass('TC-05.3: Giữ nguyên toàn bộ items từ cả hai khách (4 items, Zero Lost Updates)');
      pass('TC-05.4: Tài chính hóa đơn subTotal chính xác tuyệt đối sau concurrent updates', `${orderTable2?.subTotal} đ`);
      passed += 4;
    } else {
      fail('TC-05: Concurrent add-items vi phạm tính toàn vẹn', {
        resAStatus: resConcurrentA.status,
        resBStatus: resConcurrentB.status,
        rounds: roundNumbers,
        itemsCount: itemsTable2.length,
        subTotal: orderTable2?.subTotal,
        expectedSubTotal: expectedSubTotalT2,
      });
      failed += 4;
    }

    // ========================================================================
    // PHẦN 3: DEF-6.5-002: CONCURRENT ORDER CREATION & MONGODB E11000 -> HTTP 409
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 3: DEF-6.5-002: CONCURRENT ORDER CREATION & E11000 MAPPING ---${colors.reset}`);

    // Bàn 03 hiện đang Available (chưa có đơn). 2 khách cùng quét QR và bấm Tạo đơn đồng thời
    const raceOrderPayloadCust1 = {
      restaurantSlug: restSlug,
      tableCode: 'ban-03',
      qrToken: qrTokenT3,
      customerNote: 'Khách 1 tạo đơn Bàn 03',
      items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }],
    };

    const raceOrderPayloadCust2 = {
      restaurantSlug: restSlug,
      tableCode: 'ban-03',
      qrToken: qrTokenT3,
      customerNote: 'Khách 2 tạo đơn Bàn 03',
      items: [{ menuItemId: menuItem2Id.toString(), quantity: 1 }],
    };

    console.log('  -> Kích hoạt 2 request tạo đơn đồng thời tại cùng Bàn 03 bằng Promise.all...');
    const [resRace1, resRace2] = await Promise.all([
      request('/orders/customer', {
        method: 'POST',
        headers: { 'Idempotency-Key': `key-race-1-${timestamp}` },
        body: JSON.stringify(raceOrderPayloadCust1),
      }),
      request('/orders/customer', {
        method: 'POST',
        headers: { 'Idempotency-Key': `key-race-2-${timestamp}` },
        body: JSON.stringify(raceOrderPayloadCust2),
      }),
    ]);

    const statuses = [resRace1.status, resRace2.status].sort();
    // Một request thành công (201), một request phải nhận HTTP 409 Conflict
    const hasOneCreated = statuses[0] === 201;
    const hasOneConflict = statuses[1] === 409;

    // Kiểm tra trong DB: Bàn 03 chỉ có duy nhất 1 đơn hàng hoạt động
    const activeOrdersTable3 = await connection.collection('orders').countDocuments({
      restaurantId: restId,
      tableId: table3Id,
      status: { $in: ['WaitingConfirmation', 'Confirmed', 'Preparing', 'Ready', 'Served', 'PaymentRequested'] },
    });

    if (hasOneCreated && hasOneConflict && activeOrdersTable3 === 1) {
      pass('TC-06.1: Concurrent Order Creation: Đúng 1 request thành công (HTTP 201), 1 request xung đột (HTTP 409)');
      pass('TC-06.2: MongoDB Partial Unique Index bảo vệ: Chỉ có duy nhất 1 active order tại bàn');
      passed += 2;
    } else {
      fail('TC-06: Concurrent Order Creation vi phạm invariant', {
        statuses,
        activeOrdersTable3,
        res1: resRace1.data,
        res2: resRace2.data,
      });
      failed += 2;
    }

    // TC-07: Xác minh lỗi xung đột duplicate key trả về HTTP 409 Conflict (chứ KHÔNG PHẢI HTTP 500)
    const conflictRes = resRace1.status === 409 ? resRace1 : resRace2;
    if (conflictRes.status === 409 && conflictRes.data?.error === 'Conflict') {
      pass('TC-07: E11000 Duplicate Key Error được map chuẩn xác thành HTTP 409 Conflict (Zero HTTP 500)');
      passed++;
    } else {
      fail('TC-07: E11000 không được map thành 409 Conflict', conflictRes);
      failed++;
    }

    // ========================================================================
    // PHẦN 4: IN-FLIGHT DUPLICATE PREVENTION & OPTIONALITY
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 4: IN-FLIGHT DUPLICATE PREVENTION & OPTIONALITY ---${colors.reset}`);

    // TC-08: 2 request gửi đồng thời với CÙNG một Idempotency-Key
    // Chỉ có 1 request thực thi business, request còn lại phải bị 409 (PROCESSING) hoặc nhận replay
    const identicalKey = `key-same-concurrent-${timestamp}`;
    const [resSameKey1, resSameKey2] = await Promise.all([
      request('/orders/customer', {
        method: 'POST',
        headers: { 'Idempotency-Key': identicalKey },
        body: JSON.stringify({
          restaurantSlug: restSlug,
          tableCode: 'ban-04',
          qrToken: qrTokenT4,
          customerNote: 'Đơn Bàn 04 cùng key',
          items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }],
        }),
      }),
      request('/orders/customer', {
        method: 'POST',
        headers: { 'Idempotency-Key': identicalKey },
        body: JSON.stringify({
          restaurantSlug: restSlug,
          tableCode: 'ban-04',
          qrToken: qrTokenT4,
          customerNote: 'Đơn Bàn 04 cùng key',
          items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }],
        }),
      }),
    ]);

    const sameKeyStatuses = [resSameKey1.status, resSameKey2.status];
    // Phải có đúng 1 order được tạo ở bàn 04
    const ordersTable4 = await connection.collection('orders').countDocuments({
      restaurantId: restId,
      tableId: table4Id,
    });

    const oneExecuted = sameKeyStatuses.includes(201);
    const otherHandled = sameKeyStatuses.includes(409) || (sameKeyStatuses[0] === 201 && sameKeyStatuses[1] === 201);

    if (oneExecuted && otherHandled && ordersTable4 === 1) {
      pass('TC-08: Concurrent duplicate requests cùng Idempotency-Key: Chỉ 1 đơn hàng được tạo, không sinh duplicate');
      passed++;
    } else {
      fail('TC-08: Cùng key concurrent bị duplicate hoặc lỗi', {
        sameKeyStatuses,
        ordersTable4,
      });
      failed++;
    }

    // TC-09: Request bình thường KHÔNG có Idempotency-Key header (Optionality)
    const resNoKey = await request('/orders/customer/items', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restSlug,
        tableCode: 'ban-04',
        qrToken: qrTokenT4,
        note: 'Gọi thêm không truyền key',
        items: [{ menuItemId: menuItem2Id.toString(), quantity: 1 }],
      }),
    });

    if (resNoKey.status === 200 && resNoKey.data?.data?.rounds?.length === 2) {
      pass('TC-09: Khách hàng không gửi Idempotency-Key: Hoạt động bình thường theo chuẩn Mobile-first (Optionality)');
      passed++;
    } else {
      fail('TC-09: Request không key thất bại', resNoKey.data);
      failed++;
    }

    // ========================================================================
    // PHẦN 5: TTL, SCHEMA INDEX, ISOLATION & PROCESSING STATE TESTS
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 5: TTL, SCHEMA INDEX, ISOLATION & PROCESSING STATE ---${colors.reset}`);

    // TC-10.1: IdempotencyKey composite unique index { restaurantId: 1, key: 1 }
    const idempIndexes = await connection.collection('idempotency_keys').indexes();
    const hasUniqueComposite = idempIndexes.some(
      (idx: any) => idx.key?.restaurantId === 1 && idx.key?.key === 1 && idx.unique === true,
    );
    if (hasUniqueComposite) {
      pass('TC-10.1: IdempotencyKey composite unique index { restaurantId: 1, key: 1 } tồn tại chính xác');
      passed++;
    } else {
      fail('TC-10.1: Không tìm thấy unique index { restaurantId: 1, key: 1 }', idempIndexes);
      failed++;
    }

    // TC-10.2: IdempotencyKey TTL index on createdAt with expireAfterSeconds: 86400
    const hasTtl86400 = idempIndexes.some(
      (idx: any) => idx.key?.createdAt === 1 && idx.expireAfterSeconds === 86400,
    );
    if (hasTtl86400) {
      pass('TC-10.2: IdempotencyKey TTL index createdAt có expireAfterSeconds = 86400 (24h)');
      passed++;
    } else {
      fail('TC-10.2: Không tìm thấy TTL index 86400 trên createdAt', idempIndexes);
      failed++;
    }

    // TC-10.3: Multi-tenant / Restaurant Isolation
    // Thiết lập Nhà hàng 2 để kiểm chứng cùng Idempotency-Key tại 2 nhà hàng độc lập hoàn toàn
    const rest2Id = new Types.ObjectId();
    const rest2Slug = `rest-iso-${timestamp}`;
    const branch2Id = 'branch-iso-main';
    const zone2Id = new Types.ObjectId();
    const tableIsoId = new Types.ObjectId();
    const qrTokenIso = `token-iso-${timestamp}`;
    const catIsoId = new Types.ObjectId();
    const menuItemIsoId = new Types.ObjectId();

    await connection.collection('restaurants').insertOne({
      _id: rest2Id,
      name: 'Nhà Hàng Isolation Test',
      slug: rest2Slug,
      email: `rest_iso_${timestamp}@test.com`,
      phone: '0909999999',
      status: 'Active',
      branches: [{ _id: branch2Id, name: 'Chi Nhánh ISO', isMainBranch: true, status: 'Active' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await connection.collection('table_zones').insertOne({
      _id: zone2Id,
      name: 'Khu vực ISO',
      restaurantId: rest2Id,
      branchId: branch2Id,
      isDeleted: false,
    });

    await connection.collection('tables').insertOne({
      _id: tableIsoId,
      code: 'ban-iso-01',
      name: 'Bàn ISO 01',
      zone: zone2Id,
      restaurantId: rest2Id,
      branchId: branch2Id,
      status: 'Available',
      qrToken: qrTokenIso,
      qrStatus: 'active',
      isDeleted: false,
    });

    await connection.collection('menu_categories').insertOne({
      _id: catIsoId,
      name: 'Món ISO',
      slug: 'mon-iso',
      restaurantId: rest2Id,
      branches: [branch2Id],
      isActive: true,
      isDeleted: false,
    });

    await connection.collection('menu_items').insertOne({
      _id: menuItemIsoId,
      name: 'Cà phê ISO',
      slug: 'ca-phe-iso',
      price: 30000,
      category: catIsoId,
      restaurantId: rest2Id,
      branches: [branch2Id],
      isAvailable: true,
      isDeleted: false,
      options: [],
    });

    const sharedKeyIsolation = `key-shared-iso-${timestamp}`;
    const [resIso1, resIso2] = await Promise.all([
      request('/orders/customer', {
        method: 'POST',
        headers: { 'Idempotency-Key': sharedKeyIsolation },
        body: JSON.stringify({
          restaurantSlug: restSlug,
          tableCode: 'ban-05',
          qrToken: qrTokenT5,
          customerNote: 'Đơn Nhà hàng 1 cùng key',
          items: [{ menuItemId: menuItem2Id.toString(), quantity: 1 }],
        }),
      }),
      request('/orders/customer', {
        method: 'POST',
        headers: { 'Idempotency-Key': sharedKeyIsolation },
        body: JSON.stringify({
          restaurantSlug: rest2Slug,
          tableCode: 'ban-iso-01',
          qrToken: qrTokenIso,
          customerNote: 'Đơn Nhà hàng 2 cùng key',
          items: [{ menuItemId: menuItemIsoId.toString(), quantity: 1 }],
        }),
      }),
    ]);

    const isIso1Replay = resIso1.headers.get('x-idempotent-replay') === 'true';
    const isIso2Replay = resIso2.headers.get('x-idempotent-replay') === 'true';

    if (resIso1.status === 201 && resIso2.status === 201 && !isIso1Replay && !isIso2Replay) {
      pass('TC-10.3: Multi-tenant Isolation: Cùng Idempotency-Key tại 2 nhà hàng hoạt động độc lập (cả 2 đều HTTP 201 Created)');
      passed++;
    } else {
      fail('TC-10.3: Restaurant Isolation vi phạm', {
        status1: resIso1.status,
        status2: resIso2.status,
        isIso1Replay,
        isIso2Replay,
      });
      failed++;
    }

    // Dọn dẹp tài nguyên Nhà hàng 2
    await connection.collection('restaurants').deleteOne({ _id: rest2Id });
    await connection.collection('table_zones').deleteOne({ _id: zone2Id });
    await connection.collection('tables').deleteMany({ restaurantId: rest2Id });
    await connection.collection('menu_categories').deleteMany({ restaurantId: rest2Id });
    await connection.collection('menu_items').deleteMany({ restaurantId: rest2Id });
    await connection.collection('orders').deleteMany({ restaurantId: rest2Id });
    await connection.collection('idempotency_keys').deleteMany({ restaurantId: rest2Id });

    // TC-11: Explicit PROCESSING state -> HTTP 409 Conflict
    const explicitProcessingKey = `key-explicit-processing-${timestamp}`;
    const canonicalPayloadHash = (app.get(OrdersService) as any).generateRequestFingerprint(
      'POST /orders/customer',
      baseCreatePayload,
    );

    await connection.collection('idempotency_keys').insertOne({
      restaurantId: restId,
      key: explicitProcessingKey,
      endpoint: 'POST /orders/customer',
      requestHash: canonicalPayloadHash,
      status: 'PROCESSING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const resExplicitProcessing = await request('/orders/customer', {
      method: 'POST',
      headers: { 'Idempotency-Key': explicitProcessingKey },
      body: JSON.stringify(baseCreatePayload),
    });

    if (
      resExplicitProcessing.status === 409 &&
      resExplicitProcessing.data?.error === 'Conflict' &&
      resExplicitProcessing.data?.message?.includes('đang được xử lý')
    ) {
      pass('TC-11: Idempotency-Key ở trạng thái PROCESSING trả về HTTP 409 Conflict với thông điệp chuẩn');
      passed++;
    } else {
      fail('TC-11: PROCESSING state không trả về HTTP 409 Conflict chuẩn', resExplicitProcessing.data);
      failed++;
    }

    // TC-12: E11000 Response Contract & No Leaked Raw MongoDB Error
    const hasValidContract =
      conflictRes.status === 409 &&
      conflictRes.data?.statusCode === 409 &&
      conflictRes.data?.error === 'Conflict' &&
      typeof conflictRes.data?.message === 'string' &&
      Boolean(conflictRes.data?.timestamp) &&
      Boolean(conflictRes.data?.path);

    const serializedConflict = JSON.stringify(conflictRes.data);
    const noRawMongoLeak =
      !serializedConflict.includes('MongoServerError') &&
      !serializedConflict.includes('E11000') &&
      !serializedConflict.includes('imenu-db-test');

    if (hasValidContract && noRawMongoLeak) {
      pass('TC-12: E11000 Response Contract chuẩn { statusCode: 409, error: "Conflict", message, path, timestamp } và không rò rỉ raw Mongo error');
      passed++;
    } else {
      fail('TC-12: E11000 Response Contract không hợp lệ hoặc rò rỉ raw MongoDB error', conflictRes.data);
      failed++;
    }

    // ========================================================================
    // PHẦN 6: FAILED LIFECYCLE, POS ORDER CREATION & POS ATOMIC PAY IDEMPOTENCY
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 6: FAILED LIFECYCLE & POS ENDPOINTS IDEMPOTENCY ---${colors.reset}`);

    // TC-13: FAILED lifecycle state handling
    const explicitFailedKey = `key-explicit-failed-${timestamp}`;
    await connection.collection('idempotency_keys').insertOne({
      restaurantId: restId,
      key: explicitFailedKey,
      endpoint: 'POST /orders/customer',
      requestHash: canonicalPayloadHash,
      status: 'FAILED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const resExplicitFailed = await request('/orders/customer', {
      method: 'POST',
      headers: { 'Idempotency-Key': explicitFailedKey },
      body: JSON.stringify(baseCreatePayload),
    });

    if (
      resExplicitFailed.status === 409 &&
      resExplicitFailed.data?.message?.includes('đã thất bại')
    ) {
      pass('TC-13: Idempotency-Key ở trạng thái FAILED bị từ chối với HTTP 409 Conflict và thông điệp chuẩn');
      passed++;
    } else {
      fail('TC-13: FAILED state không trả về 409 Conflict', resExplicitFailed.data);
      failed++;
    }

    // Đăng nhập SuperAdmin để kiểm thử POS endpoints
    const loginSuperAdmin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: process.env.SUPERADMIN_USERNAME || 'superadmin',
        password: process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@2026!',
      }),
    });
    const superAdminToken = loginSuperAdmin.data?.data?.accessToken;

    // Chuẩn bị Bàn 06
    const table6Id = new Types.ObjectId();
    await connection.collection('tables').insertOne({
      _id: table6Id,
      code: 'ban-06',
      name: 'Bàn 06',
      zone: zoneId,
      restaurantId: restId,
      branchId,
      status: 'Available',
      qrToken: `token-t6-${timestamp}`,
      qrStatus: 'active',
      isDeleted: false,
    });

    // TC-14: POS Order Creation with Idempotency-Key & Replay
    const posCreateKey = `pos-create-key-${timestamp}`;
    const posCreatePayload = {
      tableId: table6Id.toString(),
      items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }],
      orderSource: 'STAFF_POS',
      customerNote: 'Đơn POS tạo bởi thu ngân',
    };

    const resPosCreate1 = await request('/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'x-restaurant-id': restId.toString(),
        'Idempotency-Key': posCreateKey,
      },
      body: JSON.stringify(posCreatePayload),
    });

    const posOrderId = resPosCreate1.data?.data?._id;

    // Retry POS create with same key
    const resPosCreateRetry = await request('/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'x-restaurant-id': restId.toString(),
        'Idempotency-Key': posCreateKey,
      },
      body: JSON.stringify(posCreatePayload),
    });

    const isPosCreateReplay = resPosCreateRetry.headers.get('x-idempotent-replay') === 'true';
    const samePosOrderId = resPosCreateRetry.data?.data?._id === posOrderId;

    const countOrdersTable6 = await connection.collection('orders').countDocuments({
      restaurantId: restId,
      tableId: table6Id,
    });

    if (
      resPosCreate1.status === 201 &&
      resPosCreateRetry.status === 201 &&
      isPosCreateReplay &&
      samePosOrderId &&
      countOrdersTable6 === 1
    ) {
      pass('TC-14: POS Order Creation hỗ trợ Idempotency-Key và Replay chuẩn xác (X-Idempotent-Replay: true, count = 1)');
      passed++;
    } else {
      fail('TC-14: POS Order Creation Idempotency thất bại', {
        status1: resPosCreate1.status,
        status2: resPosCreateRetry.status,
        isPosCreateReplay,
        countOrdersTable6,
      });
      failed++;
    }

    // TC-15: POS Payment Execution with Idempotency-Key & Atomic Claim Preservation
    const posPayKey = `pos-pay-key-${timestamp}`;
    const payPayload = {
      paymentMethod: 'VietQR',
      discountPercent: 10,
      vatPercent: 8,
    };

    const resPosPay1 = await request(`/orders/${posOrderId}/pay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'x-restaurant-id': restId.toString(),
        'Idempotency-Key': posPayKey,
      },
      body: JSON.stringify(payPayload),
    });

    // Retry POS pay with same key
    const resPosPayRetry = await request(`/orders/${posOrderId}/pay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'x-restaurant-id': restId.toString(),
        'Idempotency-Key': posPayKey,
      },
      body: JSON.stringify(payPayload),
    });

    const isPosPayReplay = resPosPayRetry.headers.get('x-idempotent-replay') === 'true';
    const table6AfterPay = await connection.collection('tables').findOne({ _id: table6Id });
    const order6AfterPay = await connection.collection('orders').findOne({ _id: new Types.ObjectId(posOrderId) });

    if (
      resPosPay1.status === 200 &&
      resPosPayRetry.status === 200 &&
      isPosPayReplay &&
      order6AfterPay?.status === 'Paid' &&
      order6AfterPay?.isPaid === true &&
      table6AfterPay?.status === 'Available'
    ) {
      pass('TC-15: POS Payment Execution bảo vệ Idempotency Replay và bảo toàn tính Atomic Claim (Order = Paid, Table = Available)');
      passed++;
    } else {
      fail('TC-15: POS Payment Idempotency thất bại', {
        status1: resPosPay1.status,
        status2: resPosPayRetry.status,
        isPosPayReplay,
        orderStatus: order6AfterPay?.status,
        tableStatus: table6AfterPay?.status,
      });
      failed++;
    }

    // ========================================================================
    // PHẦN 7: ADVANCED CONCURRENCY BURST, CROSS-ROUTE CONFLICT & TIMEOUT RETRY
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 7: ADVANCED CONCURRENCY BURST & TIMEOUT SIMULATION ---${colors.reset}`);

    // TC-16: Cross-Route Key Reuse Conflict
    const resCrossRoute = await request(`/orders/${posOrderId}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'x-restaurant-id': restId.toString(),
        'Idempotency-Key': posCreateKey,
      },
      body: JSON.stringify({
        items: [{ menuItemId: menuItem2Id.toString(), quantity: 1 }],
      }),
    });

    if (resCrossRoute.status === 422) {
      pass('TC-16: Tái sử dụng cùng Idempotency-Key trên route/endpoint khác bị chặn với HTTP 422 Unprocessable Entity');
      passed++;
    } else {
      fail('TC-16: Cross-route key reuse không trả về 422', resCrossRoute.status);
      failed++;
    }

    // TC-17: High Concurrency Burst: 5 request tạo đơn đồng thời với CÙNG một Idempotency-Key
    const table7Id = new Types.ObjectId();
    const qrTokenT7 = `token-t7-${timestamp}`;
    await connection.collection('tables').insertOne({
      _id: table7Id,
      code: 'ban-07',
      name: 'Bàn 07',
      zone: zoneId,
      restaurantId: restId,
      branchId,
      status: 'Available',
      qrToken: qrTokenT7,
      qrStatus: 'active',
      isDeleted: false,
    });

    const burstKey = `key-burst-create-${timestamp}`;
    const burstPayload = {
      restaurantSlug: restSlug,
      tableCode: 'ban-07',
      qrToken: qrTokenT7,
      customerNote: 'Burst concurrent creation',
      items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }],
    };

    console.log('  -> Kích hoạt 5 request tạo đơn đồng thời với CÙNG 1 key bằng Promise.all...');
    const burstResponses = await Promise.all([
      request('/orders/customer', { method: 'POST', headers: { 'Idempotency-Key': burstKey }, body: JSON.stringify(burstPayload) }),
      request('/orders/customer', { method: 'POST', headers: { 'Idempotency-Key': burstKey }, body: JSON.stringify(burstPayload) }),
      request('/orders/customer', { method: 'POST', headers: { 'Idempotency-Key': burstKey }, body: JSON.stringify(burstPayload) }),
      request('/orders/customer', { method: 'POST', headers: { 'Idempotency-Key': burstKey }, body: JSON.stringify(burstPayload) }),
      request('/orders/customer', { method: 'POST', headers: { 'Idempotency-Key': burstKey }, body: JSON.stringify(burstPayload) }),
    ]);

    const burstStatuses = burstResponses.map((r) => r.status);
    const countCreatedBurst = burstStatuses.filter((s) => s === 201).length;
    const countConflictBurst = burstStatuses.filter((s) => s === 409).length;

    const ordersTable7 = await connection.collection('orders').countDocuments({
      restaurantId: restId,
      tableId: table7Id,
    });

    if (countCreatedBurst >= 1 && countCreatedBurst + countConflictBurst === 5 && ordersTable7 === 1) {
      pass('TC-17: High Concurrency Burst (5 concurrent requests cùng key): Duy nhất 1 đơn hàng được tạo trong DB, không sinh duplicate');
      passed++;
    } else {
      fail('TC-17: High Concurrency Burst thất bại', { burstStatuses, ordersTable7 });
      failed++;
    }

    // TC-18: Concurrent Payment Requests with SAME key (Burst 5 simultaneous pay requests)
    const table8Id = new Types.ObjectId();
    const qrTokenT8 = `token-t8-${timestamp}`;
    await connection.collection('tables').insertOne({
      _id: table8Id,
      code: 'ban-08',
      name: 'Bàn 08',
      zone: zoneId,
      restaurantId: restId,
      branchId,
      status: 'Occupied',
      qrToken: qrTokenT8,
      qrStatus: 'active',
      isDeleted: false,
    });

    const initOrder8Res = await request('/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'x-restaurant-id': restId.toString(),
      },
      body: JSON.stringify({
        tableId: table8Id.toString(),
        items: [{ menuItemId: menuItem1Id.toString(), quantity: 2 }],
        orderSource: 'STAFF_POS',
        customerNote: 'Đơn Bàn 08 để test concurrent pay',
      }),
    });
    const order8Id = initOrder8Res.data?.data?._id;

    const burstPayKey = `pay-burst-${timestamp}`;
    const burstPayPayload = {
      paymentMethod: 'VietQR',
      discountPercent: 5,
      vatPercent: 8,
    };

    console.log('  -> Kích hoạt 5 request thanh toán đồng thời với CÙNG 1 key bằng Promise.all...');
    const burstPayResponses = await Promise.all([
      request(`/orders/${order8Id}/pay`, { method: 'POST', headers: { Authorization: `Bearer ${superAdminToken}`, 'x-restaurant-id': restId.toString(), 'Idempotency-Key': burstPayKey }, body: JSON.stringify(burstPayPayload) }),
      request(`/orders/${order8Id}/pay`, { method: 'POST', headers: { Authorization: `Bearer ${superAdminToken}`, 'x-restaurant-id': restId.toString(), 'Idempotency-Key': burstPayKey }, body: JSON.stringify(burstPayPayload) }),
      request(`/orders/${order8Id}/pay`, { method: 'POST', headers: { Authorization: `Bearer ${superAdminToken}`, 'x-restaurant-id': restId.toString(), 'Idempotency-Key': burstPayKey }, body: JSON.stringify(burstPayPayload) }),
      request(`/orders/${order8Id}/pay`, { method: 'POST', headers: { Authorization: `Bearer ${superAdminToken}`, 'x-restaurant-id': restId.toString(), 'Idempotency-Key': burstPayKey }, body: JSON.stringify(burstPayPayload) }),
      request(`/orders/${order8Id}/pay`, { method: 'POST', headers: { Authorization: `Bearer ${superAdminToken}`, 'x-restaurant-id': restId.toString(), 'Idempotency-Key': burstPayKey }, body: JSON.stringify(burstPayPayload) }),
    ]);

    const burstPayStatuses = burstPayResponses.map((r) => r.status);
    const order8After = await connection.collection('orders').findOne({ _id: new Types.ObjectId(order8Id) });
    const table8After = await connection.collection('tables').findOne({ _id: table8Id });

    const paySuccessCount = burstPayStatuses.filter((s) => s === 200).length;
    const payConflictCount = burstPayStatuses.filter((s) => s === 409).length;

    if (
      paySuccessCount >= 1 &&
      paySuccessCount + payConflictCount === 5 &&
      order8After?.status === 'Paid' &&
      order8After?.isPaid === true &&
      table8After?.status === 'Available'
    ) {
      pass('TC-18: Concurrent Payment Requests (5 concurrent pay cùng key): Bảo đảm thanh toán chính xác 1 lần, không double-charge, giải phóng bàn đúng 1 lần');
      passed++;
    } else {
      fail('TC-18: Concurrent pay cùng key thất bại', { burstPayStatuses, orderStatus: order8After?.status, tableStatus: table8After?.status });
      failed++;
    }

    // TC-19: Payment Retry after Timeout Simulation
    const table9Id = new Types.ObjectId();
    await connection.collection('tables').insertOne({
      _id: table9Id,
      code: 'ban-09',
      name: 'Bàn 09',
      zone: zoneId,
      restaurantId: restId,
      branchId,
      status: 'Available',
      qrToken: `token-t9-${timestamp}`,
      qrStatus: 'active',
      isDeleted: false,
    });

    const initOrder9Res = await request('/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'x-restaurant-id': restId.toString(),
      },
      body: JSON.stringify({
        tableId: table9Id.toString(),
        items: [{ menuItemId: menuItem2Id.toString(), quantity: 2 }],
        orderSource: 'STAFF_POS',
      }),
    });
    const order9Id = initOrder9Res.data?.data?._id;

    const timeoutPayKey = `pay-timeout-sim-${timestamp}`;
    const timeoutPayPayload = {
      paymentMethod: 'Cash',
      amountReceived: 100000,
    };

    // 1. Request thanh toán ban đầu thành công trên server
    const resTimeout1 = await request(`/orders/${order9Id}/pay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'x-restaurant-id': restId.toString(),
        'Idempotency-Key': timeoutPayKey,
      },
      body: JSON.stringify(timeoutPayPayload),
    });

    // 2. Client giả lập bị timeout / network drop và retry với CÙNG key
    const resTimeoutRetry = await request(`/orders/${order9Id}/pay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'x-restaurant-id': restId.toString(),
        'Idempotency-Key': timeoutPayKey,
      },
      body: JSON.stringify(timeoutPayPayload),
    });

    const isTimeoutReplay = resTimeoutRetry.headers.get('x-idempotent-replay') === 'true';
    const sameChangeAmount = resTimeoutRetry.data?.data?.changeAmount === resTimeout1.data?.data?.changeAmount;

    if (resTimeout1.status === 200 && resTimeoutRetry.status === 200 && isTimeoutReplay && sameChangeAmount) {
      pass('TC-19: Payment Retry sau Timeout Simulation: Nhận phản hồi replay tức thì (X-Idempotent-Replay: true, đúng tiền thừa, không lỗi 400)');
      passed++;
    } else {
      fail('TC-19: Payment Retry sau Timeout Simulation thất bại', {
        status1: resTimeout1.status,
        status2: resTimeoutRetry.status,
        isTimeoutReplay,
      });
      failed++;
    }

    // TC-20: Actual Database State & Idempotency Key Record Quality
    const idempDoc = await connection.collection('idempotency_keys').findOne({
      restaurantId: restId,
      key: timeoutPayKey,
    });

    const isRecordValid =
      idempDoc?.status === 'COMPLETED' &&
      idempDoc?.responseCode === 200 &&
      Boolean(idempDoc?.responseBody?.order) &&
      Boolean(idempDoc?.requestHash) &&
      idempDoc?.createdAt instanceof Date;

    if (isRecordValid) {
      pass('TC-20: Idempotency Key Document Quality chuẩn xác trong MongoDB (status=COMPLETED, responseCode=200, hash hợp lệ, createdAt hợp lệ)');
      passed++;
    } else {
      fail('TC-20: Idempotency Key Document Quality không hợp lệ trong DB', idempDoc);
      failed++;
    }

    // --- PHẦN 8: HARDENING VALIDATION (AUD-6.5-01 & AUD-6.5-02) ---
    console.log(`\n${colors.cyan}--- PHẦN 8: HARDENING VALIDATION (AUD-6.5-01 & AUD-6.5-02) ---${colors.reset}`);

    // TC-21 (HARDENING): Khôi phục Atomic Lease cho request bị treo PROCESSING > 60s (AUD-6.5-01)
    const tableHardenId = new Types.ObjectId();
    const qrTokenHarden = `token-harden-${timestamp}`;
    await connection.collection('tables').insertOne({
      _id: tableHardenId,
      name: 'Bàn Hardening',
      code: 'ban-harden',
      zone: zoneId,
      restaurantId: restId,
      branchId,
      status: 'Available',
      qrToken: qrTokenHarden,
      qrStatus: 'active',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const createPayloadStalled = {
      restaurantSlug: restSlug,
      tableCode: 'ban-harden',
      qrToken: qrTokenHarden,
      items: [{ menuItemId: menuItem1Id.toString(), quantity: 1 }],
    };
    const endpointCustomer = 'POST /orders/customer';
    const ordersService = app.get(OrdersService);
    const hashStalled = ordersService.generateRequestFingerprint(endpointCustomer, createPayloadStalled);
    const stalledKey = `stalled-key-${timestamp}`;

    // Giả lập 1 request trước đó bị crash giữa chừng cách đây 75 giây (vượt ngưỡng lease 60s)
    await connection.collection('idempotency_keys').insertOne({
      restaurantId: restId,
      key: stalledKey,
      endpoint: endpointCustomer,
      requestHash: hashStalled,
      status: 'PROCESSING',
      createdAt: new Date(Date.now() - 75000),
      updatedAt: new Date(Date.now() - 75000),
    });

    // Client retry lại với cùng stalledKey -> Hệ thống phát hiện lease quá 60s, claim atomic lease và hoàn tất thành công!
    const resRecover = await request('/orders/customer', {
      method: 'POST',
      headers: { 'Idempotency-Key': stalledKey },
      body: JSON.stringify(createPayloadStalled),
    });

    const docAfterRecover = await connection.collection('idempotency_keys').findOne({
      restaurantId: restId,
      key: stalledKey,
    });

    if (resRecover.status === 201 && docAfterRecover?.status === 'COMPLETED') {
      pass('TC-21: Request bị treo PROCESSING > 60s được tự động khôi phục atomic lease và chuyển COMPLETED thành công (AUD-6.5-01)');
      passed++;
    } else {
      fail('TC-21: Khôi phục lease bị lỗi', { status: resRecover.status, doc: docAfterRecover });
      failed++;
    }

    // TC-22 (HARDENING): Hàm generateRequestFingerprint hỗ trợ Date và toJSON() chuẩn xác (AUD-6.5-02)
    const testDate = new Date('2026-10-04T10:00:00.000Z');
    const hash1 = ordersService.generateRequestFingerprint('POST /test', {
      time: testDate,
      id: restId,
      b: 2,
      a: 1,
    });
    const hash2 = ordersService.generateRequestFingerprint('POST /test', {
      a: 1,
      id: restId,
      b: 2,
      time: new Date('2026-10-04T10:00:00.000Z'),
    });

    if (hash1 === hash2 && hash1.length === 64) {
      pass('TC-22: Fingerprint sinh chuẩn xác và nhất quán với Date và toJSON() object (64 hex chars, AUD-6.5-02)');
      passed++;
    } else {
      fail('TC-22: Fingerprint không nhất quán', { hash1, hash2 });
      failed++;
    }

  } catch (err) {
    console.error('Lỗi nghiêm trọng trong quá trình chạy kiểm thử:', err);
    failed++;
  } finally {
    console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
    console.log(`${colors.bold}Kết quả kiểm thử Sub-phase 6.5: ${colors.green}${passed} passed${colors.reset}, ${colors.red}${failed} failed${colors.reset}`);
    console.log(`${colors.bold}----------------------------------------------------------------${colors.reset}\n`);

    console.log('[Teardown] Dọn dẹp tài nguyên kiểm thử Sub-phase 6.5...');
    await connection.collection('restaurants').deleteOne({ _id: restId });
    await connection.collection('table_zones').deleteOne({ _id: zoneId });
    await connection.collection('tables').deleteMany({ restaurantId: restId });
    await connection.collection('menu_categories').deleteMany({ restaurantId: restId });
    await connection.collection('menu_items').deleteMany({ restaurantId: restId });
    await connection.collection('orders').deleteMany({ restaurantId: restId });
    await connection.collection('idempotency_keys').deleteMany({ restaurantId: restId });
    console.log(`  ${colors.green}✔ Đã dọn dẹp sạch sẽ toàn bộ dữ liệu kiểm thử (Zero Garbage)${colors.reset}\n`);

    await app.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main();
