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

const TEST_PORT = 3112;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 7 Suite 3: KDS Concurrency, Idempotency & OCC Retries            ${colors.reset}`);
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
  let ownerToken = '';
  let branchId = '';
  let tableId = '';
  let kitchenToken = '';

  let itemM1 = '';
  let itemM2 = '';
  let itemM3 = '';
  let itemM4 = '';

  try {
    // ------------------------------------------------------------------------
    // SETUP: Tạo Nhà hàng, Bàn ăn, 4 Món ăn, Nhân viên Bếp
    // ------------------------------------------------------------------------
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng Concurrency OCC ${ts}`,
          phone: '0907770001',
          address: '777 Trần Hưng Đạo',
        },
        owner: {
          fullName: 'Chủ Quán Concurrency',
          phone: '0907770001',
          email: `owner.occ.${ts}@imenu.test`,
          password: getTestFixtureSecret(),
        },
      }),
    });
    restId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    ownerToken = regRes.data?.data?.accessToken;

    const meRes = await request('/auth/me', { headers: { Authorization: `Bearer ${ownerToken}` } });
    branchId = (meRes.data?.data?.user?.branchId || meRes.data?.data?.branchId || '').toString();

    // Zone & Tables
    const zRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Khu OCC', branchId }),
    });
    const zoneId = zRes.data?.data?.id || zRes.data?.data?._id;

    async function createTable(name: string, code: string) {
      const res = await request('/tables', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          name,
          code,
          capacity: 8,
          zoneId,
          branchId,
        }),
      });
      return res.data?.data?.id || res.data?.data?._id;
    }

    const table1Id = await createTable('Bàn OCC 01', `OCC-T1-${ts}`);
    const table2Id = await createTable('Bàn OCC 02', `OCC-T2-${ts}`);
    const table3Id = await createTable('Bàn OCC 03', `OCC-T3-${ts}`);

    // Menu
    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Menu OCC', branchIds: [branchId] }),
    });
    const catId = catRes.data?.data?.id || catRes.data?.data?._id;

    const m1 = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Món OCC 1', price: 50000, categoryId: catId, isAvailable: true }),
    });
    itemM1 = m1.data?.data?.id || m1.data?.data?._id;

    const m2 = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Món OCC 2', price: 60000, categoryId: catId, isAvailable: true }),
    });
    itemM2 = m2.data?.data?.id || m2.data?.data?._id;

    const m3 = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Món OCC 3', price: 70000, categoryId: catId, isAvailable: true }),
    });
    itemM3 = m3.data?.data?.id || m3.data?.data?._id;

    const m4 = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Món OCC 4', price: 80000, categoryId: catId, isAvailable: true }),
    });
    itemM4 = m4.data?.data?.id || m4.data?.data?._id;

    // Kitchen Staff
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Bếp Trưởng OCC',
        phone: '0907770002',
        email: `kitchen.occ.${ts}@imenu.test`,
        password: getTestFixtureSecret(),
        role: 'kitchen',
        branchId,
      }),
    });
    const lgnK = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `kitchen.occ.${ts}@imenu.test`, password: getTestFixtureSecret() }),
    });
    kitchenToken = lgnK.data?.data?.accessToken;

    // ------------------------------------------------------------------------
    // TC-01: Idempotent Double-Click nối tiếp (Sequential Double-Click)
    // ------------------------------------------------------------------------
    const oRes1 = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ tableId: table1Id, items: [{ menuItemId: itemM1, quantity: 1 }] }),
    });
    const ord1Id = oRes1.data?.data?.id || oRes1.data?.data?._id;
    const it1Id = oRes1.data?.data?.items?.[0]?.id || oRes1.data?.data?.items?.[0]?._id;

    const click1 = await request(`/order-items/${it1Id}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: ord1Id }),
    });

    // Bấm lần 2 ngay sau đó
    const click2 = await request(`/order-items/${it1Id}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: ord1Id }),
    });

    const ord1After = (await request(`/orders/${ord1Id}`, { headers: { Authorization: `Bearer ${ownerToken}` } })).data?.data;
    const it1Status = ord1After?.items?.[0]?.status;

    if (
      click1.status === 200 &&
      click2.status === 200 &&
      click2.data?.data?.isIdempotent === true &&
      it1Status === 'Cooking'
    ) {
      pass('TC-01: Idempotent Sequential - Double-click start-cooking nối tiếp đều trả về 200 OK và isIdempotent: true');
      passed++;
    } else {
      fail('TC-01: Idempotent Sequential - Double-click thất bại', { click1, click2, it1Status });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-02: Idempotent Concurrent Double-Click (Song song 2 request cho cùng 1 món)
    // ------------------------------------------------------------------------
    const oRes2 = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ tableId: table2Id, items: [{ menuItemId: itemM2, quantity: 1 }] }),
    });
    const ord2Id = oRes2.data?.data?.id || oRes2.data?.data?._id;
    const it2Id = oRes2.data?.data?.items?.[0]?.id || oRes2.data?.data?.items?.[0]?._id;

    const [parallelCook1, parallelCook2] = await Promise.all([
      request(`/order-items/${it2Id}/start-cooking`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kitchenToken}` },
        body: JSON.stringify({ orderId: ord2Id }),
      }),
      request(`/order-items/${it2Id}/start-cooking`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kitchenToken}` },
        body: JSON.stringify({ orderId: ord2Id }),
      }),
    ]);

    const ord2After = (await request(`/orders/${ord2Id}`, { headers: { Authorization: `Bearer ${ownerToken}` } })).data?.data;
    const it2Status = ord2After?.items?.[0]?.status;

    // Tiếp tục kiểm tra concurrent double-click cho mark-ready
    const [parallelReady1, parallelReady2] = await Promise.all([
      request(`/order-items/${it2Id}/mark-ready`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kitchenToken}` },
        body: JSON.stringify({ orderId: ord2Id }),
      }),
      request(`/order-items/${it2Id}/mark-ready`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kitchenToken}` },
        body: JSON.stringify({ orderId: ord2Id }),
      }),
    ]);

    const ord2Final = (await request(`/orders/${ord2Id}`, { headers: { Authorization: `Bearer ${ownerToken}` } })).data?.data;
    const it2FinalStatus = ord2Final?.items?.[0]?.status;

    if (
      parallelCook1.status === 200 &&
      parallelCook2.status === 200 &&
      it2Status === 'Cooking' &&
      parallelReady1.status === 200 &&
      parallelReady2.status === 200 &&
      it2FinalStatus === 'Ready'
    ) {
      pass('TC-02: Idempotent Concurrent - 2 request song song start-cooking & mark-ready đều trả về 200 OK');
      passed++;
    } else {
      fail('TC-02: Idempotent Concurrent - Concurrent double-click thất bại', {
        parallelCook1,
        parallelCook2,
        parallelReady1,
        parallelReady2,
      });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-03: OCC Concurrency trên cùng 1 đơn - 4 request cập nhật 4 món khác nhau đồng thời (Zero Lost Update)
    // ------------------------------------------------------------------------
    const oRes3 = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        tableId: table3Id,
        items: [
          { menuItemId: itemM1, quantity: 1 },
          { menuItemId: itemM2, quantity: 1 },
          { menuItemId: itemM3, quantity: 1 },
          { menuItemId: itemM4, quantity: 1 },
        ],
      }),
    });
    const ord3Id = oRes3.data?.data?.id || oRes3.data?.data?._id;
    const items3 = oRes3.data?.data?.items || [];
    const idA = items3[0]?.id || items3[0]?._id;
    const idB = items3[1]?.id || items3[1]?._id;
    const idC = items3[2]?.id || items3[2]?._id;
    const idD = items3[3]?.id || items3[3]?._id;

    // Bắn đồng thời 4 request start-cooking cho 4 món khác nhau của cùng 1 đơn hàng
    const cookResults = await Promise.all([
      request(`/order-items/${idA}/start-cooking`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kitchenToken}` },
        body: JSON.stringify({ orderId: ord3Id }),
      }),
      request(`/order-items/${idB}/start-cooking`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kitchenToken}` },
        body: JSON.stringify({ orderId: ord3Id }),
      }),
      request(`/order-items/${idC}/start-cooking`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kitchenToken}` },
        body: JSON.stringify({ orderId: ord3Id }),
      }),
      request(`/order-items/${idD}/start-cooking`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kitchenToken}` },
        body: JSON.stringify({ orderId: ord3Id }),
      }),
    ]);

    const allCook200 = cookResults.every((r) => r.status === 200);

    const ord3AfterCook = (await request(`/orders/${ord3Id}`, { headers: { Authorization: `Bearer ${ownerToken}` } })).data?.data;
    const allItemsAreCooking = ord3AfterCook?.items?.every((i: any) => i.status === 'Cooking');
    const isOrderPreparing = ord3AfterCook?.status === 'Preparing';

    if (allCook200 && allItemsAreCooking && isOrderPreparing) {
      pass('TC-03: OCC Concurrency - 4 request đồng thời start-cooking trên cùng 1 đơn đều thành công (Zero Lost Update, toàn bộ món Cooking)');
      passed++;
    } else {
      fail('TC-03: OCC Concurrency - Xung đột phiên bản làm mất cập nhật (Lost Update)', {
        cookResults: cookResults.map((r) => r.status),
        allItemsAreCooking,
        isOrderPreparing,
        itemsStatus: ord3AfterCook?.items?.map((i: any) => i.status),
      });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-04: OCC Concurrency - 4 request đồng thời mark-ready làm đơn chuyển sang Ready
    // ------------------------------------------------------------------------
    const readyResults = await Promise.all([
      request(`/order-items/${idA}/mark-ready`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kitchenToken}` },
        body: JSON.stringify({ orderId: ord3Id }),
      }),
      request(`/order-items/${idB}/mark-ready`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kitchenToken}` },
        body: JSON.stringify({ orderId: ord3Id }),
      }),
      request(`/order-items/${idC}/mark-ready`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kitchenToken}` },
        body: JSON.stringify({ orderId: ord3Id }),
      }),
      request(`/order-items/${idD}/mark-ready`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kitchenToken}` },
        body: JSON.stringify({ orderId: ord3Id }),
      }),
    ]);

    const allReady200 = readyResults.every((r) => r.status === 200);

    const ord3Final = (await request(`/orders/${ord3Id}`, { headers: { Authorization: `Bearer ${ownerToken}` } })).data?.data;
    const allItemsAreReady = ord3Final?.items?.every((i: any) => i.status === 'Ready');
    const isOrderReady = ord3Final?.status === 'Ready';

    if (allReady200 && allItemsAreReady && isOrderReady) {
      pass('TC-04: OCC Concurrency - 4 request đồng thời mark-ready đều thành công và Order tự động nâng cấp sang Ready');
      passed++;
    } else {
      fail('TC-04: OCC Concurrency - mark-ready đồng thời thất bại', {
        readyResults: readyResults.map((r) => r.status),
        allItemsAreReady,
        isOrderReady,
      });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-05: AUD-7.3 Hardening - Chống Xung Đột Chéo Cross-Actor Race Condition (Pay vs Mark-Ready)
    // ------------------------------------------------------------------------
    // 1. Tạo bàn và đơn mới có 2 món
    const tHrd = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Bàn OCC Race', code: `BOR-${ts}`, zoneId, branchId }),
    });
    const tableHrdId = tHrd.data?.data?.id || tHrd.data?.data?._id;

    const ordHrdRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        tableId: tableHrdId,
        items: [
          { menuItemId: itemM1, quantity: 1 },
          { menuItemId: itemM2, quantity: 1 },
        ],
      }),
    });
    const ordHrdId = ordHrdRes.data?.data?.id || ordHrdRes.data?.data?._id;
    const ordHrdItemId = ordHrdRes.data?.data?.items?.[0]?.id || ordHrdRes.data?.data?.items?.[0]?._id;

    // Chuyển món sang Cooking
    await request(`/order-items/${ordHrdItemId}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ orderId: ordHrdId }),
    });

    // 2. Chạy đồng thời Thu ngân gọi pay() và Bếp gọi mark-ready
    const [payRaceRes, cookRaceRes] = await Promise.all([
      request(`/orders/${ordHrdId}/pay`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ paymentMethod: 'Cash', cashGiven: 500000 }),
      }),
      request(`/order-items/${ordHrdItemId}/mark-ready`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kitchenToken}` },
        body: JSON.stringify({ orderId: ordHrdId }),
      }),
    ]);

    // 3. Kiểm tra DB: Đơn hàng bắt buộc phải bảo toàn trạng thái Paid, không bao giờ bị KDS overwrite thành Preparing/Ready
    const ordHrdFinal = (await request(`/orders/${ordHrdId}`, { headers: { Authorization: `Bearer ${ownerToken}` } })).data?.data;

    if (
      payRaceRes.status === 200 &&
      ordHrdFinal?.status === 'Paid' &&
      ordHrdFinal?.isPaid === true
    ) {
      pass('TC-05: AUD-7.3 Hardening - Atomic OCC Filter bảo vệ toàn vẹn: Không thể ghi đè đơn Paid/Cancelled dù có race condition từ KDS');
      passed++;
    } else {
      fail('TC-05: AUD-7.3 Hardening thất bại', {
        payRaceStatus: payRaceRes.status,
        cookRaceStatus: cookRaceRes.status,
        finalStatus: ordHrdFinal?.status,
        isPaid: ordHrdFinal?.isPaid,
      });
      failed++;
    }

  } catch (err: any) {
    fail('FATAL EXCEPTION TRONG TEST SUITE 3', err.message || err);
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
          console.log('  ✔ [Teardown] Đã dọn dẹp sạch sẽ toàn bộ dữ liệu Suite 3 (Zero Garbage)');
        }
      } catch (e: any) {
        console.warn('Lỗi teardown Suite 3:', e.message);
      }
      await app.close();
    }
  }

  console.log(`\n${colors.bold}------------------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}Kết quả Suite 3 (KDS Concurrency & Idempotency): ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : colors.green}${failed} failed${colors.reset}`);
  console.log(`${colors.bold}------------------------------------------------------------------------${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
