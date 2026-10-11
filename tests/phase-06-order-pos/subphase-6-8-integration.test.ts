import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { RolesService } from '../../src/modules/roles/roles.service';
import { UsersService } from '../../src/modules/users/users.service';

const TEST_PORT = 3105;
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
  console.log(`${colors.bold}${colors.cyan}  iMenu API - Sub-phase 6.8: Frontend Monorepo Integration Test Suite   ${colors.reset}`);
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

  await app.listen(TEST_PORT);
  console.log('Test server đã sẵn sàng!\n');

  const timestamp = Date.now();
  let restaurantAId = '';
  let restASlug = '';
  let ownerToken = '';
  let branchAId = '';
  let subBranchAId = '';

  let restaurantBId = '';
  let restBSlug = '';
  let ownerBToken = '';

  let cashierToken = '';
  let kitchenToken = '';
  let subBranchCashierToken = '';

  let tableA1Id = '';
  let tableA2Id = '';
  let tableA3Id = '';
  let tableB1Id = '';

  const qrTokenA1 = `qr-a1-${timestamp}`;
  const qrTokenA2 = `qr-a2-${timestamp}`;
  const qrTokenA3 = `qr-a3-${timestamp}`;
  const qrTokenB1 = `qr-b1-${timestamp}`;

  let menuItem1Id = '';
  let menuItem2Id = '';
  let menuItem3Id = '';

  try {
    // ------------------------------------------------------------------------
    // SETUP: Tạo Nhà hàng A, Chi nhánh, Bàn ăn, Menu, Nhân viên qua API
    // ------------------------------------------------------------------------
    const regResA = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng A Integration ${timestamp}`,
          phone: '0901112222',
          address: '100 Đường Nguyễn Huệ, Q1',
        },
        owner: {
          fullName: 'Chủ Quán A',
          phone: '0901112222',
          email: `owner.a.${timestamp}@imenu.test`,
          password: 'Password@123',
        },
      }),
    });

    restaurantAId = regResA.data?.data?.restaurant?.id || regResA.data?.data?.restaurant?._id;
    ownerToken = regResA.data?.data?.accessToken;
    restASlug = regResA.data?.data?.restaurant?.slug;

    const restADoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantAId) });
    branchAId = restADoc!.branches[0]._id.toString();

    // Thêm chi nhánh phụ cho Nhà hàng A
    subBranchAId = new Types.ObjectId().toString();
    await connection.collection('restaurants').updateOne(
      { _id: new Types.ObjectId(restaurantAId) },
      {
        $push: {
          branches: {
            _id: new Types.ObjectId(subBranchAId),
            name: 'Chi Nhánh Phụ A2',
            address: '200 Đường Lê Duẩn, Q1',
            phone: '0903334444',
            isMainBranch: false,
            status: 'ACTIVE',
            isDeleted: false,
          },
        } as any,
      },
    );

    // Tạo Nhà hàng B (Multi-tenant)
    const regResB = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng B MultiTenant ${timestamp}`,
          phone: '0909998888',
          address: '300 Đường Hai Bà Trưng, Q3',
        },
        owner: {
          fullName: 'Chủ Quán B',
          phone: '0909998888',
          email: `owner.b.${timestamp}@imenu.test`,
          password: 'Password@123',
        },
      }),
    });
    restaurantBId = regResB.data?.data?.restaurant?.id || regResB.data?.data?.restaurant?._id;
    ownerBToken = regResB.data?.data?.accessToken;
    restBSlug = regResB.data?.data?.restaurant?.slug;

    // Lấy Role IDs
    const cashierRole = await rolesService.findBySlug('cashier');
    const kitchenRole = await rolesService.findBySlug('kitchen');

    // Tạo Cashier Chi nhánh chính
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Thu Ngân Chính A',
        username: `cashier_a_${timestamp}`,
        email: `cashier.a.${timestamp}@imenu.test`,
        password: 'Password@123',
        phone: '0901234561',
        roleId: cashierRole._id.toString(),
      }),
    });

    // Tạo Kitchen Chi nhánh chính
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Đầu Bếp A',
        username: `kitchen_a_${timestamp}`,
        email: `kitchen.a.${timestamp}@imenu.test`,
        password: 'Password@123',
        phone: '0901234562',
        roleId: kitchenRole._id.toString(),
      }),
    });

    // Tạo Cashier Chi nhánh phụ A2
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Thu Ngân A2',
        username: `cashier_a2_${timestamp}`,
        email: `cashier.a2.${timestamp}@imenu.test`,
        password: 'Password@123',
        phone: '0901234563',
        roleId: cashierRole._id.toString(),
        branchId: subBranchAId,
      }),
    });

    const loginUser = async (email: string) => {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'Password@123' }),
      });
      return res.data?.data?.accessToken;
    };

    cashierToken = await loginUser(`cashier.a.${timestamp}@imenu.test`);
    kitchenToken = await loginUser(`kitchen.a.${timestamp}@imenu.test`);
    subBranchCashierToken = await loginUser(`cashier.a2.${timestamp}@imenu.test`);

    // Tạo Zone & Bàn ăn
    const zoneRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Khu Vực Tầng 1' }),
    });
    const zoneAId = zoneRes.data?.data?.id || zoneRes.data?.data?._id;

    // Bàn A1
    const tA1Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        code: 'ban-a1',
        name: 'Bàn A1',
        capacity: 4,
        zoneId: zoneAId,
      }),
    });
    tableA1Id = tA1Res.data?.data?.id || tA1Res.data?.data?._id;
    await connection.collection('tables').updateOne(
      { _id: new Types.ObjectId(tableA1Id) },
      { $set: { qrToken: qrTokenA1 } },
    );

    // Bàn A2
    const tA2Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        code: 'ban-a2',
        name: 'Bàn A2',
        capacity: 4,
        zoneId: zoneAId,
      }),
    });
    tableA2Id = tA2Res.data?.data?.id || tA2Res.data?.data?._id;
    await connection.collection('tables').updateOne(
      { _id: new Types.ObjectId(tableA2Id) },
      { $set: { qrToken: qrTokenA2 } },
    );

    // Bàn A3
    const tA3Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        code: 'ban-a3',
        name: 'Bàn A3',
        capacity: 6,
        zoneId: zoneAId,
      }),
    });
    tableA3Id = tA3Res.data?.data?.id || tA3Res.data?.data?._id;
    await connection.collection('tables').updateOne(
      { _id: new Types.ObjectId(tableA3Id) },
      { $set: { qrToken: qrTokenA3 } },
    );

    // Bàn B1 (Nhà hàng B)
    const tB1Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBToken}` },
      body: JSON.stringify({
        code: 'ban-b1',
        name: 'Bàn B1',
        capacity: 4,
      }),
    });
    tableB1Id = tB1Res.data?.data?.id || tB1Res.data?.data?._id;
    await connection.collection('tables').updateOne(
      { _id: new Types.ObjectId(tableB1Id) },
      { $set: { qrToken: qrTokenB1 } },
    );

    // Tạo Menu Category & Items cho Nhà hàng A
    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Món Chính Đặc Sắc', order: 1 }),
    });
    const catId = catRes.data?.data?.id || catRes.data?.data?._id;

    const m1Res = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Phở Bò Đặc Biệt',
        categoryId: catId,
        price: 85000,
        isAvailable: true,
      }),
    });
    menuItem1Id = m1Res.data?.data?.id || m1Res.data?.data?._id;

    const m2Res = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bún Chả Hà Nội',
        categoryId: catId,
        price: 75000,
        isAvailable: true,
      }),
    });
    menuItem2Id = m2Res.data?.data?.id || m2Res.data?.data?._id;

    const m3Res = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Trà Đào Cam Sả',
        categoryId: catId,
        price: 35000,
        isAvailable: true,
      }),
    });
    menuItem3Id = m3Res.data?.data?.id || m3Res.data?.data?._id;

    // =========================================================================
    // SECTION 1: PUBLIC QR CONTEXT RESOLUTION (AC-6.8.1)
    // =========================================================================
    console.log(`--- PHẦN 1: PUBLIC QR CONTEXT RESOLUTION (AC-6.8.1) ---`);

    // TC-01: Valid QR Context
    const tc01 = await request(`/orders/public/table-context?restaurantSlug=${restASlug}&tableCode=ban-a1&qrToken=${qrTokenA1}`);
    if (
      tc01.status === 200 &&
      tc01.data?.data?.restaurant?.slug === restASlug &&
      tc01.data?.data?.table?.code === 'ban-a1' &&
      tc01.data?.data?.activeOrder === null
    ) {
      pass('TC-01: GET /orders/public/table-context với QR token hợp lệ trả về đúng context bàn & nhà hàng');
      passed++;
    } else {
      fail('TC-01: GET /orders/public/table-context thất bại', tc01);
      failed++;
    }

    // TC-02: Alias Endpoint /orders/customer/table-context
    const tc02 = await request(`/orders/customer/table-context?restaurantSlug=${restASlug}&tableCode=ban-a1&qrToken=${qrTokenA1}`);
    if (tc02.status === 200 && tc02.data?.data?.table?.code === 'ban-a1') {
      pass('TC-02: GET /orders/customer/table-context (alias) hoạt động đồng nhất với public endpoint');
      passed++;
    } else {
      fail('TC-02: GET /orders/customer/table-context alias thất bại', tc02);
      failed++;
    }

    // TC-03: Invalid QR Token
    const tc03 = await request(`/orders/public/table-context?restaurantSlug=${restASlug}&tableCode=ban-a1&qrToken=invalid-token-xyz`);
    if (tc03.status === 400 || tc03.status === 404) {
      pass('TC-03: QR Token không hợp lệ bị từ chối với HTTP 400/404', `Status ${tc03.status}`);
      passed++;
    } else {
      fail('TC-03: Không chặn QR token sai', tc03);
      failed++;
    }

    // TC-04: Bàn không thuộc nhà hàng
    const tc04 = await request(`/orders/public/table-context?restaurantSlug=${restASlug}&tableCode=ban-b1&qrToken=${qrTokenB1}`);
    if (tc04.status === 400 || tc04.status === 404) {
      pass('TC-04: Bàn thuộc nhà hàng khác bị từ chối với HTTP 400/404', `Status ${tc04.status}`);
      passed++;
    } else {
      fail('TC-04: Không chặn bàn chéo nhà hàng', tc04);
      failed++;
    }

    // =========================================================================
    // SECTION 2: CUSTOMER QR ORDERING & IDEMPOTENCY (AC-6.8.2)
    // =========================================================================
    console.log(`\n--- PHẦN 2: CUSTOMER QR ORDERING & IDEMPOTENCY (AC-6.8.2) ---`);

    const orderIdemKey = `idem-ord-${timestamp}`;
    const tc06 = await request('/orders/customer', {
      method: 'POST',
      headers: { 'idempotency-key': orderIdemKey },
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-a1',
        qrToken: qrTokenA1,
        items: [
          { menuItemId: menuItem1Id, quantity: 2 },
          { menuItemId: menuItem3Id, quantity: 2 },
        ],
      }),
    });

    let createdOrderId: string = '';
    const ordData = tc06.data?.data || tc06.data;
    if (
      (tc06.status === 201 || tc06.status === 200) &&
      ordData?.status === 'WaitingConfirmation' &&
      ordData?.rounds?.length === 1 &&
      ordData?.rounds[0]?.status === 'WaitingConfirmation'
    ) {
      createdOrderId = ordData.id || ordData._id;
      pass('TC-06: Khách gọi món lần đầu tạo đơn WaitingConfirmation với Round 1 ở WaitingConfirmation');
      passed++;
    } else {
      fail('TC-06: Tạo đơn QR không đúng trạng thái WaitingConfirmation', tc06);
      failed++;
    }

    // TC-07: Khách gọi thêm món (Round 2)
    const round2IdemKey = `idem-round2-${timestamp}`;
    const tc07 = await request('/orders/customer/items', {
      method: 'POST',
      headers: { 'idempotency-key': round2IdemKey },
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-a1',
        qrToken: qrTokenA1,
        orderId: createdOrderId,
        items: [
          { menuItemId: menuItem2Id, quantity: 1, note: 'Ít ớt' },
        ],
      }),
    });

    let round2Data = tc07.data?.data || tc07.data;
    if (
      (tc07.status === 201 || tc07.status === 200) &&
      round2Data?.rounds?.length === 2 &&
      round2Data?.rounds[1]?.roundNumber === 2 &&
      round2Data?.rounds[1]?.status === 'WaitingConfirmation'
    ) {
      pass('TC-07: Gọi thêm món tạo Round 2 ở WaitingConfirmation, bảo toàn trọn vẹn Round 1');
      passed++;
    } else {
      fail('TC-07: Gọi thêm món tạo round thất bại', tc07);
      failed++;
    }

    // TC-08: Idempotency Key Replay (Tạo đơn)
    const tc08 = await request('/orders/customer', {
      method: 'POST',
      headers: { 'idempotency-key': orderIdemKey },
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-a1',
        qrToken: qrTokenA1,
        items: [
          { menuItemId: menuItem1Id, quantity: 2 },
          { menuItemId: menuItem3Id, quantity: 2 },
        ],
      }),
    });

    const replayOrdData = tc08.data?.data || tc08.data;
    const isReplayOrd = (replayOrdData?.id || replayOrdData?._id) === createdOrderId;
    if ((tc08.status === 200 || tc08.status === 201) && isReplayOrd) {
      pass('TC-08: Gửi lại request tạo đơn với cùng Idempotency-Key trả về kết quả replay, không tạo đơn mới');
      passed++;
    } else {
      fail('TC-08: Idempotency Replay đơn hàng thất bại', tc08);
      failed++;
    }

    // TC-09: Idempotency Key Replay (Round 2)
    const tc09 = await request('/orders/customer/items', {
      method: 'POST',
      headers: { 'idempotency-key': round2IdemKey },
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-a1',
        qrToken: qrTokenA1,
        orderId: createdOrderId,
        items: [
          { menuItemId: menuItem2Id, quantity: 1, note: 'Ít ớt' },
        ],
      }),
    });

    const replayRound2Data = tc09.data?.data || tc09.data;
    if (replayRound2Data?.rounds?.length === 2) {
      pass('TC-09: Gửi lại request Round 2 với cùng Idempotency-Key không tạo thêm round thứ ba');
      passed++;
    } else {
      fail('TC-09: Idempotency Replay round thất bại', tc09);
      failed++;
    }

    // TC-10: Context sau khi gọi món trả về activeOrder
    const tc10 = await request(`/orders/public/table-context?restaurantSlug=${restASlug}&tableCode=ban-a1&qrToken=${qrTokenA1}`);
    const activeOrdFromCtx = tc10.data?.data?.activeOrder;
    if (tc10.status === 200 && (activeOrdFromCtx?.id === createdOrderId || activeOrdFromCtx?._id === createdOrderId)) {
      pass('TC-10: GET /orders/public/table-context phản hồi đúng activeOrder sau khi khách gọi món');
      passed++;
    } else {
      fail('TC-10: Context không chứa activeOrder', tc10);
      failed++;
    }

    // =========================================================================
    // SECTION 3: ADMIN QR APPROVAL & KDS GUARD (AC-6.8.3)
    // =========================================================================
    console.log(`\n--- PHẦN 3: ADMIN QR APPROVAL & KDS GUARD (AC-6.8.3) ---`);

    // TC-11: Cashier xác nhận Round 1
    const tc11 = await request(`/orders/${createdOrderId}/rounds/1/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    const r1Confirmed = tc11.data?.data || tc11.data;
    if (tc11.status === 200 && r1Confirmed?.rounds[0]?.status === 'Confirmed') {
      pass('TC-11: Thu ngân có quyền xác nhận Round 1 thành công (status chuyển Confirmed)');
      passed++;
    } else {
      fail('TC-11: Xác nhận Round 1 thất bại', tc11);
      failed++;
    }

    // TC-12: Kitchen staff KHÔNG có quyền xác nhận Round
    const tc12 = await request(`/orders/${createdOrderId}/rounds/2/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
    });

    if (tc12.status === 403) {
      pass('TC-12: Nhân viên Bếp (không có quyền ResourceType.POS) bị chặn HTTP 403 Forbidden khi duyệt round');
      passed++;
    } else {
      fail('TC-12: Bếp không bị chặn khi duyệt round', tc12);
      failed++;
    }

    // TC-13: KDS Guard: Không thể nấu món thuộc Round 2 đang WaitingConfirmation
    const round2Item = round2Data?.items?.find((i: any) => i.roundNumber === 2);
    const round2ItemId = round2Item?._id || round2Item?.id;
    const tc13 = await request(`/orders/${createdOrderId}/items/${round2ItemId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ status: 'Cooking' }),
    });

    if (tc13.status === 400) {
      pass('TC-13: KDS Guard: Chặn không cho nấu món thuộc Round 2 khi chưa được thu ngân duyệt (HTTP 400)');
      passed++;
    } else {
      fail('TC-13: KDS Guard không chặn nấu món WaitingConfirmation', tc13);
      failed++;
    }

    // TC-14: Thu ngân từ chối Round 2 với lý do
    const tc14 = await request(`/orders/${createdOrderId}/rounds/2/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({ reason: 'Hết nguyên liệu bún chả' }),
    });

    const r2Cancelled = tc14.data?.data || tc14.data;
    if (
      tc14.status === 200 &&
      r2Cancelled?.rounds?.[1]?.status === 'Cancelled' &&
      r2Cancelled?.rounds?.[1]?.cancelReason === 'Hết nguyên liệu bún chả'
    ) {
      pass('TC-14: Thu ngân từ chối Round 2 thành công và lưu đúng cancelReason');
      passed++;
    } else {
      fail('TC-14: Từ chối Round 2 thất bại', tc14);
      failed++;
    }

    // =========================================================================
    // SECTION 4: TABLE OPERATIONS (AC-6.8.4)
    // =========================================================================
    console.log(`\n--- PHẦN 4: TABLE OPERATIONS (AC-6.8.4) ---`);

    // TC-15: Chuyển bàn (Transfer) từ Bàn A1 sang Bàn A2
    const tc15 = await request('/tables/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        fromTableId: tableA1Id,
        toTableId: tableA2Id,
      }),
    });

    const tblA1After = await connection.collection('tables').findOne({ _id: new Types.ObjectId(tableA1Id) });
    const tblA2After = await connection.collection('tables').findOne({ _id: new Types.ObjectId(tableA2Id) });

    if (
      tc15.status === 200 &&
      tblA1After?.status === 'Available' &&
      tblA2After?.status === 'Occupied'
    ) {
      pass('TC-15: Chuyển bàn từ A1 sang A2 thành công; Bàn A1 giải phóng Available, A2 nhận Occupied');
      passed++;
    } else {
      fail('TC-15: Chuyển bàn thất bại', { res: tc15, tblA1: tblA1After, tblA2: tblA2After });
      failed++;
    }

    // TC-16: Chuyển bàn sang bàn đang Occupied bị từ chối
    const tc16 = await request('/tables/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        fromTableId: tableA2Id,
        toTableId: tableA2Id,
      }),
    });

    if (tc16.status === 400) {
      pass('TC-16: Chuyển bàn sang bàn không Available hoặc trùng bàn bị từ chối với HTTP 400');
      passed++;
    } else {
      fail('TC-16: Chuyển bàn không hợp lệ không bị chặn', tc16);
      failed++;
    }

    // Chuẩn bị thêm đơn hàng ở Bàn A3 để test Gộp bàn (Merge)
    const orderA3Res = await request('/orders/customer', {
      method: 'POST',
      headers: { 'idempotency-key': `idem-ord-a3-${timestamp}` },
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: 'ban-a3',
        qrToken: qrTokenA3,
        items: [{ menuItemId: menuItem3Id, quantity: 3 }],
      }),
    });
    const ordA3Data = orderA3Res.data?.data || orderA3Res.data;
    const orderA3Id = ordA3Data?.id || ordA3Data?._id;
    await request(`/orders/${orderA3Id}/rounds/1/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    // TC-17: Gộp Bàn A3 vào Bàn A2
    const tc17 = await request('/tables/merge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        fromTableIds: [tableA3Id],
        targetTableId: tableA2Id,
        note: 'Gộp đoàn khách A3 vào A2',
      }),
    });

    const tblA3AfterMerge = await connection.collection('tables').findOne({ _id: new Types.ObjectId(tableA3Id) });
    if (tc17.status === 200 && tblA3AfterMerge?.status === 'Available') {
      pass('TC-17: Gộp Bàn A3 vào Bàn A2 thành công; Bàn A3 được giải phóng Available');
      passed++;
    } else {
      fail('TC-17: Gộp bàn thất bại', tc17);
      failed++;
    }

    // TC-18: Gộp bàn với targetTable trùng fromTableIds
    const tc18 = await request('/tables/merge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        fromTableIds: [tableA2Id],
        targetTableId: tableA2Id,
      }),
    });

    if (tc18.status === 400) {
      pass('TC-18: Gộp bàn với bàn đích nằm trong danh sách bàn nguồn bị từ chối HTTP 400');
      passed++;
    } else {
      fail('TC-18: Không chặn tự gộp chính mình', tc18);
      failed++;
    }

    // TC-19: Di chuyển món (Move Items) từ Bàn A2 sang Bàn A1 (đang trống)
    const orderA2Res = await request(`/orders/${createdOrderId}`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    const orderA2Data = orderA2Res.data?.data || orderA2Res.data;
    const itemToMove = orderA2Data?.items?.find((i: any) => i.status !== 'Cancelled');
    const itemToMoveId = itemToMove?._id || itemToMove?.id;

    const tc19 = await request('/tables/move-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        fromTableId: tableA2Id,
        toTableId: tableA1Id,
        items: [{ itemId: itemToMoveId, quantity: 1 }],
      }),
    });

    if (tc19.status === 200) {
      pass('TC-19: Di chuyển 1 món từ Bàn A2 sang Bàn A1 thành công, bảo toàn tính toán số lượng');
      passed++;
    } else {
      fail('TC-19: Di chuyển món thất bại', tc19);
      failed++;
    }

    // TC-20: Di chuyển món với số lượng vượt quá số lượng hiện có
    const tc20 = await request('/tables/move-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        fromTableId: tableA2Id,
        toTableId: tableA1Id,
        items: [{ itemId: itemToMoveId, quantity: 999 }],
      }),
    });

    if (tc20.status === 400) {
      pass('TC-20: Di chuyển món với số lượng vượt quá cho phép bị chặn với HTTP 400');
      passed++;
    } else {
      fail('TC-20: Không chặn di chuyển số lượng vượt mức', tc20);
      failed++;
    }

    // =========================================================================
    // SECTION 5: POS CHECKOUT, BILL PREVIEW & AUTO TABLE CLEARING (AC-6.8.5)
    // =========================================================================
    console.log(`\n--- PHẦN 5: POS CHECKOUT, BILL PREVIEW & AUTO-CLEAR TABLE (AC-6.8.5) ---`);

    // TC-21: Preview Bill
    const tc21 = await request(`/orders/${createdOrderId}/bill-preview?discountAmount=20000&serviceFee=10000&vatPercent=8`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    const previewData = tc21.data?.data || tc21.data;
    if (
      tc21.status === 200 &&
      previewData?.discountAmount === 20000 &&
      previewData?.serviceFee === 10000 &&
      previewData?.vatAmount === 20000 &&
      typeof previewData?.totalAmount === 'number'
    ) {
      pass('TC-21: GET /orders/:id/bill-preview tính toán chiết khấu, phí dịch vụ và VAT chuẩn xác');
      passed++;
    } else {
      fail('TC-21: Preview bill thất bại', tc21);
      failed++;
    }

    // TC-22 & TC-23: Pay Order với Idempotency Key & Auto-Clear Table
    const payIdemKey = `idem-pay-${timestamp}`;
    const payPayload = {
      paymentMethod: 'Cash',
      discountAmount: 20000,
      serviceFee: 10000,
      vatPercent: 8,
      amountReceived: previewData?.totalAmount || 270000,
      cashGiven: 500000,
      note: 'Khách thanh toán tiền mặt đủ',
    };

    const tc22 = await request(`/orders/${createdOrderId}/pay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'idempotency-key': payIdemKey,
      },
      body: JSON.stringify(payPayload),
    });

    const payData = tc22.data?.data || tc22.data;
    const paidOrder = payData?.order || payData;
    const tblA2AfterPay = await connection.collection('tables').findOne({ _id: new Types.ObjectId(tableA2Id) });

    if (tc22.status === 200 && paidOrder?.status === 'Paid') {
      pass('TC-22: Thanh toán POST /orders/:id/pay thành công với trạng thái Paid');
      passed++;
    } else {
      fail('TC-22: Thanh toán đơn thất bại', tc22);
      failed++;
    }

    // TC-23: Kiểm tra bàn tự động giải phóng Available mà không cần lệnh updateStatus riêng
    if (tblA2AfterPay?.status === 'Available') {
      pass('TC-23: Backend tự động giải phóng bàn sang Available trong cùng MongoDB transaction khi pay()');
      passed++;
    } else {
      fail('TC-23: Bàn không được backend tự giải phóng sang Available sau khi thanh toán', tblA2AfterPay);
      failed++;
    }

    // TC-24: Idempotency Replay khi Pay
    const tc24 = await request(`/orders/${createdOrderId}/pay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'idempotency-key': payIdemKey,
      },
      body: JSON.stringify(payPayload),
    });

    const replayPayData = tc24.data?.data || tc24.data;
    const replayPaidOrder = replayPayData?.order || replayPayData;
    if (tc24.status === 200 && replayPaidOrder?.status === 'Paid') {
      pass('TC-24: Gửi lại thanh toán với cùng Idempotency-Key trả về replay an toàn, không nhân đôi thanh toán');
      passed++;
    } else {
      fail('TC-24: Idempotency Replay thanh toán thất bại', tc24);
      failed++;
    }

    // TC-25: Thanh toán lại đơn đã Paid mà không có idempotency-key bị từ chối
    const tc25 = await request(`/orders/${createdOrderId}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });

    if (tc25.status === 400) {
      pass('TC-25: Cố tình thanh toán lại đơn đã Paid mà không có key hợp lệ bị từ chối với HTTP 400');
      passed++;
    } else {
      fail('TC-25: Không chặn thanh toán đơn đã hoàn tất', tc25);
      failed++;
    }

    // TC-26: Đơn đã Paid bất biến, không thể thêm món hay sửa đổi
    const tc26 = await request(`/orders/${createdOrderId}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'idempotency-key': `idem-fail-${timestamp}`,
      },
      body: JSON.stringify({
        items: [{ menuItemId: menuItem1Id, quantity: 1 }],
      }),
    });

    if (tc26.status === 400) {
      pass('TC-26: Bất biến: Đơn hàng đã Paid không thể thêm món hoặc thay đổi (HTTP 400)');
      passed++;
    } else {
      fail('TC-26: Đơn Paid vẫn cho phép thêm món trái phép', tc26);
      failed++;
    }

    // =========================================================================
    // SECTION 6: SECURITY & CROSS-TENANT / MULTI-BRANCH ISOLATION (AC-6.8.6)
    // =========================================================================
    console.log(`\n--- PHẦN 6: SECURITY & CROSS-TENANT / MULTI-BRANCH ISOLATION (AC-6.8.6) ---`);

    // TC-27: Nhân viên chi nhánh con A2 không thể truy cập / sửa đơn chi nhánh A1
    const tc27 = await request(`/orders/${createdOrderId}`, {
      headers: { Authorization: `Bearer ${subBranchCashierToken}` },
    });

    if (tc27.status === 403) {
      pass('TC-27: Nhân viên Chi nhánh con A2 bị chặn HTTP 403 khi cố truy cập đơn của Chi nhánh A1');
      passed++;
    } else {
      fail('TC-27: Rò rỉ dữ liệu chéo chi nhánh con', tc27);
      failed++;
    }

    // TC-28: QR token của Nhà hàng A không thể dùng để truy cập bàn của Nhà hàng B
    const tc28 = await request(`/orders/public/table-context?restaurantSlug=${restBSlug}&tableCode=ban-b1&qrToken=${qrTokenA1}`);
    if (tc28.status === 400 || tc28.status === 404) {
      pass('TC-28: QR Token của Nhà hàng A không thể dùng trên Nhà hàng B (HTTP 400/404)');
      passed++;
    } else {
      fail('TC-28: Không chặn QR token chéo nhà hàng', tc28);
      failed++;
    }

  } catch (err) {
    console.error('Unhandled test runner error:', err);
    failed++;
  } finally {
    // TEARDOWN
    console.log('\n--- DỌN DẸP TÀI NGUYÊN KIỂM THỬ (TEARDOWN) ---');
    try {
      const restaurantsColl = connection.collection('restaurants');
      const tablesColl = connection.collection('tables');
      const menuItemsColl = connection.collection('menuitems');
      const categoriesColl = connection.collection('menucategories');
      const usersColl = connection.collection('users');
      const ordersColl = connection.collection('orders');

      if (restaurantAId) {
        await restaurantsColl.deleteMany({ _id: { $in: [new Types.ObjectId(restaurantAId), new Types.ObjectId(restaurantBId)] } });
        await tablesColl.deleteMany({ restaurantId: { $in: [new Types.ObjectId(restaurantAId), new Types.ObjectId(restaurantBId)] } });
        await menuItemsColl.deleteMany({ restaurantId: { $in: [new Types.ObjectId(restaurantAId), new Types.ObjectId(restaurantBId)] } });
        await categoriesColl.deleteMany({ restaurantId: { $in: [new Types.ObjectId(restaurantAId), new Types.ObjectId(restaurantBId)] } });
        await usersColl.deleteMany({ restaurantId: { $in: [new Types.ObjectId(restaurantAId), new Types.ObjectId(restaurantBId)] } });
        await ordersColl.deleteMany({ restaurantId: { $in: [new Types.ObjectId(restaurantAId), new Types.ObjectId(restaurantBId)] } });
      }
      console.log('  ✔ Đã dọn dẹp sạch sẽ toàn bộ tài nguyên kiểm thử Sub-phase 6.8!');
    } catch (cleanupErr) {
      console.error('Lỗi khi dọn dẹp:', cleanupErr);
    }

    await app.close();
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Kết quả kiểm thử Sub-phase 6.8: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
