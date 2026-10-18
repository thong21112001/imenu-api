import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { RolesService } from '../../src/modules/roles/roles.service';
import { UsersService } from '../../src/modules/users/users.service';
import { getTestFixtureSecret } from '../shared/test-credentials.helper';

const TEST_PORT = 3111;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 7 Suite 2: KDS State Transitions, Auto Upgrade & Guards         ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================\n`);

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

  const ts = Date.now();
  let restId = '';
  let restSlug = '';
  let ownerToken = '';
  let branchId = '';
  let tableId = '';
  let kitchenToken = '';

  let itemMonAId = '';
  let itemMonBId = '';
  let itemMonCId = '';

  try {
    // ------------------------------------------------------------------------
    // SETUP: Tạo Nhà hàng, Chi nhánh, Bàn ăn, Menu, Nhân viên Bếp
    // ------------------------------------------------------------------------
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng State Transition ${ts}`,
          phone: '0905550001',
          address: '555 Điện Biên Phủ',
        },
        owner: {
          fullName: 'Chủ Quán ST',
          phone: '0905550001',
          email: `owner.st.${ts}@imenu.test`,
          password: getTestFixtureSecret(),
        },
      }),
    });
    restId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    restSlug = regRes.data?.data?.restaurant?.slug;
    ownerToken = regRes.data?.data?.accessToken;

    const meRes = await request('/auth/me', { headers: { Authorization: `Bearer ${ownerToken}` } });
    branchId = (meRes.data?.data?.user?.branchId || meRes.data?.data?.branchId || '').toString();

    // Zone
    const zRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Khu State Transitions', branchId }),
    });
    const zoneId = zRes.data?.data?.id || zRes.data?.data?._id;

    // Helper tạo bàn
    async function createTable(name: string, code: string) {
      const res = await request('/tables', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          name,
          code,
          capacity: 4,
          zoneId,
          branchId,
        }),
      });
      return res.data?.data?.id || res.data?.data?._id;
    }

    const table1Id = await createTable('Bàn ST 01', `ST-T1-${ts}`);
    const table2Id = await createTable('Bàn ST 02', `ST-T2-${ts}`);
    const table3Id = await createTable('Bàn ST 03', `ST-T3-${ts}`);
    const table4Id = await createTable('Bàn ST 04', `ST-T4-${ts}`);
    const table5Id = await createTable('Bàn ST 05', `ST-T5-${ts}`);
    const tableQrCode = `ST-TQR-${ts}`;
    const tblQrRes = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bàn ST QR',
        code: tableQrCode,
        capacity: 4,
        zoneId,
        branchId,
      }),
    });
    const tableQrToken = tblQrRes.data?.data?.qrToken;

    // Menu
    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Thực Đơn ST', branchIds: [branchId] }),
    });
    const catId = catRes.data?.data?.id || catRes.data?.data?._id;

    const mA = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Bò Lúc Lắc', price: 120000, categoryId: catId, isAvailable: true }),
    });
    itemMonAId = mA.data?.data?.id || mA.data?.data?._id;

    const mB = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Cánh Gà Chiên Nước Mắm', price: 85000, categoryId: catId, isAvailable: true }),
    });
    itemMonBId = mB.data?.data?.id || mB.data?.data?._id;

    const mC = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Mực Trứng Hấp Gừng', price: 150000, categoryId: catId, isAvailable: true }),
    });
    itemMonCId = mC.data?.data?.id || mC.data?.data?._id;

    // Staff Kitchen
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Bếp Trưởng State',
        phone: '0905550002',
        email: `chef.st.${ts}@imenu.test`,
        password: getTestFixtureSecret(),
        role: 'kitchen',
        branchId,
      }),
    });
    const lgnK = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `chef.st.${ts}@imenu.test`, password: getTestFixtureSecret() }),
    });
    kitchenToken = lgnK.data?.data?.accessToken;

    // ------------------------------------------------------------------------
    // TC-01: Standard Flow - Waiting -> start-cooking (Cooking, Order: Preparing) -> mark-ready (Ready)
    // ------------------------------------------------------------------------
    const oRes1 = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        tableId: table1Id,
        items: [
          { menuItemId: itemMonAId, quantity: 1 },
          { menuItemId: itemMonBId, quantity: 1 },
          { menuItemId: itemMonCId, quantity: 1 },
        ],
      }),
    });
    const order1Id = oRes1.data?.data?.id || oRes1.data?.data?._id;
    const items1 = oRes1.data?.data?.items || [];
    const item1A = items1.find((i: any) => (i.menuItemId?._id || i.menuItemId) === itemMonAId);
    const item1B = items1.find((i: any) => (i.menuItemId?._id || i.menuItemId) === itemMonBId);
    const item1C = items1.find((i: any) => (i.menuItemId?._id || i.menuItemId) === itemMonCId);

    // Bắt đầu nấu món A
    const scRes1 = await request(`/order-items/${item1A.id || item1A._id}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: order1Id }),
    });

    const ordAfterCook1 = (await request(`/orders/${order1Id}`, { headers: { Authorization: `Bearer ${ownerToken}` } })).data?.data;
    const itAAfterCook = ordAfterCook1?.items?.find((i: any) => (i.id || i._id) === (item1A.id || item1A._id));

    if (
      scRes1.status === 200 &&
      itAAfterCook?.status === 'Cooking' &&
      ordAfterCook1?.status === 'Preparing'
    ) {
      pass('TC-01: Standard Flow - start-cooking chuyển món sang Cooking và nâng Order.status sang Preparing');
      passed++;
    } else {
      fail('TC-01: Standard Flow - start-cooking thất bại', { scRes1, itAAfterCook, ordAfterCook1 });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-02: Auto Order Status Upgrade - Khi chưa xong hết, Order vẫn Preparing; khi tất cả Ready -> Order Ready
    // ------------------------------------------------------------------------
    // Báo xong món A (Món B và C vẫn Waiting)
    const mrResA = await request(`/order-items/${item1A.id || item1A._id}/mark-ready`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: order1Id }),
    });

    const ordAfterReadyA = (await request(`/orders/${order1Id}`, { headers: { Authorization: `Bearer ${ownerToken}` } })).data?.data;
    const isStillPreparing = ordAfterReadyA?.status === 'Preparing';

    // Bắt đầu nấu và báo xong món B
    await request(`/order-items/${item1B.id || item1B._id}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: order1Id }),
    });
    await request(`/order-items/${item1B.id || item1B._id}/mark-ready`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: order1Id }),
    });

    // Bắt đầu nấu và báo xong món C (Món cuối cùng)
    await request(`/order-items/${item1C.id || item1C._id}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: order1Id }),
    });
    const mrResC = await request(`/order-items/${item1C.id || item1C._id}/mark-ready`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: order1Id }),
    });

    const ordFinal = (await request(`/orders/${order1Id}`, { headers: { Authorization: `Bearer ${ownerToken}` } })).data?.data;
    const isOrderReady = ordFinal?.status === 'Ready';

    if (isStillPreparing && isOrderReady) {
      pass('TC-02: Auto Order Status Upgrade - Đơn hàng tự động chuyển sang Ready ngay khi toàn bộ món xong');
      passed++;
    } else {
      fail('TC-02: Auto Order Status Upgrade - Trạng thái đơn chưa chuyển đúng', { isStillPreparing, isOrderReady, ordFinalStatus: ordFinal?.status });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-03: mark-served - Khi tất cả món chuyển sang Served -> Order tự động chuyển sang Served
    // ------------------------------------------------------------------------
    await request(`/order-items/${item1A.id || item1A._id}/mark-served`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: order1Id }),
    });
    await request(`/order-items/${item1B.id || item1B._id}/mark-served`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: order1Id }),
    });
    await request(`/order-items/${item1C.id || item1C._id}/mark-served`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: order1Id }),
    });

    const ordAfterServed = (await request(`/orders/${order1Id}`, { headers: { Authorization: `Bearer ${ownerToken}` } })).data?.data;
    if (ordAfterServed?.status === 'Served') {
      pass('TC-03: mark-served - Khi tất cả món đã phục vụ, Order.status tự động chuyển sang Served');
      passed++;
    } else {
      fail('TC-03: mark-served - Order.status chưa chuyển sang Served', ordAfterServed?.status);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-04: Auto Upgrade khi có món Cancelled - Chỉ xét các món chưa hủy
    // ------------------------------------------------------------------------
    const oRes2 = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        tableId: table2Id,
        items: [
          { menuItemId: itemMonAId, quantity: 1 },
          { menuItemId: itemMonBId, quantity: 1 },
        ],
      }),
    });
    const order2Id = oRes2.data?.data?.id || oRes2.data?.data?._id;
    const items2 = oRes2.data?.data?.items || [];
    const it2A = items2[0];
    const it2B = items2[1];

    // Hủy món B
    await request(`/orders/${order2Id}/items/${it2B.id || it2B._id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Hết nguyên liệu' }),
    });

    // Nấu và báo xong món A
    await request(`/order-items/${it2A.id || it2A._id}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: order2Id }),
    });
    await request(`/order-items/${it2A.id || it2A._id}/mark-ready`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: order2Id }),
    });

    const ord2Check = (await request(`/orders/${order2Id}`, { headers: { Authorization: `Bearer ${ownerToken}` } })).data?.data;
    if (ord2Check?.status === 'Ready') {
      pass('TC-04: Auto Upgrade with Cancelled - Đơn tự động Ready khi toàn bộ món hợp lệ còn lại đã xong (bỏ qua món hủy)');
      passed++;
    } else {
      fail('TC-04: Auto Upgrade with Cancelled - Đơn không tự động Ready', ord2Check?.status);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-05: Thao tác hàng loạt - start-cooking-all và mark-ready-all
    // ------------------------------------------------------------------------
    const oRes3 = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        tableId: table3Id,
        items: [
          { menuItemId: itemMonAId, quantity: 2 },
          { menuItemId: itemMonBId, quantity: 1 },
          { menuItemId: itemMonCId, quantity: 1 },
        ],
      }),
    });
    const order3Id = oRes3.data?.data?.id || oRes3.data?.data?._id;

    // Nấu tất cả
    const scAllRes = await request(`/kitchen/orders/${order3Id}/start-cooking-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
    });
    const ordAfterScAll = (await request(`/orders/${order3Id}`, { headers: { Authorization: `Bearer ${ownerToken}` } })).data?.data;
    const allItemsCooking = ordAfterScAll?.items?.every((i: any) => i.status === 'Cooking');

    // Báo xong tất cả
    const mrAllRes = await request(`/kitchen/orders/${order3Id}/mark-ready-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
    });
    const ordAfterMrAll = (await request(`/orders/${order3Id}`, { headers: { Authorization: `Bearer ${ownerToken}` } })).data?.data;
    const allItemsReady = ordAfterMrAll?.items?.every((i: any) => i.status === 'Ready');

    if (scAllRes.status === 200 && allItemsCooking && mrAllRes.status === 200 && allItemsReady && ordAfterMrAll?.status === 'Ready') {
      pass('TC-05: Batch Actions - start-cooking-all và mark-ready-all xử lý đồng loạt toàn bộ món thành công');
      passed++;
    } else {
      fail('TC-05: Batch Actions - Thao tác hàng loạt thất bại', { allItemsCooking, allItemsReady, ordStatus: ordAfterMrAll?.status });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-06: Negative Guards - Chặn start-cooking khi món ở WaitingConfirmation
    // ------------------------------------------------------------------------
    // Tạo đơn QR chưa duyệt
    const qrRes = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restSlug,
        tableCode: tableQrCode,
        qrToken: tableQrToken,
        items: [{ menuItemId: itemMonAId, quantity: 1 }],
      }),
    });
    const unconfirmedOrder = qrRes.data?.data;
    const unconfirmedItemId = unconfirmedOrder?.items?.[0]?.id || unconfirmedOrder?.items?.[0]?._id;

    const negCookUnconfirmed = await request(`/order-items/${unconfirmedItemId}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: unconfirmedOrder?.id || unconfirmedOrder?._id }),
    });

    if (negCookUnconfirmed.status === 400) {
      pass('TC-06: Negative Guard - Chặn 400 Bad Request khi nấu món đang WaitingConfirmation (chưa duyệt)');
      passed++;
    } else {
      fail('TC-06: Negative Guard - Không chặn nấu món chưa duyệt', negCookUnconfirmed);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-07: Negative Guards - Chặn mark-ready trực tiếp từ Waiting (bỏ qua Cooking)
    // ------------------------------------------------------------------------
    const oRes4 = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        tableId: table4Id,
        items: [{ menuItemId: itemMonAId, quantity: 1 }],
      }),
    });
    const waitingItemId = oRes4.data?.data?.items?.[0]?.id || oRes4.data?.data?.items?.[0]?._id;

    const negDirectReady = await request(`/order-items/${waitingItemId}/mark-ready`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: oRes4.data?.data?.id || oRes4.data?.data?._id }),
    });

    if (negDirectReady.status === 400) {
      pass('TC-07: Negative Guard - Chặn 400 Bad Request khi mark-ready trực tiếp từ Waiting');
      passed++;
    } else {
      fail('TC-07: Negative Guard - Không chặn mark-ready trực tiếp', negDirectReady);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-08: Negative Guards - Chặn thao tác trên món Cancelled hoặc đơn Paid
    // ------------------------------------------------------------------------
    const oRes4Id = oRes4.data?.data?.id || oRes4.data?.data?._id;
    // Hủy món
    await request(`/orders/${oRes4Id}/items/${waitingItemId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Hủy test' }),
    });

    const negOnCancelled = await request(`/order-items/${waitingItemId}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: oRes4Id }),
    });

    // Thao tác trên đơn Paid
    const oResPaid = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ tableId: table5Id, items: [{ menuItemId: itemMonAId, quantity: 1 }] }),
    });
    const paidOrderId = oResPaid.data?.data?.id || oResPaid.data?.data?._id;
    const paidItemId = oResPaid.data?.data?.items?.[0]?.id || oResPaid.data?.data?.items?.[0]?._id;
    await request(`/orders/${paidOrderId}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash', cashGiven: 200000 }),
    });

    const negOnPaid = await request(`/order-items/${paidItemId}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
    });

    if (negOnCancelled.status === 400 && negOnPaid.status === 400) {
      pass('TC-08: Negative Guard - Chặn 400 Bad Request khi thao tác KDS trên món Cancelled hoặc đơn Paid');
      passed++;
    } else {
      fail('TC-08: Negative Guard - Không chặn thao tác trên món Cancelled hoặc đơn Paid', { negOnCancelled, negOnPaid });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-09: AUD-7.1 Hardening - Bếp Chi Nhánh Chính Bị Chặn Thao Tác Đơn Chi Nhánh Khác
    // ------------------------------------------------------------------------
    // 1. Tạo Chi nhánh 2
    const brSubRes = await request('/branches', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: `Chi nhánh Hardening ${ts}`,
        code: `CN-HRD-${ts}`,
        phone: '0905550099',
        address: '789 Đường Hardening',
      }),
    });
    const branchSubId = (brSubRes.data?.data?.id || brSubRes.data?.data?._id || '').toString();

    // 2. Tạo Zone & Bàn tại Chi nhánh 2
    const zSub = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Khu Sub', branchId: branchSubId }),
    });
    const zoneSubId = zSub.data?.data?.id || zSub.data?.data?._id;

    const tSub = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Bàn Sub 01', code: `BS01-${ts}`, zoneId: zoneSubId, branchId: branchSubId }),
    });
    const tableSubId = tSub.data?.data?.id || tSub.data?.data?._id;

    // 3. Tạo Đơn tại Chi nhánh 2
    const ordSubRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        tableId: tableSubId,
        branchId: branchSubId,
        items: [{ menuItemId: itemMonAId, quantity: 1 }],
      }),
    });
    const ordSubItemId = ordSubRes.data?.data?.items?.[0]?.id || ordSubRes.data?.data?.items?.[0]?._id;

    // 4. Bếp viên Chi nhánh 1 (Main Branch) gọi start-cooking món ở Chi nhánh 2 -> BỊ CHẶN 403 Forbidden
    const crossBranchCook = await request(`/order-items/${ordSubItemId}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
    });

    if (crossBranchCook.status === 403) {
      pass('TC-09: AUD-7.1 Hardening - Đầu bếp Trụ sở chính bị chặn 403 Forbidden khi thao tác trên đơn hàng chi nhánh khác');
      passed++;
    } else {
      fail('TC-09: AUD-7.1 Hardening thất bại', { crossBranchStatus: crossBranchCook.status });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-10: AUD-7.2 Hardening - Phân Quyền Chi Tiết Custom Role (perm-kds-cook vs perm-kds-out)
    // ------------------------------------------------------------------------
    // 1. Tạo vai trò chỉ có quyền Nấu món (perm-kds-cook)
    const rCookOnly = await request('/roles', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: `Đầu bếp chuyền ${ts}`,
        slug: `cook_only_${ts}`,
        description: 'Chỉ được nấu và xong món',
        permissionIds: ['perm-kds-view', 'perm-kds-cook'],
      }),
    });
    const roleCookOnlyId = rCookOnly.data?.data?.id || rCookOnly.data?.data?._id;

    const uCookOnly = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Bếp viên Chuyền',
        phone: '0905551111',
        email: `cookonly.${ts}@imenu.test`,
        password: getTestFixtureSecret(),
        roleId: roleCookOnlyId,
        branchId,
      }),
    });
    const cookOnlyLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `cookonly.${ts}@imenu.test`, password: getTestFixtureSecret() }),
    });
    const cookOnlyToken = cookOnlyLogin.data?.data?.accessToken;

    // 2. Tạo vai trò chỉ có quyền Báo hết món (perm-kds-out)
    const rOutOnly = await request('/roles', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: `Kiểm kho bếp ${ts}`,
        slug: `out_only_${ts}`,
        description: 'Chỉ được báo hết món từ bếp',
        permissionIds: ['perm-kds-view', 'perm-kds-out'],
      }),
    });
    const roleOutOnlyId = rOutOnly.data?.data?.id || rOutOnly.data?.data?._id;

    const uOutOnly = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Thủ kho Bếp',
        phone: '0905552222',
        email: `outonly.${ts}@imenu.test`,
        password: getTestFixtureSecret(),
        roleId: roleOutOnlyId,
        branchId,
      }),
    });
    const outOnlyLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `outonly.${ts}@imenu.test`, password: getTestFixtureSecret() }),
    });
    const outOnlyToken = outOnlyLogin.data?.data?.accessToken;

    // 3. Người chỉ có perm-kds-cook cố tình báo hết món -> BỊ CHẶN 403 Forbidden
    const cookTriesOut = await request(`/kitchen/menu-items/${itemMonAId}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${cookOnlyToken}` },
      body: JSON.stringify({ isAvailable: false }),
    });

    // 4. Tạo bàn mới cho TC-10 và kiểm tra người chỉ có perm-kds-out cố tình gọi start-cooking món -> BỊ CHẶN 403 Forbidden
    const tableHardeningId = await createTable(`Bàn Hardening ${ts}`, `ST-TH-${ts}`);

    const oRes10 = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        tableId: tableHardeningId,
        branchId,
        items: [{ menuItemId: itemMonAId, quantity: 1 }],
      }),
    });
    const item10Id = oRes10.data?.data?.items?.[0]?.id || oRes10.data?.data?.items?.[0]?._id;

    const outTriesCook = await request(`/order-items/${item10Id}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${outOnlyToken}` },
    });

    if (cookTriesOut.status === 403 && outTriesCook.status === 403) {
      pass('TC-10: AUD-7.2 Hardening - Phân quyền phân định tuyệt đối: perm-kds-cook không thể báo hết món, perm-kds-out không thể nấu món (Cả 2 bị chặn 403 Forbidden)');
      passed++;
    } else {
      fail('TC-10: AUD-7.2 Hardening thất bại', { cookTriesOutStatus: cookTriesOut.status, outTriesCookStatus: outTriesCook.status });
      failed++;
    }

  } catch (err: any) {
    fail('FATAL EXCEPTION TRONG TEST SUITE 2', err.message || err);
    failed++;
  } finally {
    if (app) {
      try {
        const connection: Connection = app.get(getConnectionToken());
        if (restId) {
          const restObjId = new Types.ObjectId(restId);
          await connection.collection('tables').deleteMany({ restaurantId: restObjId });
          await connection.collection('table_zones').deleteMany({ restaurantId: restObjId });
          await connection.collection('orders').deleteMany({ restaurantId: restObjId });
          await connection.collection('menu_items').deleteMany({ restaurantId: restObjId });
          await connection.collection('menu_categories').deleteMany({ restaurantId: restObjId });
          await connection.collection('users').deleteMany({ restaurantId: restObjId });
          await connection.collection('restaurants').deleteOne({ _id: restObjId });
          console.log('  ✔ [Teardown] Đã dọn dẹp sạch sẽ toàn bộ dữ liệu Suite 2 (Zero Garbage)');
        }
      } catch (e: any) {
        console.warn('Lỗi teardown Suite 2:', e.message);
      }
      await app.close();
    }
  }

  console.log(`\n${colors.bold}------------------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}Kết quả Suite 2 (KDS State Transitions & Guards): ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : colors.green}${failed} failed${colors.reset}`);
  console.log(`${colors.bold}------------------------------------------------------------------------${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
