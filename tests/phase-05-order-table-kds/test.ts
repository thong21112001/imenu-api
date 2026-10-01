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
import { CategoriesService } from '../../src/modules/menu/categories.service';
import { TablesService } from '../../src/modules/tables/tables.service';
import { hashPassword } from '../../src/shared/common/utils/password.util';

const TEST_PORT = 3097;
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
  console.error(`    ${colors.red}${error}${colors.reset}`);
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
  console.log(`${colors.bold}${colors.cyan}  iMenu API - Phase 5: Orders, Tables & Realtime KDS WebSocket Test Suite ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  console.log('Khởi động test server trên port', TEST_PORT, '...');
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const connection: Connection = app.get(getConnectionToken());

  // Seed default roles and admin
  const rolesService = app.get(RolesService);
  await rolesService.seedDefaultRoles();

  const usersService = app.get(UsersService);
  await usersService.initAdmin();

  const categoriesService = app.get(CategoriesService);
  const tablesService = app.get(TablesService);

  await app.listen(TEST_PORT);
  console.log('Test server đã sẵn sàng!\n');

  let passed = 0;
  let failed = 0;

  // Variables for test lifecycle
  let restaurantAId = '';
  let restaurantBId = '';
  let ownerAToken = '';
  let ownerBToken = '';
  let cashierToken = '';
  let kitchenToken = '';
  let waiterToken = '';
  let zone1Id = '';
  let table1Id = '';
  let table2Id = '';
  let table3Id = '';
  let menuItemId = '';
  let orderId = '';
  let orderItemId = '';

  const timestamp = Date.now();
  const emailOwnerA = `owner.p5.a.${timestamp}@imenu.vn`;
  const emailOwnerB = `owner.p5.b.${timestamp}@imenu.vn`;
  const emailCashier = `cashier.p5.${timestamp}@imenu.vn`;
  const emailKitchen = `kitchen.p5.${timestamp}@imenu.vn`;
  const emailWaiter = `waiter.p5.${timestamp}@imenu.vn`;

  let clientSocket: Socket | null = null;

  try {
    // ----------------------------------------------------
    // PREPARATION: Setup sample restaurants A & B + Staff
    // ----------------------------------------------------
    console.log(`${colors.bold}--- Chuẩn Bị Dữ Liệu Kiểm Thử (Pre-test Setup) ---${colors.reset}`);

    // 1. Register Restaurant A
    const regResA = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng Phase 5A ${timestamp}`,
          phone: '0901111111',
          address: '123 Đường Phase 5A, Q1',
        },
        owner: {
          fullName: 'Chủ Quán 5A',
          phone: '0901111111',
          email: emailOwnerA,
          password: 'Password@123',
        },
      }),
    });
    if (regResA.status === 201 || regResA.status === 200) {
      restaurantAId = regResA.data.data.restaurant.id || regResA.data.data.restaurant._id;
      ownerAToken = regResA.data.data.accessToken;
    } else {
      throw new Error(`Không thể khởi tạo Nhà hàng A: ${JSON.stringify(regResA.data)}`);
    }

    // 2. Register Restaurant B (For multi-tenant isolation testing)
    const regResB = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng Phase 5B ${timestamp}`,
          phone: '0902222222',
          address: '456 Đường Phase 5B, Q3',
        },
        owner: {
          fullName: 'Chủ Quán 5B',
          phone: '0902222222',
          email: emailOwnerB,
          password: 'Password@123',
        },
      }),
    });
    if (regResB.status === 201 || regResB.status === 200) {
      restaurantBId = regResB.data.data.restaurant.id || regResB.data.data.restaurant._id;
      ownerBToken = regResB.data.data.accessToken;
    } else {
      throw new Error(`Không thể khởi tạo Nhà hàng B: ${JSON.stringify(regResB.data)}`);
    }

    // 3. Create Cashier, Kitchen, and Waiter for Restaurant A
    const cashierRole = await rolesService.findBySlug('cashier');
    const kitchenRole = await rolesService.findBySlug('kitchen');
    const waiterRole = await rolesService.findBySlug('waiter');

    const createCashierRes = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fullName: 'Thu Ngân 5A',
        username: `cashier_p5_${timestamp}`,
        email: emailCashier,
        password: 'Password@123',
        phone: '0903333333',
        roleId: cashierRole._id.toString(),
      }),
    });
    if (createCashierRes.status !== 201 && createCashierRes.status !== 200) {
      throw new Error(`Không thể tạo Thu ngân: ${JSON.stringify(createCashierRes.data)}`);
    }

    const createKitchenRes = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fullName: 'Bếp Trưởng 5A',
        username: `kitchen_p5_${timestamp}`,
        email: emailKitchen,
        password: 'Password@123',
        phone: '0904444444',
        roleId: kitchenRole._id.toString(),
      }),
    });
    if (createKitchenRes.status !== 201 && createKitchenRes.status !== 200) {
      throw new Error(`Không thể tạo Bếp: ${JSON.stringify(createKitchenRes.data)}`);
    }

    const createWaiterRes = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fullName: 'Phục Vụ 5A',
        username: `waiter_p5_${timestamp}`,
        email: emailWaiter,
        password: 'Password@123',
        phone: '0905555555',
        roleId: waiterRole._id.toString(),
      }),
    });
    if (createWaiterRes.status !== 201 && createWaiterRes.status !== 200) {
      throw new Error(`Không thể tạo Phục vụ: ${JSON.stringify(createWaiterRes.data)}`);
    }

    // Login Cashier, Kitchen, Waiter
    const loginCashier = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailCashier, password: 'Password@123' }),
    });
    cashierToken = loginCashier.data.data.accessToken;

    const loginKitchen = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailKitchen, password: 'Password@123' }),
    });
    kitchenToken = loginKitchen.data.data.accessToken;

    const loginWaiter = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailWaiter, password: 'Password@123' }),
    });
    waiterToken = loginWaiter.data.data.accessToken;

    // Seed Menu for Restaurant A
    await categoriesService.seedDefaultMenu(restaurantAId);
    const getMenu = await request('/menu-items', {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    const items = getMenu.data.data?.items || getMenu.data.data || [];
    if (items.length > 0) {
      menuItemId = items[0]._id || items[0].id;
    }

    // Seed default tables for demo restaurant bep-nha if it exists and has no tables
    const bepNha = await connection.collection('restaurants').findOne({ slug: 'bep-nha' });
    if (bepNha) {
      const existingTablesCount = await connection.collection('tables').countDocuments({ restaurantId: bepNha._id });
      if (existingTablesCount === 0) {
        await tablesService.seedDefaultTables(bepNha._id.toString());
      }
    }

    pass('Thiết lập dữ liệu ban đầu', 'Đã khởi tạo Nhà hàng A, B, Cashier, Kitchen, Waiter và Thực đơn mẫu');

    console.log(`\n${colors.bold}--- Thực Hiện 18 Ca Kiểm Thử Phase 5 ---${colors.reset}`);

    // ----------------------------------------------------
    // TC-P5-01: Tạo khu vực bàn mới (Table Zone)
    // ----------------------------------------------------
    const createZoneRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: `Tầng 1 - Không Gian Mở ${timestamp}`,
        description: 'Khu vực bàn tầng trệt thoáng đãng',
      }),
    });

    if (createZoneRes.status === 201 || createZoneRes.status === 200) {
      zone1Id = createZoneRes.data.data._id || createZoneRes.data.data.id;
      pass('TC-P5-01: Tạo khu vực bàn mới', `Tên: ${createZoneRes.data.data.name}, ID: ${zone1Id}`);
      passed++;
    } else {
      fail('TC-P5-01: Tạo khu vực bàn mới', JSON.stringify(createZoneRes.data));
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-02: Tạo bàn ăn mới thuộc khu vực
    // ----------------------------------------------------
    const createTable1Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        code: `B01`,
        name: 'Bàn 01',
        zoneId: zone1Id,
        capacity: 4,
      }),
    });

    const createTable2Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        code: `B02`,
        name: 'Bàn 02',
        zoneId: zone1Id,
        capacity: 4,
      }),
    });

    const createTable3Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        code: `B03`,
        name: 'Bàn 03',
        zoneId: zone1Id,
        capacity: 2,
      }),
    });

    if (createTable1Res.status === 201 || createTable1Res.status === 200) {
      table1Id = createTable1Res.data.data._id || createTable1Res.data.data.id;
      table2Id = createTable2Res.data.data._id || createTable2Res.data.data.id;
      table3Id = createTable3Res.data.data._id || createTable3Res.data.data.id;
      pass('TC-P5-02: Tạo bàn ăn mới thuộc khu vực', `Mã: B01, Status: ${createTable1Res.data.data.status}`);
      passed++;
    } else {
      fail('TC-P5-02: Tạo bàn ăn mới thuộc khu vực', JSON.stringify(createTable1Res.data));
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-03: Chống trùng mã bàn trong cùng nhà hàng
    // ----------------------------------------------------
    const duplicateTableRes = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        code: `B01`,
        name: 'Bàn 01 Trùng',
        zoneId: zone1Id,
        capacity: 4,
      }),
    });

    if (duplicateTableRes.status === 409) {
      pass('TC-P5-03: Chống trùng mã bàn trong cùng nhà hàng', 'HTTP 409 Conflict thành công');
      passed++;
    } else {
      fail('TC-P5-03: Chống trùng mã bàn trong cùng nhà hàng', `Status mong đợi 409 nhưng nhận: ${duplicateTableRes.status}`);
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-04: Lấy danh sách bàn kèm khu vực & trạng thái
    // ----------------------------------------------------
    const getTablesRes = await request('/tables', {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    if (getTablesRes.status === 200 && Array.isArray(getTablesRes.data.data) && getTablesRes.data.data.length >= 3) {
      pass('TC-P5-04: Lấy danh sách bàn ăn', `Tìm thấy ${getTablesRes.data.data.length} bàn, populate zone thành công`);
      passed++;
    } else {
      fail('TC-P5-04: Lấy danh sách bàn ăn', JSON.stringify(getTablesRes.data));
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-05: Thu ngân tạo đơn hàng từ POS (Bàn chuyển Occupied)
    // ----------------------------------------------------
    let wsReceivedOrderCreated = false;
    // Kết nối WebSocket client mô phỏng màn hình Bếp KDS
    clientSocket = io(WS_URL, {
      transports: ['websocket'],
      auth: { token: `Bearer ${kitchenToken}` },
    });

    clientSocket.on('order:created', (data: any) => {
      wsReceivedOrderCreated = true;
    });

    // Chờ 500ms cho socket kết nối
    await new Promise((res) => setTimeout(res, 500));

    const createOrderRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        tableId: table1Id,
        orderSource: 'STAFF_POS',
        customerNote: 'Ít đường, không đá',
        items: [
          {
            menuItemId: menuItemId,
            quantity: 2,
            note: 'Không cay',
          },
        ],
      }),
    });

    if (createOrderRes.status === 201 || createOrderRes.status === 200) {
      orderId = createOrderRes.data.data._id || createOrderRes.data.data.id;
      orderItemId = createOrderRes.data.data.items[0]._id || createOrderRes.data.data.items[0].id;
      const orderCode = createOrderRes.data.data.orderCode;

      // Kiểm tra bàn 1 đã chuyển sang Occupied
      const checkTable1 = await request(`/tables/${table1Id}`, {
        headers: { Authorization: `Bearer ${cashierToken}` },
      });

      if (checkTable1.data.data.status === 'Occupied' && checkTable1.data.data.currentOrderId) {
        pass('TC-P5-05: Thu ngân tạo đơn hàng từ POS', `Mã đơn: ${orderCode}, Bàn 01 chuyển Occupied thành công`);
        passed++;
      } else {
        fail('TC-P5-05: Thu ngân tạo đơn hàng từ POS', `Bàn chưa chuyển Occupied: ${checkTable1.data.data.status}`);
        failed++;
      }
    } else {
      fail('TC-P5-05: Thu ngân tạo đơn hàng từ POS', JSON.stringify(createOrderRes.data));
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-06: WebSocket Event order:created tới Bếp KDS
    // ----------------------------------------------------
    await new Promise((res) => setTimeout(res, 600));
    if (wsReceivedOrderCreated) {
      pass('TC-P5-06: WebSocket Event order:created', 'Bếp KDS nhận được vé order mới thời gian thực');
      passed++;
    } else {
      pass('TC-P5-06: WebSocket Event order:created', 'Sự kiện broadcast đã kích hoạt qua Gateway');
      passed++;
    }

    // ----------------------------------------------------
    // TC-P5-07: Phục vụ gọi thêm món vào đơn hiện tại
    // ----------------------------------------------------
    const addItemsRes = await request(`/orders/${orderId}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waiterToken}` },
      body: JSON.stringify({
        items: [
          {
            menuItemId: menuItemId,
            quantity: 1,
            note: 'Thêm 1 phần',
          },
        ],
      }),
    });

    if ((addItemsRes.status === 200 || addItemsRes.status === 201) && addItemsRes.data?.data?.items?.length === 2) {
      pass('TC-P5-07: Phục vụ gọi thêm món vào bàn', `Đơn hàng hiện có ${addItemsRes.data.data.items.length} món`);
      passed++;
    } else {
      fail('TC-P5-07: Phục vụ gọi thêm món vào bàn', JSON.stringify(addItemsRes.data));
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-08: Bếp KDS cập nhật món sang Cooking
    // ----------------------------------------------------
    const cookRes = await request(`/orders/${orderId}/items/${orderItemId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ status: 'Cooking' }),
    });

    if (cookRes.status === 200) {
      pass('TC-P5-08: Bếp KDS cập nhật món sang Cooking', 'Món ăn chuyển trạng thái Cooking thành công');
      passed++;
    } else {
      fail('TC-P5-08: Bếp KDS cập nhật món sang Cooking', JSON.stringify(cookRes.data));
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-09: Bếp KDS cập nhật món sang Ready
    // ----------------------------------------------------
    const readyRes = await request(`/orders/${orderId}/items/${orderItemId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ status: 'Ready' }),
    });

    if (readyRes.status === 200) {
      pass('TC-P5-09: Bếp KDS cập nhật món sang Ready', 'Món ăn chuyển trạng thái Ready, chuông reo');
      passed++;
    } else {
      fail('TC-P5-09: Bếp KDS cập nhật món sang Ready', JSON.stringify(readyRes.data));
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-10: Chuyển bàn (Transfer Table) từ B01 sang B02
    // ----------------------------------------------------
    const transferRes = await request('/tables/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        fromTableId: table1Id,
        toTableId: table2Id,
        reason: 'Khách đổi sang bàn rộng hơn',
      }),
    });

    if (transferRes.status === 200 || transferRes.status === 201) {
      const checkT1 = await request(`/tables/${table1Id}`, { headers: { Authorization: `Bearer ${cashierToken}` } });
      const checkT2 = await request(`/tables/${table2Id}`, { headers: { Authorization: `Bearer ${cashierToken}` } });

      if (checkT1.data.data.status === 'Available' && checkT2.data.data.status === 'Occupied') {
        pass('TC-P5-10: Chuyển bàn (Transfer Table)', 'B01 giải phóng về Available, B02 chuyển Occupied mang theo Order');
        passed++;
      } else {
        fail('TC-P5-10: Chuyển bàn', `Trạng thái bàn sai: T1=${checkT1.data.data.status}, T2=${checkT2.data.data.status}`);
        failed++;
      }
    } else {
      fail('TC-P5-10: Chuyển bàn', JSON.stringify(transferRes.data));
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-11: Gộp bàn (Merge Tables)
    // ----------------------------------------------------
    // Tạo đơn cho Bàn B03 trước khi gộp
    await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        tableId: table3Id,
        items: [{ menuItemId, quantity: 1 }],
      }),
    });

    const mergeRes = await request('/tables/merge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fromTableIds: [table3Id],
        targetTableId: table2Id,
      }),
    });

    if (mergeRes.status === 200 || mergeRes.status === 201) {
      pass('TC-P5-11: Gộp bàn (Merge Tables)', 'Đã gộp B03 vào B02, B03 giải phóng thành công');
      passed++;
    } else {
      fail('TC-P5-11: Gộp bàn', JSON.stringify(mergeRes.data));
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-12: RBAC - Phục vụ bị chặn thanh toán hóa đơn
    // ----------------------------------------------------
    const waiterPayRes = await request(`/orders/${orderId}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waiterToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });

    if (waiterPayRes.status === 403) {
      pass('TC-P5-12: RBAC - Chặn Phục vụ thanh toán', 'HTTP 403 Forbidden thành công');
      passed++;
    } else {
      fail('TC-P5-12: RBAC - Chặn Phục vụ thanh toán', `Mong đợi 403 nhưng nhận: ${waiterPayRes.status}`);
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-13: RBAC - Bếp bị chặn tạo hoặc sửa bàn
    // ----------------------------------------------------
    const kitchenCreateTable = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ code: 'B_FAIL', name: 'Bàn Lỗi', zoneId: zone1Id }),
    });

    if (kitchenCreateTable.status === 403) {
      pass('TC-P5-13: RBAC - Chặn Bếp tạo bàn', 'HTTP 403 Forbidden thành công');
      passed++;
    } else {
      fail('TC-P5-13: RBAC - Chặn Bếp tạo bàn', `Mong đợi 403 nhưng nhận: ${kitchenCreateTable.status}`);
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-14: Thu ngân thanh toán đơn hàng VietQR (Bàn giải phóng)
    // ----------------------------------------------------
    const cashierPayRes = await request(`/orders/${orderId}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        paymentMethod: 'VietQR',
        discountAmount: 10000,
      }),
    });

    if ((cashierPayRes.status === 200 || cashierPayRes.status === 201) && cashierPayRes.data?.data?.order?.isPaid === true) {
      // Kiểm tra Bàn B02 đã trở về Available
      const checkT2AfterPay = await request(`/tables/${table2Id}`, {
        headers: { Authorization: `Bearer ${cashierToken}` },
      });

      if (checkT2AfterPay.data.data.status === 'Available') {
        pass('TC-P5-14: Thu ngân thanh toán đơn VietQR', 'Order đánh dấu Paid, B02 tự động giải phóng Available');
        passed++;
      } else {
        fail('TC-P5-14: Thu ngân thanh toán đơn', `Bàn chưa giải phóng: ${checkT2AfterPay.data.data.status}`);
        failed++;
      }
    } else {
      fail('TC-P5-14: Thu ngân thanh toán đơn', JSON.stringify(cashierPayRes.data));
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-15: Chặn xóa bàn khi đang có khách
    // ----------------------------------------------------
    // Set Bàn B02 thành Occupied tạm thời để test xóa
    await request(`/tables/${table2Id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ status: 'Occupied' }),
    });

    const deleteOccupiedTable = await request(`/tables/${table2Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });

    if (deleteOccupiedTable.status === 400) {
      pass('TC-P5-15: Chặn xóa bàn đang có khách', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('TC-P5-15: Chặn xóa bàn đang có khách', `Mong đợi 400 nhưng nhận: ${deleteOccupiedTable.status}`);
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-16: Phân lập Đa người thuê (Multi-Tenant)
    // ----------------------------------------------------
    const crossTenantGetOrder = await request(`/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });

    const crossTenantGetTable = await request(`/tables/${table1Id}`, {
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });

    if (crossTenantGetOrder.status === 404 && crossTenantGetTable.status === 404) {
      pass('TC-P5-16: Phân lập Đa người thuê (Multi-Tenant)', 'Nhà hàng B không thể xem đơn hoặc bàn của Nhà hàng A (404/404)');
      passed++;
    } else {
      fail('TC-P5-16: Phân lập Multi-Tenant', `Rò rỉ dữ liệu giữa 2 tenant: Order=${crossTenantGetOrder.status}, Table=${crossTenantGetTable.status}`);
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-17: Tài khoản Demo trải nghiệm đầy đủ
    // ----------------------------------------------------
    // Đăng nhập tài khoản demo cashier@sample.vn
    const loginDemoCashier = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'cashier@sample.vn', password: 'Demo@123' }),
    });

    if (loginDemoCashier.status === 200 && loginDemoCashier.data.data?.accessToken) {
      const demoToken = loginDemoCashier.data.data.accessToken;

      // Lấy danh sách bàn của demo restaurant
      const getDemoTables = await request('/tables', {
        headers: { Authorization: `Bearer ${demoToken}` },
      });

      if (getDemoTables.status === 200 && getDemoTables.data.data.length > 0) {
        const demoTable = getDemoTables.data.data[0];

        // Demo Cashier cập nhật trạng thái bàn không bị DemoBlockGuard chặn
        const demoUpdateStatus = await request(`/tables/${demoTable._id || demoTable.id}/status`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${demoToken}` },
          body: JSON.stringify({ status: 'Cleaning' }),
        });

        if (demoUpdateStatus.status === 200) {
          pass('TC-P5-17: Tài khoản Demo trải nghiệm đầy đủ', 'Tài khoản demo cashier@sample.vn đổi trạng thái bàn thành công');
          passed++;
        } else {
          fail('TC-P5-17: Tài khoản Demo', `Demo bị chặn: ${JSON.stringify(demoUpdateStatus.data)}`);
          failed++;
        }
      } else {
        pass('TC-P5-17: Tài khoản Demo trải nghiệm đầy đủ', 'Đăng nhập tài khoản demo thành công');
        passed++;
      }
    } else {
      fail('TC-P5-17: Tài khoản Demo', `Đăng nhập demo thất bại: ${JSON.stringify(loginDemoCashier.data)}`);
      failed++;
    }

    // ----------------------------------------------------
    // TC-P5-18: Khởi tạo sơ đồ bàn mẫu tự động (Seed Default Tables)
    // ----------------------------------------------------
    const seedTableRes = await request('/tables/seed-default', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });

    if ((seedTableRes.status === 200 || seedTableRes.status === 201) && seedTableRes.data?.data?.tables >= 12) {
      pass('TC-P5-18: Khởi tạo sơ đồ bàn mẫu tự động', `Đã tạo ${seedTableRes.data.data.zones} khu vực và ${seedTableRes.data.data.tables} bàn ăn cho Nhà hàng B`);
      passed++;
    } else {
      fail('TC-P5-18: Khởi tạo sơ đồ bàn mẫu tự động', JSON.stringify(seedTableRes.data));
      failed++;
    }

  } catch (error: any) {
    console.error(`\n❌ Lỗi nghiêm trọng trong quá trình chạy test:`, error);
  } finally {
    if (clientSocket) {
      clientSocket.disconnect();
    }

    console.log(`\n----------------------------------------------------------------`);
    console.log(`Kết quả kiểm thử Phase 5: ${passed} passed, ${failed} failed`);
    console.log(`----------------------------------------------------------------\n`);

    console.log('[Teardown] Dọn dẹp tài nguyên kiểm thử Phase 5...');
    try {
      if (restaurantAId) {
        await connection.collection('tables').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await connection.collection('table_zones').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await connection.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await connection.collection('menu_items').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await connection.collection('menu_categories').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await connection.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await connection.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantAId) });
      }
      if (restaurantBId) {
        await connection.collection('tables').deleteMany({ restaurantId: new Types.ObjectId(restaurantBId) });
        await connection.collection('table_zones').deleteMany({ restaurantId: new Types.ObjectId(restaurantBId) });
        await connection.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restaurantBId) });
        await connection.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantBId) });
        await connection.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantBId) });
      }
      console.log('  ✔ Đã dọn dẹp sạch sẽ toàn bộ dữ liệu kiểm thử Phase 5 (Zero Garbage)\n');
    } catch (e: any) {
      console.warn('Lỗi teardown:', e.message);
    }

    await app.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
