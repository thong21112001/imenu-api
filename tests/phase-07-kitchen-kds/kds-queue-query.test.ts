import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { RolesService } from '../../src/modules/roles/roles.service';
import { UsersService } from '../../src/modules/users/users.service';

const TEST_PORT = 3110;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 7 Suite 1: KDS Queue Query, FIFO & Multi-Tenant Isolation       ${colors.reset}`);
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
  let restAId = '';
  let restASlug = '';
  let ownerAToken = '';
  let branchA1Id = '';
  let branchA2Id = '';
  let zoneA1Id = '';
  let zoneA2Id = '';
  let tableA1Id = '';
  let tableA2Id = '';

  let restBId = '';
  let ownerBToken = '';
  let branchB1Id = '';
  let tableB1Id = '';

  let kitchenA1Token = '';
  let waiterA1Token = '';
  let kitchenA2Token = '';
  let kitchenB1Token = '';

  let itemPhoId = '';
  let itemBunChaId = '';
  let itemTraDaId = '';

  try {
    // ------------------------------------------------------------------------
    // SETUP: Tạo Nhà hàng A & B, Chi nhánh, Khu vực, Bàn ăn, Menu, Nhân viên
    // ------------------------------------------------------------------------
    const regResA = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng KDS A ${ts}`,
          phone: '0901234001',
          address: '123 Phố Ẩm Thực A',
        },
        owner: {
          fullName: 'Chủ Quán KDS A',
          phone: '0901234001',
          email: `owner.kds.a.${ts}@imenu.test`,
          password: 'Password@123',
        },
      }),
    });
    restAId = regResA.data?.data?.restaurant?.id || regResA.data?.data?.restaurant?._id;
    restASlug = regResA.data?.data?.restaurant?.slug;
    ownerAToken = regResA.data?.data?.accessToken;

    const meResA = await request('/auth/me', { headers: { Authorization: `Bearer ${ownerAToken}` } });
    branchA1Id = (meResA.data?.data?.user?.branchId || meResA.data?.data?.branchId || '').toString();

    // Chi nhánh A2
    const brResA2 = await request('/branches', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: `Chi nhánh A2 Phụ ${ts}`,
        code: `CN-A2-${ts}`,
        phone: '0901234002',
        address: '456 Lê Duẩn',
      }),
    });
    branchA2Id = (brResA2.data?.data?.id || brResA2.data?.data?._id || '').toString();

    // Khu vực A1 & A2
    const zRes1 = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ name: 'Tầng 1 - Sân Vườn', branchId: branchA1Id }),
    });
    zoneA1Id = zRes1.data?.data?.id || zRes1.data?.data?._id;

    const zRes2 = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ name: 'Tầng 2 - Máy Lạnh', branchId: branchA1Id }),
    });
    zoneA2Id = zRes2.data?.data?.id || zRes2.data?.data?._id;

    // Bàn A1 & A2
    const tblRes1 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: 'Bàn VIP 01',
        code: `A1-T1-${ts}`,
        capacity: 4,
        zoneId: zoneA1Id,
        branchId: branchA1Id,
      }),
    });
    tableA1Id = tblRes1.data?.data?.id || tblRes1.data?.data?._id;

    const tblRes2 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: 'Bàn Lầu 02',
        code: `A1-T2-${ts}`,
        capacity: 6,
        zoneId: zoneA2Id,
        branchId: branchA1Id,
      }),
    });
    tableA2Id = tblRes2.data?.data?.id || tblRes2.data?.data?._id;

    const tblRes3 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: 'Bàn Lầu 03',
        code: `A1-T3-${ts}`,
        capacity: 4,
        zoneId: zoneA2Id,
        branchId: branchA1Id,
      }),
    });
    const tableA3Id = tblRes3.data?.data?.id || tblRes3.data?.data?._id;

    // Chi nhánh A2: Khu vực & Bàn
    const zResA2 = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ name: 'Khu Chi Nhánh A2', branchId: branchA2Id }),
    });
    const zoneA2SubId = zResA2.data?.data?.id || zResA2.data?.data?._id;

    const tblResA2 = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: 'Bàn A2-01',
        code: `A2-T1-${ts}`,
        capacity: 4,
        zoneId: zoneA2SubId,
        branchId: branchA2Id,
      }),
    });
    const tableA2SubId = tblResA2.data?.data?.id || tblResA2.data?.data?._id;

    // Menu Items A
    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ name: 'Món Chính KDS', branchIds: [branchA1Id, branchA2Id] }),
    });
    const catId = catRes.data?.data?.id || catRes.data?.data?._id;

    const mRes1 = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: 'Phở Bò Tái Lăn',
        price: 65000,
        categoryId: catId,
        isAvailable: true,
      }),
    });
    itemPhoId = mRes1.data?.data?.id || mRes1.data?.data?._id;

    const mRes2 = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: 'Bún Chả Hà Nội',
        price: 60000,
        categoryId: catId,
        isAvailable: true,
      }),
    });
    itemBunChaId = mRes2.data?.data?.id || mRes2.data?.data?._id;

    const mRes3 = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: 'Trà Đá Hoa Nhài',
        price: 10000,
        categoryId: catId,
        isAvailable: true,
      }),
    });
    itemTraDaId = mRes3.data?.data?.id || mRes3.data?.data?._id;

    // Nhân viên Kitchen A1, Waiter A1, Kitchen A2 (Tạo qua /users với role slug chuẩn)
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fullName: 'Đầu Bếp Chi Nhánh A1',
        phone: '0902220001',
        email: `kitchen.a1.${ts}@imenu.test`,
        password: 'Password@123',
        role: 'kitchen',
        branchId: branchA1Id,
      }),
    });
    const lgnK1 = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `kitchen.a1.${ts}@imenu.test`, password: 'Password@123' }),
    });
    kitchenA1Token = lgnK1.data?.data?.accessToken;

    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fullName: 'Phục Vụ Chi Nhánh A1',
        phone: '0902220002',
        email: `waiter.a1.${ts}@imenu.test`,
        password: 'Password@123',
        role: 'waiter',
        branchId: branchA1Id,
      }),
    });
    const lgnW1 = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `waiter.a1.${ts}@imenu.test`, password: 'Password@123' }),
    });
    waiterA1Token = lgnW1.data?.data?.accessToken;

    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fullName: 'Đầu Bếp Chi Nhánh A2',
        phone: '0902220003',
        email: `kitchen.a2.${ts}@imenu.test`,
        password: 'Password@123',
        role: 'kitchen',
        branchId: branchA2Id,
      }),
    });
    const lgnK2 = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `kitchen.a2.${ts}@imenu.test`, password: 'Password@123' }),
    });
    kitchenA2Token = lgnK2.data?.data?.accessToken;

    // Nhà hàng B
    const regResB = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng Đối Thủ B ${ts}`,
          phone: '0903330001',
          address: '789 Đường B',
        },
        owner: {
          fullName: 'Chủ Quán B',
          phone: '0903330001',
          email: `owner.kds.b.${ts}@imenu.test`,
          password: 'Password@123',
        },
      }),
    });
    restBId = regResB.data?.data?.restaurant?.id || regResB.data?.data?.restaurant?._id;
    ownerBToken = regResB.data?.data?.accessToken;
    const meResB = await request('/auth/me', { headers: { Authorization: `Bearer ${ownerBToken}` } });
    branchB1Id = (meResB.data?.data?.user?.branchId || meResB.data?.data?.branchId || '').toString();

    const zResB = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBToken}` },
      body: JSON.stringify({ name: 'Khu Bàn B', branchId: branchB1Id }),
    });
    const zoneBId = zResB.data?.data?.id || zResB.data?.data?._id;

    const tblResB = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBToken}` },
      body: JSON.stringify({
        name: 'Bàn B1',
        code: `B1-T1-${ts}`,
        capacity: 4,
        zoneId: zoneBId,
        branchId: branchB1Id,
      }),
    });
    tableB1Id = tblResB.data?.data?.id || tblResB.data?.data?._id;

    const catResB = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBToken}` },
      body: JSON.stringify({ name: 'Món Quán B', branchIds: [branchB1Id] }),
    });
    const catBId = catResB.data?.data?.id || catResB.data?.data?._id;

    const mResB = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBToken}` },
      body: JSON.stringify({
        name: 'Mì Quảng B',
        price: 55000,
        categoryId: catBId,
        isAvailable: true,
      }),
    });
    const itemBId = mResB.data?.data?.id || mResB.data?.data?._id;

    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBToken}` },
      body: JSON.stringify({
        fullName: 'Đầu Bếp Quán B',
        phone: '0903330002',
        email: `kitchen.b1.${ts}@imenu.test`,
        password: 'Password@123',
        role: 'kitchen',
        branchId: branchB1Id,
      }),
    });
    const lgnKB = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `kitchen.b1.${ts}@imenu.test`, password: 'Password@123' }),
    });
    kitchenB1Token = lgnKB.data?.data?.accessToken;

    // ------------------------------------------------------------------------
    // TC-01: RBAC Check - Kitchen Staff truy cập /api/kitchen/orders (200 OK)
    // ------------------------------------------------------------------------
    const tc1 = await request('/kitchen/orders', {
      headers: { Authorization: `Bearer ${kitchenA1Token}` },
    });
    if (tc1.status === 200 && Array.isArray(tc1.data?.data)) {
      pass('TC-01: RBAC - Tài khoản Kitchen truy cập GET /api/kitchen/orders thành công (200 OK)');
      passed++;
    } else {
      fail('TC-01: RBAC - Tài khoản Kitchen không truy cập được /api/kitchen/orders', tc1);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-02: RBAC Check - Waiter Staff (không có quyền KDS view) bị chặn 403 Forbidden
    // ------------------------------------------------------------------------
    const tc2 = await request('/kitchen/orders', {
      headers: { Authorization: `Bearer ${waiterA1Token}` },
    });
    if (tc2.status === 403) {
      pass('TC-02: RBAC - Waiter staff bị chặn 403 Forbidden khi truy cập /api/kitchen/orders');
      passed++;
    } else {
      fail('TC-02: RBAC - Waiter staff không bị chặn 403', tc2);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-03: RBAC Check - Kitchen Staff truy cập /api/kitchen/items-summary (200 OK)
    // ------------------------------------------------------------------------
    const tc3Kitchen = await request('/kitchen/items-summary', {
      headers: { Authorization: `Bearer ${kitchenA1Token}` },
    });
    const tc3Waiter = await request('/kitchen/items-summary', {
      headers: { Authorization: `Bearer ${waiterA1Token}` },
    });
    if (tc3Kitchen.status === 200 && tc3Waiter.status === 403) {
      pass('TC-03: RBAC - GET /api/kitchen/items-summary cho phép Kitchen (200) và chặn Waiter (403)');
      passed++;
    } else {
      fail('TC-03: RBAC - GET /api/kitchen/items-summary phân quyền chưa chuẩn', { tc3Kitchen, tc3Waiter });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TẠO 3 ĐƠN HÀNG Ở CÁC THỜI ĐIỂM KHÁC NHAU ĐỂ KIỂM TRA FIFO
    // ------------------------------------------------------------------------
    // Order 1 (Tạo trước)
    const oRes1 = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        tableId: tableA1Id,
        items: [
          { menuItemId: itemPhoId, quantity: 2, note: 'Ít hành' },
          { menuItemId: itemTraDaId, quantity: 2 },
        ],
      }),
    });
    const order1Id = oRes1.data?.data?.id || oRes1.data?.data?._id;
    const order1Code = oRes1.data?.data?.orderCode;

    // Delay 50ms để đảm bảo timestamp createdAt khác biệt
    await new Promise((r) => setTimeout(r, 60));

    // Order 2 (Tạo giữa)
    const oRes2 = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        tableId: tableA2Id,
        items: [{ menuItemId: itemBunChaId, quantity: 1, note: 'Nhiều ớt' }],
      }),
    });
    const order2Id = oRes2.data?.data?.id || oRes2.data?.data?._id;
    const order2Code = oRes2.data?.data?.orderCode;

    await new Promise((r) => setTimeout(r, 60));

    // Order 3 (Tạo sau cùng)
    const oRes3 = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        tableId: tableA3Id,
        items: [{ menuItemId: itemPhoId, quantity: 1 }],
      }),
    });
    const order3Id = oRes3.data?.data?.id || oRes3.data?.data?._id;
    const order3Code = oRes3.data?.data?.orderCode;

    // ------------------------------------------------------------------------
    // TC-04: Thứ tự FIFO (createdAt ASC) trên hàng đợi KDS
    // ------------------------------------------------------------------------
    const tc4 = await request('/kitchen/orders', {
      headers: { Authorization: `Bearer ${kitchenA1Token}` },
    });
    const queueOrders = tc4.data?.data || [];
    const idx1 = queueOrders.findIndex((o: any) => (o.id || o._id) === order1Id);
    const idx2 = queueOrders.findIndex((o: any) => (o.id || o._id) === order2Id);
    const idx3 = queueOrders.findIndex((o: any) => (o.id || o._id) === order3Id);

    if (idx1 >= 0 && idx2 > idx1 && idx3 > idx2) {
      pass('TC-04: FIFO Ordering - Đơn hàng được sắp xếp chuẩn createdAt ASC (Đơn cũ ưu tiên xếp trước)', `idx1: ${idx1}, idx2: ${idx2}, idx3: ${idx3}`);
      passed++;
    } else {
      fail('TC-04: FIFO Ordering - Thứ tự đơn hàng không đúng FIFO', { idx1, idx2, idx3 });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-05: Loại trừ đơn đã kết thúc (Paid hoặc Cancelled không bao giờ vào KDS)
    // ------------------------------------------------------------------------
    // Hủy Order 2
    await request(`/orders/${order2Id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ reason: 'Khách đổi ý hủy bàn' }),
    });

    // Thanh toán Order 3
    await request(`/orders/${order3Id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash', cashGiven: 100000 }),
    });

    const tc5 = await request('/kitchen/orders', {
      headers: { Authorization: `Bearer ${kitchenA1Token}` },
    });
    const remainingOrders = tc5.data?.data || [];
    const hasCancelled = remainingOrders.some((o: any) => (o.id || o._id) === order2Id);
    const hasPaid = remainingOrders.some((o: any) => (o.id || o._id) === order3Id);
    const hasOrder1 = remainingOrders.some((o: any) => (o.id || o._id) === order1Id);

    if (!hasCancelled && !hasPaid && hasOrder1) {
      pass('TC-05: Exclude Finished Orders - Đơn Cancelled và Paid tự động biến mất khỏi hàng đợi KDS');
      passed++;
    } else {
      fail('TC-05: Exclude Finished Orders - Vẫn thấy đơn kết thúc trên KDS', { hasCancelled, hasPaid, hasOrder1 });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-06: Lọc theo zoneId, tableId, status, search
    // ------------------------------------------------------------------------
    // Lọc theo tableId
    const tc6Table = await request(`/kitchen/orders?tableId=${tableA1Id}`, {
      headers: { Authorization: `Bearer ${kitchenA1Token}` },
    });
    const tableFiltered = tc6Table.data?.data || [];
    const allTableA1 = tableFiltered.every((o: any) => {
      const tid = o.tableId?._id || o.tableId?.id || o.tableId;
      return tid === tableA1Id;
    });

    // Lọc theo search (mã đơn)
    const tc6Search = await request(`/kitchen/orders?search=${order1Code}`, {
      headers: { Authorization: `Bearer ${kitchenA1Token}` },
    });
    const searchFiltered = tc6Search.data?.data || [];
    const matchSearch = searchFiltered.length === 1 && (searchFiltered[0].id || searchFiltered[0]._id) === order1Id;

    if (allTableA1 && matchSearch) {
      pass('TC-06: Query Filters - Lọc chính xác theo tableId và tìm kiếm theo orderCode');
      passed++;
    } else {
      fail('TC-06: Query Filters - Bộ lọc trả về kết quả không chính xác', { allTableA1, searchFiltered });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-07: Gom nhóm số lượng món trong GET /api/kitchen/items-summary
    // ------------------------------------------------------------------------
    const tc7 = await request('/kitchen/items-summary', {
      headers: { Authorization: `Bearer ${kitchenA1Token}` },
    });
    const summaryItems = tc7.data?.data?.summary || tc7.data?.data?.items || [];
    const phoSummary = summaryItems.find((s: any) => s.menuItemId === itemPhoId);
    // Order 1 có 2x Phở Bò Tái Lăn đang Waiting
    if (phoSummary && (phoSummary.waitingQty >= 2 || phoSummary.waitingQuantity >= 2)) {
      pass('TC-07: Items Summary Aggregation - Gom nhóm chính xác số lượng món đang chờ chế biến', `Phở: ${phoSummary.waitingQty || phoSummary.waitingQuantity} đang chờ`);
      passed++;
    } else {
      fail('TC-07: Items Summary Aggregation - Gom nhóm số lượng món chưa đúng', { summaryItems });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-08: Multi-Tenant & Multi-Branch Isolation
    // ------------------------------------------------------------------------
    // Tạo 1 đơn ở Chi nhánh A2
    const oResA2 = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        tableId: tableA2SubId,
        branchId: branchA2Id,
        items: [{ menuItemId: itemPhoId, quantity: 3 }],
      }),
    });
    const orderA2Id = oResA2.data?.data?.id || oResA2.data?.data?._id;

    // Tạo 1 đơn ở Nhà hàng B
    const oResB = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBToken}` },
      body: JSON.stringify({
        tableId: tableB1Id,
        items: [{ menuItemId: itemBId, quantity: 1 }],
      }),
    });
    const orderBId = oResB.data?.data?.id || oResB.data?.data?._id;

    // Kitchen A1 chỉ thấy đơn của Branch A1, KHÔNG thấy đơn Branch A2 hay Quán B
    const k1Orders = (await request('/kitchen/orders', { headers: { Authorization: `Bearer ${kitchenA1Token}` } })).data?.data || [];
    const k1SeesA2 = k1Orders.some((o: any) => (o.id || o._id) === orderA2Id);
    const k1SeesB = k1Orders.some((o: any) => (o.id || o._id) === orderBId);

    // Kitchen B1 chỉ thấy đơn Quán B, KHÔNG thấy đơn Quán A
    const kBOrders = (await request('/kitchen/orders', { headers: { Authorization: `Bearer ${kitchenB1Token}` } })).data?.data || [];
    const kBSeesA1 = kBOrders.some((o: any) => (o.id || o._id) === order1Id);
    const kBSeesB = kBOrders.some((o: any) => (o.id || o._id) === orderBId);

    if (!k1SeesA2 && !k1SeesB && !kBSeesA1 && kBSeesB) {
      pass('TC-08: Multi-Tenant & Multi-Branch Isolation - Đầu bếp chỉ thấy đơn chi nhánh và nhà hàng của mình');
      passed++;
    } else {
      fail('TC-08: Multi-Tenant & Multi-Branch Isolation - Lọt dữ liệu giữa các chi nhánh hoặc nhà hàng', { k1SeesA2, k1SeesB, kBSeesA1, kBSeesB });
      failed++;
    }

    // ------------------------------------------------------------------------
    // TC-09: AUD-7.5 Hardening - Input Validation, ZoneId Check & Invariant Status Protection
    // ------------------------------------------------------------------------
    // 1. ZoneId sai format -> 400 Bad Request
    const badZoneRes = await request('/kitchen/orders?zoneId=invalid-zone-id', {
      headers: { Authorization: `Bearer ${kitchenA1Token}` },
    });

    // 2. Search quá dài (>100 chars) -> 400 Bad Request
    const longSearchStr = 'a'.repeat(105);
    const badSearchRes = await request(`/kitchen/orders?search=${longSearchStr}`, {
      headers: { Authorization: `Bearer ${kitchenA1Token}` },
    });

    // 3. Cố tình truy vấn status=Paid -> Không trả về đơn Paid nào (Zero leakage)
    const paidQueryRes = await request('/kitchen/orders?status=Paid', {
      headers: { Authorization: `Bearer ${kitchenA1Token}` },
    });
    const paidOrders = paidQueryRes.data?.data || [];

    if (
      badZoneRes.status === 400 &&
      badSearchRes.status === 400 &&
      paidQueryRes.status === 200 &&
      paidOrders.length === 0
    ) {
      pass('TC-09: AUD-7.5 Hardening - Chặn zoneId lỗi 400, search dài 400 và bảo vệ tuyệt đối không lọt đơn Paid trên KDS');
      passed++;
    } else {
      fail('TC-09: AUD-7.5 Hardening thất bại', {
        badZoneStatus: badZoneRes.status,
        badSearchStatus: badSearchRes.status,
        paidOrdersCount: paidOrders.length,
      });
      failed++;
    }

  } catch (err: any) {
    fail('FATAL EXCEPTION TRONG TEST SUITE 1', err.message || err);
    failed++;
  } finally {
    if (app) {
      try {
        const connection: Connection = app.get(getConnectionToken());
        const restIds = [restAId, restBId].filter(Boolean).map((id) => new Types.ObjectId(id));
        if (restIds.length > 0) {
          await connection.collection('tables').deleteMany({ restaurantId: { $in: restIds } });
          await connection.collection('table_zones').deleteMany({ restaurantId: { $in: restIds } });
          await connection.collection('orders').deleteMany({ restaurantId: { $in: restIds } });
          await connection.collection('menu_items').deleteMany({ restaurantId: { $in: restIds } });
          await connection.collection('menu_categories').deleteMany({ restaurantId: { $in: restIds } });
          await connection.collection('users').deleteMany({ restaurantId: { $in: restIds } });
          await connection.collection('restaurants').deleteMany({ _id: { $in: restIds } });
          console.log('  ✔ [Teardown] Đã dọn dẹp sạch sẽ toàn bộ dữ liệu Suite 1 (Zero Garbage)');
        }
      } catch (e: any) {
        console.warn('Lỗi teardown Suite 1:', e.message);
      }
      await app.close();
    }
  }

  console.log(`\n${colors.bold}------------------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}Kết quả Suite 1 (KDS Queue Query & RBAC): ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : colors.green}${failed} failed${colors.reset}`);
  console.log(`${colors.bold}------------------------------------------------------------------------${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
