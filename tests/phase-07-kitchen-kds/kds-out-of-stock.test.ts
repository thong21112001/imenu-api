import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../../src/app.module';
import { RolesService } from '../../src/modules/roles/roles.service';
import { UsersService } from '../../src/modules/users/users.service';

const TEST_PORT = 3113;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;
const WS_URL = `http://localhost:${TEST_PORT}`;

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
  console.log(`${colors.bold}${colors.cyan}  Phase 7 Suite 4: KDS Out-of-Stock (86), Branch Isolation & Realtime   ${colors.reset}`);
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
  let branchMainId = '';
  let branchSubId = '';
  let tableMainId = '';
  let kitchenMainToken = '';
  let kitchenSubToken = '';

  let itemPhoId = '';
  let itemNemId = '';

  let kitchenSocket: Socket | null = null;
  let tableSocket: Socket | null = null;

  try {
    // ------------------------------------------------------------------------
    // SETUP: Tạo Nhà hàng, 2 Chi nhánh (Main & Sub), 2 Bếp viên, Menu
    // ------------------------------------------------------------------------
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng 86 Realtime ${ts}`,
          phone: '0908880001',
          address: '888 Võ Văn Kiệt',
        },
        owner: {
          fullName: 'Chủ Quán 86',
          phone: '0908880001',
          email: `owner.86.${ts}@imenu.test`,
          password: 'Password@123',
        },
      }),
    });
    restId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    restSlug = regRes.data?.data?.restaurant?.slug;
    ownerToken = regRes.data?.data?.accessToken;

    const meRes = await request('/auth/me', { headers: { Authorization: `Bearer ${ownerToken}` } });
    branchMainId = (meRes.data?.data?.user?.branchId || meRes.data?.data?.branchId || '').toString();

    // Chi nhánh phụ
    const brSub = await request('/branches', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: `Chi nhánh Quận 7 ${ts}`,
        code: `CN-Q7-${ts}`,
        phone: '0908880002',
        address: '777 Nguyễn Thị Thập',
      }),
    });
    branchSubId = (brSub.data?.data?.id || brSub.data?.data?._id || '').toString();

    // Zone & Bàn ở chi nhánh chính
    const zRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Khu Realtime', branchId: branchMainId }),
    });
    const zoneId = zRes.data?.data?.id || zRes.data?.data?._id;

    const tblRes = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bàn Realtime 01',
        code: `RT-T1-${ts}`,
        capacity: 4,
        zoneId,
        branchId: branchMainId,
      }),
    });
    tableMainId = tblRes.data?.data?.id || tblRes.data?.data?._id;
    const tableMainQrToken = tblRes.data?.data?.qrToken;
    const tableMainCode = `RT-T1-${ts}`;

    const tblTrigger = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bàn Trigger Realtime',
        code: `RT-TRG-${ts}`,
        capacity: 4,
        zoneId,
        branchId: branchMainId,
      }),
    });
    const tableTriggerId = tblTrigger.data?.data?.id || tblTrigger.data?.data?._id;

    // Bàn trống kiểm tra QR gọi món hết hàng (Edge Case #2)
    const tblEmpty = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bàn Trống QR',
        code: `RT-EMP-${ts}`,
        capacity: 4,
        zoneId,
        branchId: branchMainId,
      }),
    });
    const tableEmptyCode = `RT-EMP-${ts}`;
    const tableEmptyQrToken = tblEmpty.data?.data?.qrToken;

    // Menu
    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Thực Đơn 86', branchIds: [branchMainId, branchSubId] }),
    });
    const catId = catRes.data?.data?.id || catRes.data?.data?._id;

    const mPho = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Phở Đặc Biệt', price: 95000, categoryId: catId, isAvailable: true }),
    });
    itemPhoId = mPho.data?.data?.id || mPho.data?.data?._id;

    const mNem = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Nem Rán Hải Sản', price: 75000, categoryId: catId, isAvailable: true }),
    });
    itemNemId = mNem.data?.data?.id || mNem.data?.data?._id;

    // Bếp viên Chi nhánh Chính
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Bếp Trưởng Main',
        phone: '0908880003',
        email: `chef.main.${ts}@imenu.test`,
        password: 'Password@123',
        role: 'kitchen',
        branchId: branchMainId,
      }),
    });
    const lgnMain = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `chef.main.${ts}@imenu.test`, password: 'Password@123' }),
    });
    kitchenMainToken = lgnMain.data?.data?.accessToken;

    // Bếp viên Chi nhánh Phụ
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Bếp Trưởng Sub',
        phone: '0908880004',
        email: `chef.sub.${ts}@imenu.test`,
        password: 'Password@123',
        role: 'kitchen',
        branchId: branchSubId,
      }),
    });
    const lgnSub = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `chef.sub.${ts}@imenu.test`, password: 'Password@123' }),
    });
    kitchenSubToken = lgnSub.data?.data?.accessToken;

    // ------------------------------------------------------------------------
    // TC-01: GET /api/kitchen/menu-items với tài khoản Kitchen (200 OK)
    // ------------------------------------------------------------------------
    const tc1 = await request('/kitchen/menu-items', {
      headers: { Authorization: `Bearer ${kitchenMainToken}` },
    });
    const itemsList = tc1.data?.data?.items || tc1.data?.data || [];
    if (tc1.status === 200 && Array.isArray(itemsList) && itemsList.length >= 2) {
      pass('TC-01: GET /api/kitchen/menu-items - Bếp viên xem danh sách món ăn để quản lý tồn món (200 OK)');
      passed++;
    } else {
      fail('TC-01: GET /api/kitchen/menu-items thất bại', tc1);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-02 & TC-03: Báo hết món (86) và Phân lập chi nhánh
    // ------------------------------------------------------------------------
    // Bếp Chi nhánh phụ báo hết món Phở Đặc Biệt (branchId: branchSubId)
    const toggleSubRes = await request(`/kitchen/menu-items/${itemPhoId}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenSubToken}` },
      body: JSON.stringify({ isAvailable: false, branchId: branchSubId }),
    });

    // Lấy menu tại Chi nhánh Phụ -> Phở phải là HẾT (effectiveIsAvailable = false)
    const menuSubCheck = await request(`/kitchen/menu-items?branchId=${branchSubId}`, {
      headers: { Authorization: `Bearer ${kitchenSubToken}` },
    });
    const phoInSub = (menuSubCheck.data?.data?.items || menuSubCheck.data?.data || []).find((i: any) => (i.id || i._id) === itemPhoId);

    // Lấy menu tại Chi nhánh Chính -> Phở vẫn CÒN (effectiveIsAvailable = true)
    const menuMainCheck = await request(`/kitchen/menu-items?branchId=${branchMainId}`, {
      headers: { Authorization: `Bearer ${kitchenMainToken}` },
    });
    const phoInMain = (menuMainCheck.data?.data?.items || menuMainCheck.data?.data || []).find((i: any) => (i.id || i._id) === itemPhoId);

    if (
      toggleSubRes.status === 200 &&
      phoInSub?.effectiveIsAvailable === false &&
      phoInMain?.effectiveIsAvailable === true
    ) {
      pass('TC-02 & TC-03: 86 Out-of-Stock & Branch Isolation - Bếp chi nhánh báo hết món chỉ áp dụng cho chi nhánh đó, không ảnh hưởng chi nhánh khác');
      passed++;
    } else {
      fail('TC-02 & TC-03: Branch Isolation thất bại', { phoInSub, phoInMain });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-04: Blueprint Edge Case #2 - Món đang trong đơn active vẫn nấu bình thường khi bị 86; khách mới gọi QR bị chặn
    // ------------------------------------------------------------------------
    // 1. Tạo đơn có Nem Rán khi còn hàng
    const oRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        tableId: tableMainId,
        items: [{ menuItemId: itemNemId, quantity: 2 }],
      }),
    });
    const activeOrderId = oRes.data?.data?.id || oRes.data?.data?._id;
    const activeItemId = oRes.data?.data?.items?.[0]?.id || oRes.data?.data?.items?.[0]?._id;

    // 2. Bếp báo hết Nem Rán trên toàn hệ thống
    const toggleNem = await request(`/kitchen/menu-items/${itemNemId}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenMainToken}` },
      body: JSON.stringify({ isAvailable: false }),
    });

    // 3. Đơn cũ vẫn nấu được (start-cooking) và hoàn tất (mark-ready)
    const cookExisting = await request(`/order-items/${activeItemId}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenMainToken}` },
      body: JSON.stringify({ orderId: activeOrderId }),
    });
    const readyExisting = await request(`/order-items/${activeItemId}/mark-ready`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenMainToken}` },
      body: JSON.stringify({ orderId: activeOrderId }),
    });

    // 4. Khách quét QR gọi MỚI món Nem Rán trên bàn trống -> BỊ CHẶN 400 Bad Request (Món đã hết)
    const newQrAttempt = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restSlug,
        tableCode: tableEmptyCode,
        qrToken: tableEmptyQrToken,
        items: [{ menuItemId: itemNemId, quantity: 1 }],
      }),
    });

    if (
      cookExisting.status === 200 &&
      readyExisting.status === 200 &&
      newQrAttempt.status === 400
    ) {
      pass('TC-04: Edge Case #2 - Món trong đơn cũ vẫn nấu/xong bình thường sau khi 86; khách gọi mới qua QR bị chặn 400 Bad Request');
      passed++;
    } else {
      fail('TC-04: Edge Case #2 thất bại', { cookExisting, readyExisting, newQrAttempt });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-05: Realtime WebSocket Synchronization (socket.io-client)
    // ------------------------------------------------------------------------
    const receivedEvents: string[] = [];

    // Kết nối Kitchen Socket
    kitchenSocket = io(WS_URL, {
      transports: ['websocket'],
      auth: { token: `Bearer ${kitchenMainToken}` },
    });

    // Kết nối Table Guest Socket
    tableSocket = io(WS_URL, {
      transports: ['websocket'],
      query: { restaurantId: restId, tableId: tableTriggerId },
    });

    await new Promise((r) => setTimeout(r, 400));

    kitchenSocket.emit('join:restaurant', { restaurantId: restId, branchId: branchMainId });
    tableSocket.emit('join:table', { tableId: tableTriggerId, restaurantId: restId });

    await new Promise((r) => setTimeout(r, 300));

    // Lắng nghe sự kiện
    kitchenSocket.on('order:created', () => receivedEvents.push('kitchen:order:created'));
    kitchenSocket.on('order:item_status_updated', (p) => receivedEvents.push(`kitchen:item_status:${p.status}`));
    kitchenSocket.on('menu:availability_changed', () => receivedEvents.push('kitchen:menu:availability_changed'));

    tableSocket.on('order:item_status_updated', (p) => receivedEvents.push(`table:item_status:${p.status}`));
    tableSocket.on('menu:availability_changed', () => receivedEvents.push('table:menu:availability_changed'));

    // 1. Tạo đơn mới -> trigger order:created
    const triggerOrder = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        tableId: tableTriggerId,
        items: [{ menuItemId: itemPhoId, quantity: 1 }],
      }),
    });
    const trigOrdId = triggerOrder.data?.data?.id || triggerOrder.data?.data?._id;
    const trigItemId = triggerOrder.data?.data?.items?.[0]?.id || triggerOrder.data?.data?.items?.[0]?._id;

    // 2. Chuyển trạng thái sang Cooking và Ready -> trigger order:item_status_updated
    await request(`/order-items/${trigItemId}/start-cooking`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenMainToken}` },
      body: JSON.stringify({ orderId: trigOrdId }),
    });

    await request(`/order-items/${trigItemId}/mark-ready`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenMainToken}` },
      body: JSON.stringify({ orderId: trigOrdId }),
    });

    // 3. Đổi availability món ăn -> trigger menu:availability_changed
    await request(`/kitchen/menu-items/${itemPhoId}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenMainToken}` },
      body: JSON.stringify({ isAvailable: true }),
    });

    // Chờ 600ms cho WebSocket nhận đủ
    await new Promise((r) => setTimeout(r, 600));

    const hasWsOrderCreated = receivedEvents.includes('kitchen:order:created');
    const hasWsCookingKitchen = receivedEvents.includes('kitchen:item_status:Cooking');
    const hasWsReadyTable = receivedEvents.includes('table:item_status:Ready');
    const hasWsMenuChangedTable = receivedEvents.includes('table:menu:availability_changed');

    if (hasWsOrderCreated && hasWsCookingKitchen && hasWsReadyTable && hasWsMenuChangedTable) {
      pass('TC-05: Realtime WebSocket - Bếp và Khách tại bàn nhận đồng bộ realtime: order:created, item_status_updated (Cooking & Ready), menu:availability_changed');
      passed++;
    } else {
      fail('TC-05: Realtime WebSocket - Thiếu sự kiện thời gian thực', { receivedEvents });
      failed++;
    }

  } catch (err: any) {
    fail('FATAL EXCEPTION TRONG TEST SUITE 4', err.message || err);
    failed++;
  } finally {
    if (kitchenSocket) kitchenSocket.disconnect();
    if (tableSocket) tableSocket.disconnect();
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
          console.log('  ✔ [Teardown] Đã dọn dẹp sạch sẽ toàn bộ dữ liệu Suite 4 (Zero Garbage)');
        }
      } catch (e: any) {
        console.warn('Lỗi teardown Suite 4:', e.message);
      }
      await app.close();
    }
  }

  console.log(`\n${colors.bold}------------------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}Kết quả Suite 4 (KDS Out-of-Stock & Realtime): ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : colors.green}${failed} failed${colors.reset}`);
  console.log(`${colors.bold}------------------------------------------------------------------------${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
