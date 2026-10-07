import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { RolesService } from '../../src/modules/roles/roles.service';

const TEST_PORT = 3101;
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

interface TestFailure {
  category: string;
  testName: string;
  error: any;
  classification: 'IMPLEMENTATION_DEFECT' | 'TEST_DEFECT' | 'ENVIRONMENT_ISSUE' | 'EXPECTED_BEHAVIOR_MISMATCH';
}

const failures: TestFailure[] = [];

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  iMenu API - Sub-phase 6.6: Table ↔ Order Synchronization & Transfer/Merge ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  console.log('Khởi động test server trên port', TEST_PORT, '...');
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const connection: Connection = app.get(getConnectionToken());
  await app.listen(TEST_PORT);
  console.log('Test server đã sẵn sàng!\n');

  const timestamp = Date.now();
  let restaurantAId = '';
  let branchAId = '';
  let branchA2Id = '';
  let restaurantBId = '';
  let branchBId = '';

  let ownerAToken = '';
  let cashierAToken = '';
  let branchA2CashierToken = '';
  let ownerBToken = '';
  let cashierBToken = '';

  let zoneAId = '';
  let zoneA2Id = '';
  let zoneBId = '';

  let table1Id = '';
  let table2Id = '';
  let table3Id = '';
  let table4Id = '';
  let tableA2Id = '';
  let tableB1Id = '';

  let menuItem1Id = '';
  let menuItem2Id = '';
  const item1Price = 60000;
  const item2Price = 90000;

  try {
    // ========================================================================
    // SETUP: Tạo Nhà Hàng A, Chi Nhánh 1, Chi Nhánh 2, Nhà Hàng B, Thực Đơn, Bàn Ăn
    // ========================================================================
    console.log(`\n${colors.bold}--- THIẾT LẬP DỮ LIỆU KIỂM THỬ (TEST FIXTURES) ---${colors.reset}`);

    // 1. Nhà hàng A
    const regARes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng A Sync 6.6 ${timestamp}`,
          phone: '0901111111',
          address: '123 Đường Lê Lợi, Q1',
        },
        owner: {
          fullName: 'Chủ Quán A',
          phone: '0901111111',
          email: `owner.sync.a.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restaurantAId = regARes.data?.data?.restaurant?.id || regARes.data?.data?.restaurant?._id;
    ownerAToken = regARes.data?.data?.accessToken;

    const restADoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantAId) });
    branchAId = restADoc!.branches[0]._id.toString();

    // Thêm chi nhánh 2 cho Nhà Hàng A
    const newBranchId = new Types.ObjectId();
    await connection.collection('restaurants').updateOne(
      { _id: new Types.ObjectId(restaurantAId) },
      {
        $push: {
          branches: {
            _id: newBranchId,
            name: 'Chi Nhánh Quận 7',
            address: '789 Nguyễn Thị Thập, Q7',
            phone: '0902222222',
            isMainBranch: false,
            status: 'ACTIVE',
            isDeleted: false,
            createdAt: new Date(),
          },
        } as any,
      },
    );
    branchA2Id = newBranchId.toString();

    // Lấy Role IDs
    const rolesService = app.get(RolesService);
    const cashierRole = await rolesService.findBySlug('cashier');

    // Tạo Cashier Chi nhánh 1
    const cashier1Email = `cashier.a.${timestamp}@imenu.vn`;
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fullName: 'Thu Ngân CN1',
        username: `cashier_a_${timestamp}`,
        email: cashier1Email,
        password: 'Password@123',
        phone: '0901234111',
        roleId: cashierRole._id.toString(),
        branchId: branchAId,
      }),
    });
    const loginCashierA = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: cashier1Email, password: 'Password@123' }),
    });
    cashierAToken = loginCashierA.data?.data?.accessToken;

    // Tạo Cashier Chi nhánh 2
    const cashier2Email = `cashier.a2.${timestamp}@imenu.vn`;
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fullName: 'Thu Ngân CN2',
        username: `cashier_a2_${timestamp}`,
        email: cashier2Email,
        password: 'Password@123',
        phone: '0901234222',
        roleId: cashierRole._id.toString(),
        branchId: branchA2Id,
      }),
    });
    const loginCashierA2 = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: cashier2Email, password: 'Password@123' }),
    });
    branchA2CashierToken = loginCashierA2.data?.data?.accessToken;

    // 2. Nhà hàng B (Multi-Tenant Isolation)
    const regBRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng B Isolation 6.6 ${timestamp}`,
          phone: '0909999999',
          address: '999 Đường Trường Sa, Q3',
        },
        owner: {
          fullName: 'Chủ Quán B',
          phone: '0909999999',
          email: `owner.sync.b.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restaurantBId = regBRes.data?.data?.restaurant?.id || regBRes.data?.data?.restaurant?._id;
    ownerBToken = regBRes.data?.data?.accessToken;

    const restBDoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantBId) });
    branchBId = restBDoc!.branches[0]._id.toString();

    const cashierBEmail = `cashier.b.${timestamp}@imenu.vn`;
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBToken}` },
      body: JSON.stringify({
        fullName: 'Thu Ngân Quán B',
        username: `cashier_b_${timestamp}`,
        email: cashierBEmail,
        password: 'Password@123',
        phone: '0909999111',
        roleId: cashierRole._id.toString(),
        branchId: branchBId,
      }),
    });
    const loginCashierB = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: cashierBEmail, password: 'Password@123' }),
    });
    cashierBToken = loginCashierB.data?.data?.accessToken;


    // 3. Tạo Khu vực bàn & Bàn ăn
    const zoneARes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ name: `Tầng 1 CN1 ${timestamp}`, branchId: branchAId }),
    });
    zoneAId = zoneARes.data?.data?._id || zoneARes.data?.data?.id;

    const zoneA2Res = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ name: `Tầng 1 CN2 ${timestamp}`, branchId: branchA2Id }),
    });
    zoneA2Id = zoneA2Res.data?.data?._id || zoneA2Res.data?.data?.id;

    const zoneBRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBToken}` },
      body: JSON.stringify({ name: `Tầng 1 Quán B ${timestamp}`, branchId: branchBId }),
    });
    zoneBId = zoneBRes.data?.data?._id || zoneBRes.data?.data?.id;

    // Tạo các bàn Nhà hàng A - CN1
    const t1 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ code: `B01_${timestamp}`, name: 'Bàn 01', zoneId: zoneAId, branchId: branchAId, capacity: 4 }),
    });
    table1Id = t1.data?.data?._id || t1.data?.data?.id;

    const t2 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ code: `B02_${timestamp}`, name: 'Bàn 02', zoneId: zoneAId, branchId: branchAId, capacity: 4 }),
    });
    table2Id = t2.data?.data?._id || t2.data?.data?.id;

    const t3 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ code: `B03_${timestamp}`, name: 'Bàn 03', zoneId: zoneAId, branchId: branchAId, capacity: 6 }),
    });
    table3Id = t3.data?.data?._id || t3.data?.data?.id;

    const t4 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ code: `B04_${timestamp}`, name: 'Bàn 04', zoneId: zoneAId, branchId: branchAId, capacity: 4 }),
    });
    table4Id = t4.data?.data?._id || t4.data?.data?.id;

    // Tạo bàn Nhà hàng A - CN2
    const tA2 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ code: `B_CN2_${timestamp}`, name: 'Bàn CN2', zoneId: zoneA2Id, branchId: branchA2Id, capacity: 4 }),
    });
    tableA2Id = tA2.data?.data?._id || tA2.data?.data?.id;

    // Tạo bàn Nhà hàng B
    const tB1 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBToken}` },
      body: JSON.stringify({ code: `B_QB_${timestamp}`, name: 'Bàn Quán B', zoneId: zoneBId, branchId: branchBId, capacity: 4 }),
    });
    tableB1Id = tB1.data?.data?._id || tB1.data?.data?.id;

    // 4. Tạo Thực đơn mẫu Nhà hàng A
    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ name: 'Món Chính' }),
    });
    const categoryId = catRes.data?.data?._id || catRes.data?.data?.id;

    const m1 = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: 'Phở Bò Đặc Biệt',
        price: item1Price,
        categoryId,
        unit: 'Tô',
      }),
    });
    menuItem1Id = m1.data?.data?._id || m1.data?.data?.id;

    const m2 = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: 'Lẩu Bò Nhúng Dấm',
        price: item2Price,
        categoryId,
        unit: 'Nồi',
      }),
    });
    menuItem2Id = m2.data?.data?._id || m2.data?.data?.id;

    console.log('Khởi tạo fixtures thành công!\n');

    // ========================================================================
    // 1. TRANSFER TESTS
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 1: KIỂM THỬ CHUYỂN BÀN (TRANSFER TABLE) ---${colors.reset}`);

    // Tạo đơn hàng trên Bàn 01 (Round 1)
    const createOrderRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({
        tableId: table1Id,
        items: [
          { menuItemId: menuItem1Id, quantity: 2 }, // 120,000
        ],
      }),
    });
    console.log('DEBUG createOrderRes:', createOrderRes.status, JSON.stringify(createOrderRes.data));
    const order1Id = createOrderRes.data?.data?._id;


    // Thêm Round 2 cho Bàn 01
    await request(`/orders/${order1Id}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({
        items: [
          { menuItemId: menuItem2Id, quantity: 1 }, // 90,000
        ],
      }),
    });

    // 1.1: Transfer thành công từ B01 -> B02 (Available)
    const tSuccessRes = await request('/tables/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({
        fromTableId: table1Id,
        toTableId: table2Id,
        reason: 'Khách muốn chuyển sang bàn gần cửa sổ',
      }),
    });

    if (tSuccessRes.status === 200 && tSuccessRes.data?.data?.success) {
      pass('1.1: Chuyển bàn thành công (Transfer B01 -> B02)', 'HTTP 200 OK');
      passed++;
    } else {
      fail('1.1: Chuyển bàn thành công', tSuccessRes.data);
      failed++;
      failures.push({ category: 'TRANSFER', testName: '1.1: Successful Transfer', error: tSuccessRes.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 1.2: Kiểm tra trạng thái Bàn nguồn B01 (Available, currentOrderId giải phóng)
    const checkT1 = await request(`/tables/${table1Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    if (checkT1.data?.data?.status === 'Available' && !checkT1.data?.data?.currentOrderId && checkT1.data?.data?.totalGuests === 0) {
      pass('1.2: Bàn nguồn B01 giải phóng chính xác', 'Status = Available, currentOrderId = null, totalGuests = 0');
      passed++;
    } else {
      fail('1.2: Bàn nguồn B01 giải phóng', checkT1.data);
      failed++;
      failures.push({ category: 'TRANSFER', testName: '1.2: Source Table State', error: checkT1.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 1.3: Kiểm tra trạng thái Bàn đích B02 (Occupied, currentOrderId = order1Id)
    const checkT2 = await request(`/tables/${table2Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    const t2OrderId = checkT2.data?.data?.currentOrderId?._id || checkT2.data?.data?.currentOrderId;
    if (checkT2.data?.data?.status === 'Occupied' && t2OrderId === order1Id) {
      pass('1.3: Bàn đích B02 tiếp nhận đơn chính xác', `Status = Occupied, currentOrderId = ${order1Id}`);
      passed++;
    } else {
      fail('1.3: Bàn đích B02 tiếp nhận đơn', checkT2.data);
      failed++;
      failures.push({ category: 'TRANSFER', testName: '1.3: Target Table State', error: checkT2.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 1.4: Kiểm tra Order sau khi chuyển: tableId & tableName đã cập nhật, rounds[] & items[] nguyên vẹn
    const checkO1 = await request(`/orders/${order1Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    const orderDoc = checkO1.data?.data;
    const has2Rounds = orderDoc?.rounds?.length === 2;
    const has2Items = orderDoc?.items?.length === 2;
    const isTableNameUpdated = orderDoc?.tableName === 'Bàn 02';
    const isTableIdUpdated = orderDoc?.tableId?.toString() === table2Id || orderDoc?.tableId?._id?.toString() === table2Id;
    const isSnapshotsIntact = orderDoc?.items?.[0]?.price === 60000 && orderDoc?.items?.[1]?.price === 90000;

    if (has2Rounds && has2Items && isTableNameUpdated && isTableIdUpdated && isSnapshotsIntact) {
      pass('1.4: Bảo toàn Order sau transfer', 'tableId & tableName cập nhật B02, 2 rounds và 2 items giữ nguyên vẹn');
      passed++;
    } else {
      fail('1.4: Bảo toàn Order sau transfer', { has2Rounds, has2Items, isTableNameUpdated, isTableIdUpdated, isSnapshotsIntact });
      failed++;
      failures.push({ category: 'TRANSFER', testName: '1.4: Order Integrity', error: checkO1.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 1.5: Chặn chuyển từ bàn trống / không có đơn (B01 hiện đang Available)
    const tEmptySource = await request('/tables/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({ fromTableId: table1Id, toTableId: table3Id }),
    });
    if (tEmptySource.status === 400) {
      pass('1.5: Chặn chuyển từ bàn nguồn trống', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('1.5: Chặn chuyển từ bàn nguồn trống', `Status: ${tEmptySource.status}`);
      failed++;
      failures.push({ category: 'TRANSFER', testName: '1.5: Invalid Source', error: tEmptySource.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 1.6: Chặn chuyển sang bàn không tồn tại (Invalid target ID)
    const fakeTableId = new Types.ObjectId().toString();
    const tFakeTarget = await request('/tables/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({ fromTableId: table2Id, toTableId: fakeTableId }),
    });
    if (tFakeTarget.status === 404) {
      pass('1.6: Chặn chuyển sang bàn đích không tồn tại', 'HTTP 404 Not Found thành công');
      passed++;
    } else {
      fail('1.6: Chặn chuyển sang bàn đích không tồn tại', `Status: ${tFakeTarget.status}`);
      failed++;
      failures.push({ category: 'TRANSFER', testName: '1.6: Invalid Target', error: tFakeTarget.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 1.7: Chặn chuyển cùng bàn nguồn và đích (fromTableId === toTableId)
    const tSameTable = await request('/tables/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({ fromTableId: table2Id, toTableId: table2Id }),
    });
    if (tSameTable.status === 400) {
      pass('1.7: Chặn chuyển cùng một bàn', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('1.7: Chặn chuyển cùng một bàn', `Status: ${tSameTable.status}`);
      failed++;
      failures.push({ category: 'TRANSFER', testName: '1.7: Same Source Target', error: tSameTable.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // Tạo đơn hàng trên Bàn 03 để biến B03 thành Occupied
    await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({
        tableId: table3Id,
        items: [{ menuItemId: menuItem1Id, quantity: 1 }],
      }),
    });

    // 1.8: Chặn chuyển sang bàn đích đang có khách (Occupied target)
    const tOccupiedTarget = await request('/tables/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({ fromTableId: table2Id, toTableId: table3Id }),
    });
    if (tOccupiedTarget.status === 400) {
      pass('1.8: Chặn chuyển vào bàn đích đang Occupied', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('1.8: Chặn chuyển vào bàn đích đang Occupied', `Status: ${tOccupiedTarget.status}`);
      failed++;
      failures.push({ category: 'TRANSFER', testName: '1.8: Occupied Target', error: tOccupiedTarget.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // ========================================================================
    // 2. MERGE TESTS
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 2: KIỂM THỬ GỘP BÀN (MERGE TABLES) ---${colors.reset}`);

    // Bàn B02 đang có order1Id (2 rounds: 2 món Phở + 1 Lẩu)
    // Bàn B03 đang có order3 (1 round: 1 món Phở)
    // 2.1: Gộp B02 vào B03 thành công
    const mergeRes = await request('/tables/merge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({
        fromTableIds: [table2Id],
        targetTableId: table3Id,
        note: 'Gộp 2 nhóm bạn ngồi chung bàn B03',
      }),
    });

    if (mergeRes.status === 200 && mergeRes.data?.data?.success) {
      pass('2.1: Gộp bàn hợp lệ (Merge B02 -> B03)', 'HTTP 200 OK');
      passed++;
    } else {
      fail('2.1: Gộp bàn hợp lệ', mergeRes.data);
      failed++;
      failures.push({ category: 'MERGE', testName: '2.1: Valid Merge', error: mergeRes.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 2.2: Kiểm tra bàn nguồn B02 được giải phóng về Available
    const checkT2AfterMerge = await request(`/tables/${table2Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    if (checkT2AfterMerge.data?.data?.status === 'Available' && !checkT2AfterMerge.data?.data?.currentOrderId) {
      pass('2.2: Bàn nguồn B02 giải phóng sạch sau merge', 'Status = Available, currentOrderId = null');
      passed++;
    } else {
      fail('2.2: Bàn nguồn B02 giải phóng sau merge', checkT2AfterMerge.data);
      failed++;
      failures.push({ category: 'MERGE', testName: '2.2: Source Cleanup', error: checkT2AfterMerge.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 2.3: Kiểm tra đơn hàng cũ B02 (order1Id) chuyển Cancelled và có audit trail
    const checkOldOrder = await request(`/orders/${order1Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    if (checkOldOrder.data?.data?.status === 'Cancelled' && checkOldOrder.data?.data?.cancelReason?.includes('Đã gộp vào bàn')) {
      pass('2.3: Đơn hàng nguồn cũ chuyển Cancelled an toàn', 'Status = Cancelled, cancelReason có lưu vết');
      passed++;
    } else {
      fail('2.3: Đơn hàng nguồn cũ chuyển Cancelled', checkOldOrder.data);
      failed++;
      failures.push({ category: 'MERGE', testName: '2.3: Source Order Cancelled', error: checkOldOrder.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 2.4: Kiểm tra đơn hàng đích trên B03: rounds được bảo toàn và remap không trùng số
    const checkT3 = await request(`/tables/${table3Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    const targetOrderId = checkT3.data?.data?.currentOrderId?._id || checkT3.data?.data?.currentOrderId;
    const checkTargetOrder = await request(`/orders/${targetOrderId}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    const targetOrderDoc = checkTargetOrder.data?.data;

    // Trước khi gộp: B03 có 1 round, 1 món. B02 có 2 rounds, 2 items.
    // Sau khi gộp: Tổng cộng 3 rounds, 3 items.
    const roundsCount = targetOrderDoc?.rounds?.length;
    const itemsCount = targetOrderDoc?.items?.length;
    const roundNumbers = targetOrderDoc?.rounds?.map((r: any) => r.roundNumber);
    const hasUniqueRounds = new Set(roundNumbers).size === roundsCount;

    if (roundsCount === 3 && itemsCount === 3 && hasUniqueRounds) {
      pass('2.4: Bảo toàn toàn bộ Rounds và Items sau khi gộp', `Rounds: ${roundsCount} (số round: [${roundNumbers.join(', ')}]), Items: ${itemsCount}`);
      passed++;
    } else {
      fail('2.4: Bảo toàn Rounds và Items sau gộp', { roundsCount, itemsCount, roundNumbers });
      failed++;
      failures.push({ category: 'MERGE', testName: '2.4: Rounds/Items Preservation', error: { roundsCount, itemsCount, roundNumbers }, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 2.5: Tính đúng tổng tiền subTotal và totalAmount sau khi gộp
    // Món 1 B03: 1 Phở = 60,000. Món B02: 2 Phở (120k) + 1 Lẩu (90k) = 210,000. Tổng = 270,000.
    const expectedSubTotal = 270000;
    if (targetOrderDoc?.subTotal === expectedSubTotal && targetOrderDoc?.totalAmount === expectedSubTotal) {
      pass('2.5: Tính toán tài chính sau gộp chính xác', `subTotal = ${targetOrderDoc?.subTotal} đ, totalAmount = ${targetOrderDoc?.totalAmount} đ`);
      passed++;
    } else {
      fail('2.5: Tính toán tài chính sau gộp', { actual: targetOrderDoc?.subTotal, expected: expectedSubTotal });
      failed++;
      failures.push({ category: 'MERGE', testName: '2.5: Merge Financials', error: { actual: targetOrderDoc?.subTotal, expected: expectedSubTotal }, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 2.6: Chặn gộp bàn vào chính nó
    const mSelfRes = await request('/tables/merge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({ fromTableIds: [table3Id], targetTableId: table3Id }),
    });
    if (mSelfRes.status === 400) {
      pass('2.6: Chặn gộp bàn vào chính nó', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('2.6: Chặn gộp bàn vào chính nó', `Status: ${mSelfRes.status}`);
      failed++;
      failures.push({ category: 'MERGE', testName: '2.6: Self Merge Prevention', error: mSelfRes.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 2.7: Chặn gộp các bàn khi không có bất kỳ đơn hàng hoạt động nào
    // B01 và B04 đều đang Available, không có order
    const mNoOrdersRes = await request('/tables/merge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({ fromTableIds: [table1Id], targetTableId: table4Id }),
    });
    if (mNoOrdersRes.status === 400) {
      pass('2.7: Chặn gộp khi không có đơn hàng hoạt động', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('2.7: Chặn gộp khi không có đơn hàng hoạt động', `Status: ${mNoOrdersRes.status}`);
      failed++;
      failures.push({ category: 'MERGE', testName: '2.7: No Active Orders', error: mNoOrdersRes.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // ========================================================================
    // 3. MOVE ITEM & SPLIT QUANTITY TESTS
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 3: KIỂM THỬ CHUYỂN MÓN & TÁCH MÓN (MOVE ITEM) ---${colors.reset}`);

    // Bàn B03 hiện có 3 items:
    // Item 0: Phở (qty 1)
    // Item 1: Phở (qty 2)
    // Item 2: Lẩu (qty 1)
    const itemToMove = targetOrderDoc?.items?.[1]; // Phở qty 2
    const itemToMoveId = itemToMove?._id?.toString();

    // 3.1: Tách 1 phần số lượng món (qty 1 trên 2) từ B03 sang B01 (B01 đang Available)
    const movePartialRes = await request('/tables/move-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({
        fromTableId: table3Id,
        toTableId: table1Id,
        items: [{ itemId: itemToMoveId, quantity: 1 }],
        reason: 'Khách tách 1 tô Phở sang Bàn 01 cho bạn ngồi riêng',
      }),
    });

    if (movePartialRes.status === 200 && movePartialRes.data?.data?.success) {
      pass('3.1: Tách 1 phần số lượng món sang bàn mới thành công', 'Chuyển 1/2 tô Phở từ B03 sang B01');
      passed++;
    } else {
      fail('3.1: Tách 1 phần số lượng món', movePartialRes.data);
      failed++;
      failures.push({ category: 'MOVE_ITEM', testName: '3.1: Partial Quantity Move', error: movePartialRes.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 3.2: Bàn đích B01 tự động chuyển sang Occupied và có đơn hàng mới
    const checkT1AfterMove = await request(`/tables/${table1Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    const newOrderOnT1Id = checkT1AfterMove.data?.data?.currentOrderId?._id || checkT1AfterMove.data?.data?.currentOrderId;
    if (checkT1AfterMove.data?.data?.status === 'Occupied' && newOrderOnT1Id) {
      pass('3.2: Bàn đích B01 tự động Occupied mang đơn mới', `Status = Occupied, orderId = ${newOrderOnT1Id}`);
      passed++;
    } else {
      fail('3.2: Bàn đích B01 tự động Occupied', checkT1AfterMove.data);
      failed++;
      failures.push({ category: 'MOVE_ITEM', testName: '3.2: Target Auto Occupied', error: checkT1AfterMove.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 3.3: Kiểm tra đơn hàng B01: mang đúng món Phở (qty: 1, giá: 60,000, subTotal: 60,000)
    const checkOrderT1 = await request(`/orders/${newOrderOnT1Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    const orderT1Doc = checkOrderT1.data?.data;
    if (orderT1Doc?.items?.length === 1 && orderT1Doc?.items?.[0]?.quantity === 1 && orderT1Doc?.subTotal === 60000) {
      pass('3.3: Đơn hàng mới B01 bảo toàn snapshot giá món', 'Phở x1, giá 60k, subTotal 60k');
      passed++;
    } else {
      fail('3.3: Đơn hàng mới B01 bảo toàn snapshot', checkOrderT1.data);
      failed++;
      failures.push({ category: 'MOVE_ITEM', testName: '3.3: Target Order Snapshot', error: checkOrderT1.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 3.4: Kiểm tra đơn hàng nguồn B03: món Phở giảm còn qty 1, subTotal giảm từ 270k xuống 210k
    const checkOrderT3AfterMove = await request(`/orders/${targetOrderId}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    const orderT3Doc = checkOrderT3AfterMove.data?.data;
    const reducedItem = orderT3Doc?.items?.find((it: any) => it._id.toString() === itemToMoveId);
    if (reducedItem?.quantity === 1 && orderT3Doc?.subTotal === 210000) {
      pass('3.4: Đơn hàng nguồn B03 cập nhật số lượng và tổng tiền chính xác', 'Phở giảm còn qty: 1, subTotal: 210,000 đ');
      passed++;
    } else {
      fail('3.4: Đơn hàng nguồn B03 cập nhật số lượng', { reducedItemQty: reducedItem?.quantity, subTotal: orderT3Doc?.subTotal });
      failed++;
      failures.push({ category: 'MOVE_ITEM', testName: '3.4: Source Order Consistency', error: orderT3Doc, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 3.5: Chuyển toàn bộ các món còn lại của B03 sang B01 (Chuyển hết món -> B03 giải phóng)
    const remainingItems = orderT3Doc?.items?.map((it: any) => ({ itemId: it._id.toString() })) || [];
    const moveAllRemainingRes = await request('/tables/move-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({
        fromTableId: table3Id,
        toTableId: table1Id,
        items: remainingItems,
        reason: 'Chuyển toàn bộ món còn lại sang B01',
      }),
    });

    if (moveAllRemainingRes.status === 200) {
      const checkT3Empty = await request(`/tables/${table3Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
      const checkO3Cancelled = await request(`/orders/${targetOrderId}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });

      if (checkT3Empty.data?.data?.status === 'Available' && checkO3Cancelled.data?.data?.status === 'Cancelled') {
        pass('3.5: Chuyển hết toàn bộ món -> Bàn nguồn B03 tự giải phóng Available & Đơn nguồn Cancelled', 'B03 = Available, Order B03 = Cancelled');
        passed++;
      } else {
        fail('3.5: Chuyển hết món giải phóng bàn', { t3Status: checkT3Empty.data?.data?.status, o3Status: checkO3Cancelled.data?.data?.status });
        failed++;
        failures.push({ category: 'MOVE_ITEM', testName: '3.5: Empty Source Cleanup', error: { checkT3Empty: checkT3Empty.data, checkO3: checkO3Cancelled.data }, classification: 'IMPLEMENTATION_DEFECT' });
      }
    } else {
      fail('3.5: Chuyển toàn bộ món còn lại', moveAllRemainingRes.data);
      failed++;
      failures.push({ category: 'MOVE_ITEM', testName: '3.5: Move All Items', error: moveAllRemainingRes.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 3.6: Chặn chuyển món với ID không tồn tại (Invalid item ID)
    const fakeItemId = new Types.ObjectId().toString();
    const moveFakeItem = await request('/tables/move-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({
        fromTableId: table1Id,
        toTableId: table2Id,
        items: [{ itemId: fakeItemId }],
      }),
    });
    if (moveFakeItem.status === 404) {
      pass('3.6: Chặn chuyển món không tồn tại trong đơn', 'HTTP 404 Not Found thành công');
      passed++;
    } else {
      fail('3.6: Chặn chuyển món không tồn tại', `Status: ${moveFakeItem.status}`);
      failed++;
      failures.push({ category: 'MOVE_ITEM', testName: '3.6: Invalid Item ID', error: moveFakeItem.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 3.7: Chặn chuyển số lượng vượt quá số lượng hiện có
    const currentT1Items = (await request(`/orders/${newOrderOnT1Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } })).data?.data?.items;
    const item1OnT1 = currentT1Items?.[0];
    const moveExcessQty = await request('/tables/move-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({
        fromTableId: table1Id,
        toTableId: table2Id,
        items: [{ itemId: item1OnT1?._id?.toString(), quantity: 999 }],
      }),
    });
    if (moveExcessQty.status === 400) {
      pass('3.7: Chặn chuyển số lượng lớn hơn số lượng hiện có', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('3.7: Chặn chuyển số lượng lớn hơn hiện có', `Status: ${moveExcessQty.status}`);
      failed++;
      failures.push({ category: 'MOVE_ITEM', testName: '3.7: Excess Quantity Move', error: moveExcessQty.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // ========================================================================
    // 4. SPLIT BILL & SEPARATE SETTLEMENT TESTS
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 4: KIỂM THỬ TÁCH BILL & THANH TOÁN RIÊNG BIỆT (SPLIT BILL) ---${colors.reset}`);

    // Bàn B01 hiện có toàn bộ các món (Tổng tiền: 270,000 đ).
    // Tách 1 món Lẩu (90,000 đ) sang Bàn B02 để thanh toán riêng (Split Bill thành 2 hóa đơn: 180k và 90k)
    const updatedT1Doc = (await request(`/orders/${newOrderOnT1Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } })).data?.data;
    const lauItem = updatedT1Doc?.items?.find((it: any) => it.name.includes('Lẩu'));
    const lauItemId = lauItem?._id?.toString();

    const splitBillMoveRes = await request('/tables/move-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({
        fromTableId: table1Id,
        toTableId: table2Id,
        items: [{ itemId: lauItemId }],
        reason: 'Khách yêu cầu tách hóa đơn món Lẩu trả riêng',
      }),
    });

    const newOrderOnT2Id = (await request(`/tables/${table2Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } })).data?.data?.currentOrderId?._id ||
      (await request(`/tables/${table2Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } })).data?.data?.currentOrderId;

    // 4.1: Kiểm tra tổng tiền 2 đơn sau khi tách bill
    const orderT1AfterSplit = (await request(`/orders/${newOrderOnT1Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } })).data?.data;
    const orderT2AfterSplit = (await request(`/orders/${newOrderOnT2Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } })).data?.data;

    // Order 1: 180,000 đ (các món Phở)
    // Order 2: 90,000 đ (món Lẩu)
    // Tổng cộng: 270,000 đ (Không thất thoát, không nhân đôi)
    const sumTotals = (orderT1AfterSplit?.totalAmount || 0) + (orderT2AfterSplit?.totalAmount || 0);

    if (orderT1AfterSplit?.totalAmount === 180000 && orderT2AfterSplit?.totalAmount === 90000 && sumTotals === 270000) {
      pass('4.1: Tách bill bảo toàn 100% doanh thu (Zero Loss / Duplication)', 'Đơn 1: 180k, Đơn 2: 90k, Tổng: 270k chính xác');
      passed++;
    } else {
      fail('4.1: Tách bill bảo toàn doanh thu', { order1: orderT1AfterSplit?.totalAmount, order2: orderT2AfterSplit?.totalAmount, sum: sumTotals });
      failed++;
      failures.push({ category: 'SPLIT_BILL', testName: '4.1: Revenue Preservation', error: { order1: orderT1AfterSplit?.totalAmount, order2: orderT2AfterSplit?.totalAmount }, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 4.2: Thanh toán Hóa đơn 1 (Đơn Bàn 01) độc lập bằng VietQR
    const payT1Res = await request(`/orders/${newOrderOnT1Id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR' }),
    });

    if (payT1Res.status === 200 && payT1Res.data?.data?.order?.isPaid) {
      pass('4.2: Thanh toán bill tách 1 thành công (B01 Paid)', 'Đơn 1 chuyển Paid, Bàn 01 giải phóng Available');
      passed++;
    } else {
      fail('4.2: Thanh toán bill tách 1', payT1Res.data);
      failed++;
      failures.push({ category: 'SPLIT_BILL', testName: '4.2: Settle Split Bill 1', error: payT1Res.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 4.3: Bàn B02 vẫn giữ nguyên trạng thái Occupied chưa thanh toán
    const checkT2StillOccupied = await request(`/tables/${table2Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    if (checkT2StillOccupied.data?.data?.status === 'Occupied') {
      pass('4.3: Bàn B02 không bị ảnh hưởng khi thanh toán B01', 'Status B02 vẫn là Occupied');
      passed++;
    } else {
      fail('4.3: Bàn B02 giữ nguyên trạng thái', checkT2StillOccupied.data);
      failed++;
      failures.push({ category: 'SPLIT_BILL', testName: '4.3: Unsettled Bill Isolation', error: checkT2StillOccupied.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 4.4: Thanh toán Hóa đơn 2 (Đơn Bàn 02) bằng Cash
    const payT2Res = await request(`/orders/${newOrderOnT2Id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash', cashGiven: 100000 }),
    });

    if (payT2Res.status === 200 && payT2Res.data?.data?.order?.isPaid && payT2Res.data?.data?.changeAmount === 10000) {
      pass('4.4: Thanh toán bill tách 2 thành công (B02 Paid)', 'Tiền thừa = 10,000 đ, Bàn 02 giải phóng Available');
      passed++;
    } else {
      fail('4.4: Thanh toán bill tách 2', payT2Res.data);
      failed++;
      failures.push({ category: 'SPLIT_BILL', testName: '4.4: Settle Split Bill 2', error: payT2Res.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 4.5: Cả 2 bàn B01 và B02 đều đã giải phóng sạch sẽ về Available
    const t1Final = await request(`/tables/${table1Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    const t2Final = await request(`/tables/${table2Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    if (t1Final.data?.data?.status === 'Available' && t2Final.data?.data?.status === 'Available') {
      pass('4.5: Cả 2 bàn giải phóng sạch sẽ sau khi tất cả split bills thanh toán xong', 'B01 = Available, B02 = Available');
      passed++;
    } else {
      fail('4.5: Giải phóng bàn sau split bills', { t1: t1Final.data?.data?.status, t2: t2Final.data?.data?.status });
      failed++;
      failures.push({ category: 'SPLIT_BILL', testName: '4.5: Clean Tables Settlement', error: { t1Final: t1Final.data, t2Final: t2Final.data }, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // ========================================================================
    // 5. TENANT & BRANCH ISOLATION TESTS
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 5: KIỂM THỬ PHÂN LẬP ĐA NGƯỜI THUÊ & CHI NHÁNH (ISOLATION) ---${colors.reset}`);

    // Tạo đơn hàng trên B01 Nhà hàng A
    const orderIso = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({
        tableId: table1Id,
        items: [{ menuItemId: menuItem1Id, quantity: 1 }],
      }),
    });
    const orderIsoId = orderIso.data?.data?._id;

    // 5.1: Chặn Nhà hàng B chuyển bàn của Nhà hàng A (Multi-Tenant Transfer Protection)
    const crossRestTransfer = await request('/tables/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierBToken}` },
      body: JSON.stringify({
        fromTableId: table1Id, // Của Quán A
        toTableId: tableB1Id,  // Của Quán B
      }),
    });
    if (crossRestTransfer.status === 404 || crossRestTransfer.status === 403) {
      pass('5.1: Chặn chuyển bàn xuyên nhà hàng (Multi-Tenant Transfer)', `HTTP ${crossRestTransfer.status} thành công`);
      passed++;
    } else {
      fail('5.1: Chặn chuyển bàn xuyên nhà hàng', `Status: ${crossRestTransfer.status}`);
      failed++;
      failures.push({ category: 'TENANT_ISOLATION', testName: '5.1: Multi-Tenant Transfer', error: crossRestTransfer.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 5.2: Chặn chuyển bàn giữa 2 chi nhánh khác nhau của cùng Nhà hàng A (Cross-Branch Transfer Protection)
    // Chuyển từ B01 (CN1) sang B_CN2 (CN2)
    const crossBranchTransfer = await request('/tables/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fromTableId: table1Id,
        toTableId: tableA2Id,
      }),
    });
    if (crossBranchTransfer.status === 400 && crossBranchTransfer.data?.message?.includes('chi nhánh')) {
      pass('5.2: Chặn chuyển bàn giữa các chi nhánh khác nhau (Cross-Branch Transfer)', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('5.2: Chặn chuyển bàn giữa các chi nhánh', crossBranchTransfer.data);
      failed++;
      failures.push({ category: 'TENANT_ISOLATION', testName: '5.2: Cross-Branch Transfer', error: crossBranchTransfer.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 5.3: Chặn gộp bàn giữa các chi nhánh khác nhau (Cross-Branch Merge Protection)
    const crossBranchMerge = await request('/tables/merge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fromTableIds: [tableA2Id],
        targetTableId: table1Id,
      }),
    });
    if (crossBranchMerge.status === 400 && crossBranchMerge.data?.message?.includes('chi nhánh')) {
      pass('5.3: Chặn gộp bàn giữa các chi nhánh khác nhau (Cross-Branch Merge)', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('5.3: Chặn gộp bàn giữa các chi nhánh', crossBranchMerge.data);
      failed++;
      failures.push({ category: 'TENANT_ISOLATION', testName: '5.3: Cross-Branch Merge', error: crossBranchMerge.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 5.4: Chặn chuyển món giữa các chi nhánh khác nhau (Cross-Branch Move Items Protection)
    const itemOnB1 = (await request(`/orders/${orderIsoId}`, { headers: { Authorization: `Bearer ${cashierAToken}` } })).data?.data?.items?.[0];
    const crossBranchMove = await request('/tables/move-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fromTableId: table1Id,
        toTableId: tableA2Id,
        items: [{ itemId: itemOnB1?._id?.toString() }],
      }),
    });
    if (crossBranchMove.status === 400 && crossBranchMove.data?.message?.includes('chi nhánh')) {
      pass('5.4: Chặn chuyển món giữa các chi nhánh khác nhau (Cross-Branch Move Items)', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('5.4: Chặn chuyển món giữa các chi nhánh', crossBranchMove.data);
      failed++;
      failures.push({ category: 'TENANT_ISOLATION', testName: '5.4: Cross-Branch Move Items', error: crossBranchMove.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // ========================================================================
    // 6. CONCURRENCY & RACE CONDITIONS TESTS
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 6: KIỂM THỬ ĐỒNG THỜI & BẤT BIẾN TOÀN VẸN (CONCURRENCY) ---${colors.reset}`);

    // Bàn B01 đang Occupied với orderIsoId.
    // 6.1: Conflicting Transfer Race: 2 request đồng thời chuyển B01 sang 2 bàn khác nhau (B02 và B04)
    const [tRace1, tRace2] = await Promise.all([
      request('/tables/transfer', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierAToken}` },
        body: JSON.stringify({ fromTableId: table1Id, toTableId: table2Id }),
      }),
      request('/tables/transfer', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierAToken}` },
        body: JSON.stringify({ fromTableId: table1Id, toTableId: table4Id }),
      }),
    ]);

    const statuses = [tRace1.status, tRace2.status].sort();
    // Kỳ vọng: Đúng 1 request thành công (200), 1 request thất bại (400 hoặc 409 do bàn nguồn đã trống hoặc đang được xử lý)
    const isOneSuccessOneFail = statuses[0] === 200 && (statuses[1] === 400 || statuses[1] === 409);

    if (isOneSuccessOneFail) {
      pass('6.1: Race condition: 2 request Transfer đồng thời từ cùng 1 bàn nguồn', `Kết quả: [${statuses.join(', ')}] -> Chính xác 1 chuyển thành công, 1 bị chặn`);
      passed++;
    } else {
      fail('6.1: Race condition transfer đồng thời', { tRace1: tRace1.status, tRace2: tRace2.status });
      failed++;
      failures.push({ category: 'CONCURRENCY', testName: '6.1: Conflicting Transfer Race', error: { tRace1: tRace1.data, tRace2: tRace2.data }, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 6.2: Kiểm tra tính nhất quán sau race: Bàn nguồn B01 phải là Available, chỉ có DUY NHẤT 1 bàn đích Occupied
    const t1RaceCheck = await request(`/tables/${table1Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    const t2RaceCheck = await request(`/tables/${table2Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    const t4RaceCheck = await request(`/tables/${table4Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });

    const occupiedTargets = [t2RaceCheck.data?.data?.status, t4RaceCheck.data?.data?.status].filter((s) => s === 'Occupied');

    if (t1RaceCheck.data?.data?.status === 'Available' && occupiedTargets.length === 1) {
      pass('6.2: Toàn vẹn dữ liệu sau race transfer (No Stale/Duplicate Table State)', 'B01 = Available, đúng 1 bàn đích chuyển Occupied');
      passed++;
    } else {
      fail('6.2: Toàn vẹn dữ liệu sau race transfer', { t1: t1RaceCheck.data?.data?.status, occupiedCount: occupiedTargets.length });
      failed++;
      failures.push({ category: 'CONCURRENCY', testName: '6.2: Transfer State Consistency', error: { t1: t1RaceCheck.data, t2: t2RaceCheck.data, t4: t4RaceCheck.data }, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 6.3: Conflicting Move Item Race: 2 request đồng thời di chuyển CÙNG 1 item sang 2 bàn khác nhau
    // Tìm bàn đích đang giữ orderIso
    const winnerTableId = t2RaceCheck.data?.data?.status === 'Occupied' ? table2Id : table4Id;
    const winnerOrderDoc = (await request(`/orders/${orderIsoId}`, { headers: { Authorization: `Bearer ${cashierAToken}` } })).data?.data;
    const raceItemId = winnerOrderDoc?.items?.[0]?._id?.toString();

    const [moveRace1, moveRace2] = await Promise.all([
      request('/tables/move-items', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierAToken}` },
        body: JSON.stringify({ fromTableId: winnerTableId, toTableId: table1Id, items: [{ itemId: raceItemId }] }),
      }),
      request('/tables/move-items', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierAToken}` },
        body: JSON.stringify({ fromTableId: winnerTableId, toTableId: table3Id, items: [{ itemId: raceItemId }] }),
      }),
    ]);

    const moveStatuses = [moveRace1.status, moveRace2.status].sort();
    const isOneMoveSuccessOneFail = moveStatuses[0] === 200 && (moveStatuses[1] === 400 || moveStatuses[1] === 404);

    if (isOneMoveSuccessOneFail) {
      pass('6.3: Race condition: 2 request Move Item đồng thời cho cùng 1 món', `Kết quả: [${moveStatuses.join(', ')}] -> Món chỉ chuyển đúng 1 lần, không trùng lặp`);
      passed++;
    } else {
      fail('6.3: Race condition move item', { moveRace1: moveRace1.status, moveRace2: moveRace2.status });
      failed++;
      failures.push({ category: 'CONCURRENCY', testName: '6.3: Concurrent Item Movement', error: { moveRace1: moveRace1.data, moveRace2: moveRace2.data }, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 6.4: Kiểm tra không có trạng thái treo (No Stale Order or Table State)
    const allTables = (await request('/tables', { headers: { Authorization: `Bearer ${cashierAToken}` } })).data?.data || [];
    let stateAnomalyFound = false;

    for (const tbl of allTables) {
      if (tbl.status === 'Available' && tbl.currentOrderId) {
        stateAnomalyFound = true;
      }
      if (tbl.status === 'Occupied' && !tbl.currentOrderId) {
        stateAnomalyFound = true;
      }
    }

    if (!stateAnomalyFound) {
      pass('6.4: Không có bất thường trạng thái bàn (Zero Stale State Invariant)', 'Mọi bàn Available đều không có order, mọi bàn Occupied đều có currentOrderId');
      passed++;
    } else {
      fail('6.4: Bất thường trạng thái bàn sau chuỗi thao tác', allTables);
      failed++;
      failures.push({ category: 'CONCURRENCY', testName: '6.4: Stale State Invariant', error: allTables, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // ========================================================================
    // 7. REGRESSION TESTS CHO CÁC DEFECT ĐÃ KHẮC PHỤC
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 7: KIỂM THỬ HỒI QUY CHO CÁC DEFECT ĐÃ SỬA (REGRESSION SUITE) ---${colors.reset}`);

    // Tạo các bàn chuyên biệt cho Regression Suite để đảm bảo độc lập tuyệt đối
    const tReg1 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ code: `REG_B01_${timestamp}`, name: 'Bàn Reg 01', zoneId: zoneAId, branchId: branchAId, capacity: 4 }),
    });
    const regTable1Id = tReg1.data?.data?._id || tReg1.data?.data?.id;

    const tReg2 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ code: `REG_B02_${timestamp}`, name: 'Bàn Reg 02', zoneId: zoneAId, branchId: branchAId, capacity: 4 }),
    });
    const regTable2Id = tReg2.data?.data?._id || tReg2.data?.data?.id;

    const tReg3 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ code: `REG_B03_${timestamp}`, name: 'Bàn Reg 03', zoneId: zoneAId, branchId: branchAId, capacity: 4 }),
    });
    const regTable3Id = tReg3.data?.data?._id || tReg3.data?.data?.id;

    const tReg4 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ code: `REG_B04_${timestamp}`, name: 'Bàn Reg 04', zoneId: zoneAId, branchId: branchAId, capacity: 4 }),
    });
    const regTable4Id = tReg4.data?.data?._id || tReg4.data?.data?.id;

    // 7.1: Hồi quy Defect 1 - Hỗ trợ alias cashGiven trong PayOrderDto tính tiền thừa chính xác
    const regOrderRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({
        tableId: regTable1Id,
        items: [{ menuItemId: menuItem2Id, quantity: 1 }], // Trà Đào Cam Sả: 35,000 đ
      }),
    });
    const regOrderId = regOrderRes.data?.data?._id || regOrderRes.data?.data?.id;

    const regPayRes = await request(`/orders/${regOrderId}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash', cashGiven: 100000 }),
    });

    if (
      regPayRes.status === 200 &&
      regPayRes.data?.data?.order?.isPaid &&
      regPayRes.data?.data?.changeAmount === 10000
    ) {
      pass('7.1: [Regression Defect 1] Hỗ trợ alias cashGiven tính tiền thừa chính xác', 'Total: 90k, Khách đưa: 100k -> Tiền thừa: 10,000 đ');
      passed++;
    } else {
      fail('7.1: [Regression Defect 1] Hỗ trợ alias cashGiven', regPayRes.data);
      failed++;
      failures.push({ category: 'REGRESSION', testName: '7.1: CashGiven Alias Regression', error: regPayRes.data, classification: 'IMPLEMENTATION_DEFECT' });
    }

    // 7.2: Hồi quy Defect 2 & 3 - Atomic Transfer CAS Protection (Race condition transfer đồng thời)
    const regOrderRaceRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierAToken}` },
      body: JSON.stringify({
        tableId: regTable2Id,
        items: [{ menuItemId: menuItem1Id, quantity: 2 }],
      }),
    });
    const regRaceOrderId = regOrderRaceRes.data?.data?._id || regOrderRaceRes.data?.data?.id;

    // Gửi đồng thời 2 request chuyển bàn từ regTable2Id sang regTable3Id và regTable4Id
    const [raceRes1, raceRes2] = await Promise.all([
      request('/tables/transfer', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierAToken}` },
        body: JSON.stringify({ fromTableId: regTable2Id, toTableId: regTable3Id }),
      }),
      request('/tables/transfer', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierAToken}` },
        body: JSON.stringify({ fromTableId: regTable2Id, toTableId: regTable4Id }),
      }),
    ]);

    const race2Statuses = [raceRes1.status, raceRes2.status].sort();
    const isOneSuccessOneConflict = race2Statuses[0] === 200 && (race2Statuses[1] === 409 || race2Statuses[1] === 400);

    const checkRegT2 = await request(`/tables/${regTable2Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    const checkRegT3 = await request(`/tables/${regTable3Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });
    const checkRegT4 = await request(`/tables/${regTable4Id}`, { headers: { Authorization: `Bearer ${cashierAToken}` } });

    const occupiedDestCount = [
      checkRegT3.data?.data?.status,
      checkRegT4.data?.data?.status,
    ].filter((s) => s === 'Occupied').length;

    if (
      isOneSuccessOneConflict &&
      checkRegT2.data?.data?.status === 'Available' &&
      occupiedDestCount === 1
    ) {
      pass(
        '7.2: [Regression Defect 2 & 3] Atomic Transfer CAS chặn hoàn toàn race condition đa luồng',
        `2 request đồng thời -> [${race2Statuses.join(', ')}] -> Đúng 1 thành công (200), 1 bị chặn (409), đúng 1 bàn đích Occupied`,
      );
      passed++;
    } else {
      fail('7.2: [Regression Defect 2 & 3] Atomic Transfer CAS race condition', {
        statuses: race2Statuses,
        occupiedDestCount,
        t2Status: checkRegT2.data?.data?.status,
      });
      failed++;
      failures.push({
        category: 'REGRESSION',
        testName: '7.2: Atomic Transfer CAS Multi-Thread',
        error: { statuses: race2Statuses, occupiedDestCount },
        classification: 'IMPLEMENTATION_DEFECT',
      });
    }

    // 7.3: Hồi quy Defect 4 - Move Items OCC Concurrency Retry (Không bao giờ văng 500 VersionError)
    const currentOccupiedTableId =
      checkRegT3.data?.data?.status === 'Occupied' ? regTable3Id : regTable4Id;

    const currentOrderDoc = (await request(`/orders/${regRaceOrderId}`, { headers: { Authorization: `Bearer ${cashierAToken}` } })).data?.data;
    const targetItemId = currentOrderDoc?.items?.[0]?._id?.toString();

    // Gửi 2 request di chuyển cùng 1 món đồng thời sang regTable1Id
    const [occMove1, occMove2] = await Promise.all([
      request('/tables/move-items', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierAToken}` },
        body: JSON.stringify({
          fromTableId: currentOccupiedTableId,
          toTableId: regTable1Id,
          items: [{ itemId: targetItemId }],
        }),
      }),
      request('/tables/move-items', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierAToken}` },
        body: JSON.stringify({
          fromTableId: currentOccupiedTableId,
          toTableId: regTable1Id,
          items: [{ itemId: targetItemId }],
        }),
      }),
    ]);

    const occStatuses = [occMove1.status, occMove2.status].sort();
    const noServerError = !occStatuses.includes(500);
    const occPassed = occStatuses[0] === 200 && (occStatuses[1] === 400 || occStatuses[1] === 404);

    if (noServerError && occPassed) {
      pass(
        '7.3: [Regression Defect 4] Optimistic Concurrency Control (OCC) xử lý sạch xung đột di chuyển món',
        `Kết quả: [${occStatuses.join(', ')}] -> Zero 500 InternalServerError, Món chuyển thành công 1 lần`,
      );
      passed++;
    } else {
      fail('7.3: [Regression Defect 4] OCC Move items error handling', { occStatuses });
      failed++;
      failures.push({
        category: 'REGRESSION',
        testName: '7.3: OCC Move Items Handling',
        error: { occStatuses, occMove1: occMove1.data, occMove2: occMove2.data },
        classification: 'IMPLEMENTATION_DEFECT',
      });
    }

  } catch (err: any) {
    console.error('Lỗi ngoại lệ trong quá trình chạy test:', err);
    failed++;
    failures.push({ category: 'FATAL', testName: 'Test Suite Execution Error', error: err.message, classification: 'ENVIRONMENT_ISSUE' });
  } finally {
    // Teardown test server & database
    console.log(`\n${colors.bold}--- DỌN DẸP TÀI NGUYÊN KIỂM THỬ (TEARDOWN) ---${colors.reset}`);
    try {
      if (restaurantAId) {
        await connection.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantAId) });
        await connection.collection('tables').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await connection.collection('tablezones').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await connection.collection('menuitems').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await connection.collection('categories').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await connection.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await connection.collection('bills').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await connection.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
      }
      if (restaurantBId) {
        await connection.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantBId) });
        await connection.collection('tables').deleteMany({ restaurantId: new Types.ObjectId(restaurantBId) });
        await connection.collection('tablezones').deleteMany({ restaurantId: new Types.ObjectId(restaurantBId) });
        await connection.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restaurantBId) });
        await connection.collection('bills').deleteMany({ restaurantId: new Types.ObjectId(restaurantBId) });
        await connection.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantBId) });
      }
      console.log('Đã dọn dẹp sạch sẽ tài nguyên kiểm thử Sub-phase 6.6!');
    } catch (e: any) {
      console.warn('Lỗi teardown:', e.message);
    }

    if (app) {
      await app.close();
    }
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Kết quả kiểm thử Sub-phase 6.6: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
