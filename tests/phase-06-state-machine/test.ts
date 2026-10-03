import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { RolesService } from '../../src/modules/roles/roles.service';
import { UsersService } from '../../src/modules/users/users.service';
import { OrderStateValidator } from '../../src/modules/orders/domain/order-state.validator';
import { calculateOrderStatus } from '../../src/modules/orders/domain/order-status.reducer';
import { OrderItem } from '../../src/modules/orders/entities/order-item.schema';
import { CategoriesService } from '../../src/modules/menu/categories.service';
import { TablesService } from '../../src/modules/tables/tables.service';

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
  return { status: res.status, data };
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  iMenu API - Sub-phase 6.2: State Machine & Domain Transitions Test Suite ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // ========================================================================
  // SECTION 1: UNIT TEST ORDER STATE MACHINE MATRIX (SECTION 12 A)
  // ========================================================================
  console.log(`\n${colors.bold}--- PHẦN A: KIỂM TRA MA TRẬN ORDER STATE MACHINE ---${colors.reset}`);

  // 1. WaitingConfirmation -> Preparing PASS
  try {
    OrderStateValidator.validateOrderTransition('WaitingConfirmation', 'Preparing');
    pass('Order: WaitingConfirmation -> Preparing', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('Order: WaitingConfirmation -> Preparing', e.message);
    failed++;
  }

  // 2. WaitingConfirmation -> Cancelled PASS
  try {
    OrderStateValidator.validateOrderTransition('WaitingConfirmation', 'Cancelled');
    pass('Order: WaitingConfirmation -> Cancelled', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('Order: WaitingConfirmation -> Cancelled', e.message);
    failed++;
  }

  // 3. WaitingConfirmation -> Paid FAIL
  try {
    OrderStateValidator.validateOrderTransition('WaitingConfirmation', 'Paid');
    fail('Order: WaitingConfirmation -> Paid', 'Lẽ ra phải chặn nhưng lại cho qua');
    failed++;
  } catch (e: any) {
    pass('Order: WaitingConfirmation -> Paid', 'Đã chặn thành công (Forbidden Transition)');
    passed++;
  }

  // 4. Preparing -> Ready PASS
  try {
    OrderStateValidator.validateOrderTransition('Preparing', 'Ready');
    pass('Order: Preparing -> Ready', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('Order: Preparing -> Ready', e.message);
    failed++;
  }

  // 5. Preparing -> Served PASS
  try {
    OrderStateValidator.validateOrderTransition('Preparing', 'Served');
    pass('Order: Preparing -> Served', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('Order: Preparing -> Served', e.message);
    failed++;
  }

  // 6. Preparing -> Cancelled PASS
  try {
    OrderStateValidator.validateOrderTransition('Preparing', 'Cancelled');
    pass('Order: Preparing -> Cancelled', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('Order: Preparing -> Cancelled', e.message);
    failed++;
  }

  // 7. Ready -> Served PASS
  try {
    OrderStateValidator.validateOrderTransition('Ready', 'Served');
    pass('Order: Ready -> Served', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('Order: Ready -> Served', e.message);
    failed++;
  }

  // 8. Ready -> Preparing PASS
  try {
    OrderStateValidator.validateOrderTransition('Ready', 'Preparing');
    pass('Order: Ready -> Preparing', 'Hợp lệ (thêm món mới đang nấu)');
    passed++;
  } catch (e: any) {
    fail('Order: Ready -> Preparing', e.message);
    failed++;
  }

  // 9. Served -> Preparing PASS
  try {
    OrderStateValidator.validateOrderTransition('Served', 'Preparing');
    pass('Order: Served -> Preparing', 'Hợp lệ (gọi thêm món mới)');
    passed++;
  } catch (e: any) {
    fail('Order: Served -> Preparing', e.message);
    failed++;
  }

  // 10. Served -> PaymentRequested PASS
  try {
    OrderStateValidator.validateOrderTransition('Served', 'PaymentRequested');
    pass('Order: Served -> PaymentRequested', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('Order: Served -> PaymentRequested', e.message);
    failed++;
  }

  // 11. PaymentRequested -> Paid PASS
  try {
    OrderStateValidator.validateOrderTransition('PaymentRequested', 'Paid');
    pass('Order: PaymentRequested -> Paid', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('Order: PaymentRequested -> Paid', e.message);
    failed++;
  }

  // 12. PaymentRequested -> Served PASS
  try {
    OrderStateValidator.validateOrderTransition('PaymentRequested', 'Served');
    pass('Order: PaymentRequested -> Served', 'Hợp lệ (hủy yêu cầu thanh toán)');
    passed++;
  } catch (e: any) {
    fail('Order: PaymentRequested -> Served', e.message);
    failed++;
  }

  // 13. Paid -> anything FAIL
  try {
    OrderStateValidator.validateOrderTransition('Paid', 'Preparing');
    fail('Order: Paid -> Preparing', 'Lẽ ra phải chặn nhưng lại cho qua');
    failed++;
  } catch (e: any) {
    pass('Order: Paid -> anything', 'Đã chặn thành công (Paid là Terminal State)');
    passed++;
  }

  // 14. Cancelled -> anything FAIL
  try {
    OrderStateValidator.validateOrderTransition('Cancelled', 'Preparing');
    fail('Order: Cancelled -> Preparing', 'Lẽ ra phải chặn nhưng lại cho qua');
    failed++;
  } catch (e: any) {
    pass('Order: Cancelled -> anything', 'Đã chặn thành công (Cancelled là Terminal State)');
    passed++;
  }

  // ========================================================================
  // SECTION 2: UNIT TEST ROUND STATE MACHINE MATRIX (SECTION 12 B)
  // ========================================================================
  console.log(`\n${colors.bold}--- PHẦN B: KIỂM TRA MA TRẬN ROUND STATE MACHINE ---${colors.reset}`);

  // 1. WaitingConfirmation -> Confirmed PASS
  try {
    OrderStateValidator.validateRoundTransition('WaitingConfirmation', 'Confirmed');
    pass('Round: WaitingConfirmation -> Confirmed', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('Round: WaitingConfirmation -> Confirmed', e.message);
    failed++;
  }

  // 2. WaitingConfirmation -> Cancelled PASS
  try {
    OrderStateValidator.validateRoundTransition('WaitingConfirmation', 'Cancelled');
    pass('Round: WaitingConfirmation -> Cancelled', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('Round: WaitingConfirmation -> Cancelled', e.message);
    failed++;
  }

  // 3. Confirmed -> anything FAIL
  try {
    OrderStateValidator.validateRoundTransition('Confirmed', 'WaitingConfirmation');
    fail('Round: Confirmed -> WaitingConfirmation', 'Lẽ ra phải chặn nhưng lại cho qua');
    failed++;
  } catch (e: any) {
    pass('Round: Confirmed -> anything', 'Đã chặn thành công (Confirmed là Terminal State)');
    passed++;
  }

  // 4. Cancelled -> anything FAIL
  try {
    OrderStateValidator.validateRoundTransition('Cancelled', 'Confirmed');
    fail('Round: Cancelled -> Confirmed', 'Lẽ ra phải chặn nhưng lại cho qua');
    failed++;
  } catch (e: any) {
    pass('Round: Cancelled -> anything', 'Đã chặn thành công (Cancelled là Terminal State)');
    passed++;
  }

  // ========================================================================
  // SECTION 3: UNIT TEST ORDER ITEM STATE MACHINE MATRIX (SECTION 12 C)
  // ========================================================================
  console.log(`\n${colors.bold}--- PHẦN C: KIỂM TRA MA TRẬN ORDER ITEM STATE MACHINE ---${colors.reset}`);

  // 1. WaitingConfirmation -> Waiting PASS
  try {
    OrderStateValidator.validateItemTransition('WaitingConfirmation', 'Waiting');
    pass('OrderItem: WaitingConfirmation -> Waiting', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('OrderItem: WaitingConfirmation -> Waiting', e.message);
    failed++;
  }

  // 2. WaitingConfirmation -> Cancelled PASS
  try {
    OrderStateValidator.validateItemTransition('WaitingConfirmation', 'Cancelled');
    pass('OrderItem: WaitingConfirmation -> Cancelled', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('OrderItem: WaitingConfirmation -> Cancelled', e.message);
    failed++;
  }

  // 3. Waiting -> Cooking PASS
  try {
    OrderStateValidator.validateItemTransition('Waiting', 'Cooking');
    pass('OrderItem: Waiting -> Cooking', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('OrderItem: Waiting -> Cooking', e.message);
    failed++;
  }

  // 4. Waiting -> Cancelled PASS
  try {
    OrderStateValidator.validateItemTransition('Waiting', 'Cancelled');
    pass('OrderItem: Waiting -> Cancelled', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('OrderItem: Waiting -> Cancelled', e.message);
    failed++;
  }

  // 5. Cooking -> Ready PASS
  try {
    OrderStateValidator.validateItemTransition('Cooking', 'Ready');
    pass('OrderItem: Cooking -> Ready', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('OrderItem: Cooking -> Ready', e.message);
    failed++;
  }

  // 6. Cooking -> Cancelled PASS
  try {
    OrderStateValidator.validateItemTransition('Cooking', 'Cancelled');
    pass('OrderItem: Cooking -> Cancelled', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('OrderItem: Cooking -> Cancelled', e.message);
    failed++;
  }

  // 7. Ready -> Served PASS
  try {
    OrderStateValidator.validateItemTransition('Ready', 'Served');
    pass('OrderItem: Ready -> Served', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('OrderItem: Ready -> Served', e.message);
    failed++;
  }

  // 8. Ready -> Cancelled PASS
  try {
    OrderStateValidator.validateItemTransition('Ready', 'Cancelled');
    pass('OrderItem: Ready -> Cancelled', 'Hợp lệ');
    passed++;
  } catch (e: any) {
    fail('OrderItem: Ready -> Cancelled', e.message);
    failed++;
  }

  // 9. Served -> Cancelled PASS
  try {
    OrderStateValidator.validateItemTransition('Served', 'Cancelled');
    pass('OrderItem: Served -> Cancelled', 'Hợp lệ (khách trả món đã ra)');
    passed++;
  } catch (e: any) {
    fail('OrderItem: Served -> Cancelled', e.message);
    failed++;
  }

  // 10. Served -> Cooking FAIL
  try {
    OrderStateValidator.validateItemTransition('Served', 'Cooking');
    fail('OrderItem: Served -> Cooking', 'Lẽ ra phải chặn nhưng lại cho qua');
    failed++;
  } catch (e: any) {
    pass('OrderItem: Served -> Cooking', 'Đã chặn thành công (Forbidden Transition)');
    passed++;
  }

  // 11. Ready -> Cooking FAIL
  try {
    OrderStateValidator.validateItemTransition('Ready', 'Cooking');
    fail('OrderItem: Ready -> Cooking', 'Lẽ ra phải chặn nhưng lại cho qua');
    failed++;
  } catch (e: any) {
    pass('OrderItem: Ready -> Cooking', 'Đã chặn thành công (Forbidden Transition)');
    passed++;
  }

  // 12. Cancelled -> any FAIL
  try {
    OrderStateValidator.validateItemTransition('Cancelled', 'Cooking');
    fail('OrderItem: Cancelled -> Cooking', 'Lẽ ra phải chặn nhưng lại cho qua');
    failed++;
  } catch (e: any) {
    pass('OrderItem: Cancelled -> any', 'Đã chặn thành công (Cancelled là Terminal State)');
    passed++;
  }

  // 13. Paid Order Item -> any FAIL
  try {
    OrderStateValidator.validateItemTransition('Served', 'Cancelled', true); // isOrderPaid = true
    fail('OrderItem: Paid Order Item -> Cancelled', 'Lẽ ra phải chặn nhưng lại cho qua');
    failed++;
  } catch (e: any) {
    pass('OrderItem: Paid Order Item -> any', 'Đã chặn thành công (Đơn hàng đã Paid)');
    passed++;
  }

  // ========================================================================
  // SECTION 4: UNIT TEST ORDER STATUS REDUCER (SECTION 12 D)
  // ========================================================================
  console.log(`\n${colors.bold}--- PHẦN D: KIỂM TRA ORDER STATUS REDUCER (7 RULES) ---${colors.reset}`);

  function makeMockItem(status: any): OrderItem {
    return {
      status,
      menuItemId: new Types.ObjectId(),
      name: 'Món mẫu',
      price: 50000,
      quantity: 1,
      selectedOptions: [],
      roundNumber: 1,
      itemTotal: 50000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // 1. Waiting + Served => Preparing
  const res1 = calculateOrderStatus(
    [makeMockItem('Waiting'), makeMockItem('Served')],
    'Preparing',
  );
  if (res1 === 'Preparing') {
    pass('Reducer Rule 1: Waiting + Served', `Kết quả: ${res1}`);
    passed++;
  } else {
    fail('Reducer Rule 1: Waiting + Served', `Mong đợi Preparing nhưng nhận: ${res1}`);
    failed++;
  }

  // 2. Cooking + Served => Preparing
  const res2 = calculateOrderStatus(
    [makeMockItem('Cooking'), makeMockItem('Served')],
    'Preparing',
  );
  if (res2 === 'Preparing') {
    pass('Reducer Rule 2: Cooking + Served', `Kết quả: ${res2}`);
    passed++;
  } else {
    fail('Reducer Rule 2: Cooking + Served', `Mong đợi Preparing nhưng nhận: ${res2}`);
    failed++;
  }

  // 3. Ready + Served => Ready
  const res3 = calculateOrderStatus(
    [makeMockItem('Ready'), makeMockItem('Served')],
    'Preparing',
  );
  if (res3 === 'Ready') {
    pass('Reducer Rule 3: Ready + Served', `Kết quả: ${res3}`);
    passed++;
  } else {
    fail('Reducer Rule 3: Ready + Served', `Mong đợi Ready nhưng nhận: ${res3}`);
    failed++;
  }

  // 4. all Served => Served
  const res4 = calculateOrderStatus(
    [makeMockItem('Served'), makeMockItem('Served')],
    'Ready',
  );
  if (res4 === 'Served') {
    pass('Reducer Rule 4: all Served', `Kết quả: ${res4}`);
    passed++;
  } else {
    fail('Reducer Rule 4: all Served', `Mong đợi Served nhưng nhận: ${res4}`);
    failed++;
  }

  // 5. Cancelled + Served => Served
  const res5 = calculateOrderStatus(
    [makeMockItem('Cancelled'), makeMockItem('Served')],
    'Preparing',
  );
  if (res5 === 'Served') {
    pass('Reducer Rule 5: Cancelled + Served', `Kết quả: ${res5}`);
    passed++;
  } else {
    fail('Reducer Rule 5: Cancelled + Served', `Mong đợi Served nhưng nhận: ${res5}`);
    failed++;
  }

  // 6. WaitingConfirmation + Served => Served
  const res6 = calculateOrderStatus(
    [makeMockItem('WaitingConfirmation'), makeMockItem('Served')],
    'Served',
  );
  if (res6 === 'Served') {
    pass('Reducer Rule 6: WaitingConfirmation + Served', `Kết quả: ${res6} (Bỏ qua WaitingConfirmation)`);
    passed++;
  } else {
    fail('Reducer Rule 6: WaitingConfirmation + Served', `Mong đợi Served nhưng nhận: ${res6}`);
    failed++;
  }

  // 7. Confirmed new round with Waiting item => Preparing
  const res7 = calculateOrderStatus(
    [makeMockItem('Served'), makeMockItem('Waiting')],
    'Served',
  );
  if (res7 === 'Preparing') {
    pass('Reducer Rule 7: confirmed new round with Waiting item', `Kết quả: ${res7} (Served quay về Preparing)`);
    passed++;
  } else {
    fail('Reducer Rule 7: confirmed new round with Waiting item', `Mong đợi Preparing nhưng nhận: ${res7}`);
    failed++;
  }

  // ========================================================================
  // SECTION 5: INTEGRATION TESTS WITH HTTP ENDPOINTS (SECTIONS 12 E & DOMAIN TRANSITIONS)
  // ========================================================================
  console.log(`\n${colors.bold}--- PHẦN E: INTEGRATION TEST DOMAIN TRANSITIONS & RBAC & SUPER ADMIN ---${colors.reset}`);

  console.log('Khởi động test server trên port', TEST_PORT, '...');
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const connection: Connection = app.get(getConnectionToken());
  const rolesService = app.get(RolesService);
  await rolesService.seedDefaultRoles();

  const usersService = app.get(UsersService);
  await usersService.initAdmin();

  const categoriesService = app.get(CategoriesService);
  const tablesService = app.get(TablesService);

  await app.listen(TEST_PORT);
  console.log('Test server đã sẵn sàng!\n');

  const timestamp = Date.now();
  let restaurantId = '';
  let branchId = '';
  let ownerToken = '';
  let cashierToken = '';
  let waiterToken = '';
  let kitchenToken = '';
  let superAdminToken = '';
  let tableId = '';
  let menuItemId = '';

  try {
    // 1. Đăng ký Nhà hàng A và Chủ nhà hàng qua /auth/register
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng State Machine ${timestamp}`,
          phone: '0908888777',
          address: '123 Đường Test SM, Quận 1',
        },
        owner: {
          fullName: 'Chủ Nhà Hàng SM',
          phone: '0908888777',
          email: `owner.sm.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });

    if (regRes.status !== 201 && regRes.status !== 200) {
      throw new Error(`Đăng ký nhà hàng thất bại: ${JSON.stringify(regRes.data)}`);
    }

    restaurantId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    ownerToken = regRes.data?.data?.accessToken;

    const restDoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    branchId = restDoc!.branches[0]._id.toString();

    // 2. Tạo Cashier, Waiter, Kitchen qua POST /users với ownerToken
    const cashierRole = await rolesService.findBySlug('cashier');
    const waiterRole = await rolesService.findBySlug('waiter');
    const kitchenRole = await rolesService.findBySlug('kitchen');

    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Thu Ngân SM',
        username: `cashier_sm_${timestamp}`,
        email: `cashier.sm.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0903333333',
        roleId: cashierRole._id.toString(),
      }),
    });

    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Bồi Bàn SM',
        username: `waiter_sm_${timestamp}`,
        email: `waiter.sm.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0904444444',
        roleId: waiterRole._id.toString(),
      }),
    });

    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Bếp Trưởng SM',
        username: `kitchen_sm_${timestamp}`,
        email: `kitchen.sm.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0905555555',
        roleId: kitchenRole._id.toString(),
      }),
    });

    // 3. Đăng nhập lấy token
    const loginUser = async (email: string) => {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'Password@123' }),
      });
      return res.data?.data?.accessToken;
    };

    cashierToken = await loginUser(`cashier.sm.${timestamp}@imenu.vn`);
    waiterToken = await loginUser(`waiter.sm.${timestamp}@imenu.vn`);
    kitchenToken = await loginUser(`kitchen.sm.${timestamp}@imenu.vn`);

    // Đăng nhập Super Admin
    const loginSuperAdmin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@imenu.vn', password: 'SuperAdmin@2026!' }),
    });
    superAdminToken = loginSuperAdmin.data?.data?.accessToken;

    // 4. Tạo thực đơn và bàn ăn
    await categoriesService.seedDefaultMenu(restaurantId);
    const getMenu = await request('/menu-items', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const items = getMenu.data?.data?.items || getMenu.data?.data || [];
    menuItemId = items[0]?._id || items[0]?.id;

    // Tạo khu vực và bàn ăn qua API
    const createZoneRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Khu SM' }),
    });
    const zoneId = createZoneRes.data?.data?._id || createZoneRes.data?.data?.id;

    const createTableRes = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        code: `TB-SM-01`,
        name: 'Bàn SM 01',
        zoneId,
        capacity: 4,
      }),
    });
    tableId = createTableRes.data?.data?._id || createTableRes.data?.data?.id;

    // ------------------------------------------------------------------------
    // TEST FLOW 1: QR CUSTOMER ORDER -> WaitingConfirmation
    // ------------------------------------------------------------------------
    const qrOrderRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        tableId,
        orderSource: 'QR_CUSTOMER',
        branchId,
        items: [{ menuItemId, quantity: 2, note: 'Tái vừa' }],
      }),
    });

    const qrOrder = qrOrderRes.data?.data;
    if (
      qrOrderRes.status === 201 &&
      qrOrder?.status === 'WaitingConfirmation' &&
      qrOrder?.rounds[0]?.status === 'WaitingConfirmation' &&
      qrOrder?.items[0]?.status === 'WaitingConfirmation'
    ) {
      pass('Flow 1: QR Order khởi tạo', 'Order = WaitingConfirmation, Round = WaitingConfirmation, Items = WaitingConfirmation');
      passed++;
    } else {
      fail('Flow 1: QR Order khởi tạo', JSON.stringify(qrOrderRes.data));
      failed++;
    }

    const qrOrderId = qrOrder?._id;

    // ------------------------------------------------------------------------
    // TEST FLOW 2: WaitingConfirmation -> Paid = FORBIDDEN (400 Bad Request)
    // ------------------------------------------------------------------------
    const payWaitingRes = await request(`/orders/${qrOrderId}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });

    if (payWaitingRes.status === 400) {
      pass('Flow 2: WaitingConfirmation -> Paid bị cấm', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('Flow 2: WaitingConfirmation -> Paid bị cấm', `Mong đợi 400 nhưng nhận: ${payWaitingRes.status}`);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST FLOW 3: RBAC - Waiter không có POS.CONFIRM không được duyệt Round
    // ------------------------------------------------------------------------
    const waiterConfirmRoundRes = await request(`/orders/${qrOrderId}/rounds/1/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waiterToken}` },
    });

    if (waiterConfirmRoundRes.status === 403) {
      pass('Flow 3: RBAC - Chặn Waiter duyệt Round (không có POS.CONFIRM)', 'HTTP 403 Forbidden thành công');
      passed++;
    } else {
      fail('Flow 3: RBAC - Chặn Waiter duyệt Round', `Mong đợi 403 nhưng nhận: ${waiterConfirmRoundRes.status}`);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST FLOW 4: Cashier có POS.CONFIRM -> Duyệt Round 1 thành công
    // Round -> Confirmed, Item -> Waiting, Order -> Preparing
    // ------------------------------------------------------------------------
    const cashierConfirmRoundRes = await request(`/orders/${qrOrderId}/rounds/1/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    const confirmedOrder = cashierConfirmRoundRes.data?.data;
    if (
      cashierConfirmRoundRes.status === 200 &&
      confirmedOrder?.rounds[0]?.status === 'Confirmed' &&
      confirmedOrder?.items[0]?.status === 'Waiting' &&
      confirmedOrder?.status === 'Preparing'
    ) {
      pass('Flow 4: Duyệt Round 1 (Confirm Round)', 'Round -> Confirmed, Item -> Waiting, Order -> Preparing');
      passed++;
    } else {
      fail('Flow 4: Duyệt Round 1', JSON.stringify(cashierConfirmRoundRes.data));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST FLOW 5: Chặn duyệt lại Round đã Confirmed (Terminal State)
    // ------------------------------------------------------------------------
    const reconfirmRoundRes = await request(`/orders/${qrOrderId}/rounds/1/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    if (reconfirmRoundRes.status === 400) {
      pass('Flow 5: Chặn duyệt lại Round đã Confirmed', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('Flow 5: Chặn duyệt lại Round đã Confirmed', `Mong đợi 400 nhưng nhận: ${reconfirmRoundRes.status}`);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST FLOW 6: Bếp KDS cập nhật tiến độ món (Waiting -> Cooking -> Ready -> Served)
    // ------------------------------------------------------------------------
    const orderItemId = confirmedOrder.items[0]._id;

    // Cooking
    const cookRes = await request(`/orders/${qrOrderId}/items/${orderItemId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ status: 'Cooking' }),
    });
    if (cookRes.status === 200 && cookRes.data?.data?.items[0]?.status === 'Cooking') {
      pass('Flow 6.1: Món chuyển sang Cooking', 'Item = Cooking, Order = Preparing');
      passed++;
    } else {
      fail('Flow 6.1: Món chuyển sang Cooking', JSON.stringify(cookRes.data));
      failed++;
    }

    // Ready -> Order status thành Ready
    const readyRes = await request(`/orders/${qrOrderId}/items/${orderItemId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ status: 'Ready' }),
    });
    if (readyRes.status === 200 && readyRes.data?.data?.status === 'Ready') {
      pass('Flow 6.2: Món chuyển sang Ready', 'Item = Ready, Order = Ready');
      passed++;
    } else {
      fail('Flow 6.2: Món chuyển sang Ready', JSON.stringify(readyRes.data));
      failed++;
    }

    // Served -> Order status thành Served
    const servedRes = await request(`/orders/${qrOrderId}/items/${orderItemId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ status: 'Served' }),
    });
    if (servedRes.status === 200 && servedRes.data?.data?.status === 'Served') {
      pass('Flow 6.3: Món chuyển sang Served', 'Item = Served, Order = Served');
      passed++;
    } else {
      fail('Flow 6.3: Món chuyển sang Served', JSON.stringify(servedRes.data));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST FLOW 7: Yêu cầu thanh toán (Served -> PaymentRequested)
    // ------------------------------------------------------------------------
    const reqPayRes = await request(`/orders/${qrOrderId}/request-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    if (reqPayRes.status === 200 && reqPayRes.data?.data?.status === 'PaymentRequested') {
      pass('Flow 7: Yêu cầu thanh toán (Served -> PaymentRequested)', 'Order = PaymentRequested thành công');
      passed++;
    } else {
      fail('Flow 7: Yêu cầu thanh toán', JSON.stringify(reqPayRes.data));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST FLOW 8: Thanh toán đơn hàng (PaymentRequested -> Paid) & giải phóng bàn
    // ------------------------------------------------------------------------
    const payRes = await request(`/orders/${qrOrderId}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR', discountAmount: 10000 }),
    });

    if (payRes.status === 200 && payRes.data?.data?.order?.status === 'Paid') {
      const tableCheck = await connection.collection('tables').findOne({ _id: new Types.ObjectId(tableId) });
      if (tableCheck?.status === 'Available') {
        pass('Flow 8: Thanh toán đơn (PaymentRequested -> Paid)', 'Order = Paid, Bàn tự động giải phóng Available');
        passed++;
      } else {
        fail('Flow 8: Thanh toán đơn', `Bàn chưa giải phóng: ${tableCheck?.status}`);
        failed++;
      }
    } else {
      fail('Flow 8: Thanh toán đơn', JSON.stringify(payRes.data));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST FLOW 9: Chặn sửa/hủy đơn đã Paid (Terminal State Invariant)
    // ------------------------------------------------------------------------
    const cancelPaidRes = await request(`/orders/${qrOrderId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Khách muốn hủy sau khi đã trả tiền' }),
    });

    if (cancelPaidRes.status === 400) {
      pass('Flow 9: Chặn hủy đơn đã thanh toán (Paid is Terminal)', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('Flow 9: Chặn hủy đơn đã thanh toán', `Mong đợi 400 nhưng nhận: ${cancelPaidRes.status}`);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST FLOW 10: SUPER ADMIN TUÂN THỦ BUSINESS INVARIANTS (KHÔNG ĐƯỢC BYPASS)
    // ------------------------------------------------------------------------
    // Super Admin cố gắng hủy đơn đã Paid -> Phải bị chặn 400 Bad Request
    const superAdminCancelPaidRes = await request(`/orders/${qrOrderId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({ reason: 'Super Admin hủy đơn Paid' }),
    });

    if (superAdminCancelPaidRes.status === 400) {
      pass('Flow 10: Super Admin tuân thủ Business Invariants', 'Super Admin cũng không thể hủy đơn đã Paid (HTTP 400)');
      passed++;
    } else {
      fail('Flow 10: Super Admin tuân thủ Business Invariants', `Mong đợi 400 nhưng nhận: ${superAdminCancelPaidRes.status}`);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST FLOW 11: CANCEL ITEM VÀ TÍNH LẠI TỔNG TIỀN (RECALCULATE TOTALS)
    // ------------------------------------------------------------------------
    // Tạo đơn mới với 2 món
    const order2Res = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        tableId,
        orderSource: 'STAFF_POS',
        branchId,
        items: [
          { menuItemId, quantity: 1, note: 'Món 1' },
          { menuItemId, quantity: 2, note: 'Món 2' },
        ],
      }),
    });
    const order2 = order2Res.data?.data;
    const order2Id = order2?._id;
    const itemToCancelId = order2?.items[0]?._id;
    const item2Price = order2?.items[1]?.itemTotal;

    // RBAC: Waiter không có POS.UPDATE bị chặn hủy món
    const waiterCancelItemRes = await request(`/orders/${order2Id}/items/${itemToCancelId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waiterToken}` },
      body: JSON.stringify({ reason: 'Bồi bàn tự ý hủy món' }),
    });
    if (waiterCancelItemRes.status === 403) {
      pass('Flow 11.1: RBAC - Chặn Waiter hủy món (không có POS.UPDATE)', 'HTTP 403 Forbidden thành công');
      passed++;
    } else {
      fail('Flow 11.1: RBAC - Chặn Waiter hủy món', `Mong đợi 403 nhưng nhận: ${waiterCancelItemRes.status}`);
      failed++;
    }

    // Hủy món 1 thiếu lý do -> 400 Bad Request
    const cancelItemWithoutReasonRes = await request(`/orders/${order2Id}/items/${itemToCancelId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: '' }), // thiếu lý do
    });
    if (cancelItemWithoutReasonRes.status === 400) {
      pass('Flow 11.2: Hủy món yêu cầu cancelReason bắt buộc', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('Flow 11.2: Hủy món yêu cầu cancelReason', `Mong đợi 400 nhưng nhận: ${cancelItemWithoutReasonRes.status}`);
      failed++;
    }

    // Owner hủy món 1 với lý do -> 200 OK & recalculate subTotal
    const cancelItemRes = await request(`/orders/${order2Id}/items/${itemToCancelId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Khách đổi ý hủy món 1' }),
    });

    const order2AfterCancelItem = cancelItemRes.data?.data;
    if (
      cancelItemRes.status === 200 &&
      order2AfterCancelItem?.items[0]?.status === 'Cancelled' &&
      order2AfterCancelItem?.subTotal === item2Price
    ) {
      pass('Flow 11.3: Hủy món và tính lại subTotal', `Món 1 = Cancelled, subTotal giảm còn ${item2Price} chính xác`);
      passed++;
    } else {
      fail('Flow 11.3: Hủy món và tính lại subTotal', JSON.stringify(cancelItemRes.data));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST FLOW 12: CANCEL ROUND
    // ------------------------------------------------------------------------
    // 12.1: Chặn hủy Round đã Confirmed (Round 1 của order2 đã Confirmed) -> 400
    const cancelConfirmedRoundRes = await request(`/orders/${order2Id}/rounds/1/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Hủy round đã chốt' }),
    });
    if (cancelConfirmedRoundRes.status === 400) {
      pass('Flow 12.1: Chặn hủy Round đã Confirmed', 'HTTP 400 Bad Request thành công (Confirmed là terminal)');
      passed++;
    } else {
      fail('Flow 12.1: Chặn hủy Round đã Confirmed', `Mong đợi 400 nhưng nhận: ${cancelConfirmedRoundRes.status}`);
      failed++;
    }

    // 12.2: Hủy Round ở trạng thái WaitingConfirmation (Tạo order QR mới)
    const qrOrder3Res = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        tableId,
        orderSource: 'QR_CUSTOMER',
        branchId,
        items: [{ menuItemId, quantity: 1 }],
      }),
    });
    const qrOrder3Id = qrOrder3Res.data?.data?._id;

    const cancelWaitingRoundRes = await request(`/orders/${qrOrder3Id}/rounds/1/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Nhà hàng từ chối đợt gọi món của khách' }),
    });

    const order3AfterCancel = cancelWaitingRoundRes.data?.data;
    if (
      cancelWaitingRoundRes.status === 200 &&
      order3AfterCancel?.rounds[0]?.status === 'Cancelled' &&
      order3AfterCancel?.status === 'Cancelled'
    ) {
      pass('Flow 12.2: Hủy Round ở trạng thái WaitingConfirmation', 'Round = Cancelled, Order = Cancelled');
      passed++;
    } else {
      fail('Flow 12.2: Hủy Round ở trạng thái WaitingConfirmation', JSON.stringify(cancelWaitingRoundRes.data));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST FLOW 13: CANCEL ORDER TOÀN BỘ VÀ GIẢI PHÓNG BÀN
    // ------------------------------------------------------------------------
    const cancelOrderRes = await request(`/orders/${order2Id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Bàn có việc gấp xin phép hủy toàn bộ' }),
    });

    if (cancelOrderRes.status === 200 && cancelOrderRes.data?.data?.status === 'Cancelled') {
      const tableCheck = await connection.collection('tables').findOne({ _id: new Types.ObjectId(tableId) });
      if (tableCheck?.status === 'Available') {
        pass('Flow 13: Hủy đơn hàng toàn bộ (Cancel Order)', 'Order = Cancelled, Bàn tự động giải phóng Available');
        passed++;
      } else {
        fail('Flow 13: Hủy đơn hàng toàn bộ', `Bàn chưa giải phóng: ${tableCheck?.status}`);
        failed++;
      }
    } else {
      fail('Flow 13: Hủy đơn hàng toàn bộ', JSON.stringify(cancelOrderRes.data));
      failed++;
    }

  } catch (err: any) {
    console.error('Lỗi ngoại lệ trong quá trình kiểm thử:', err);
    failed++;
  } finally {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Kết quả kiểm thử Sub-phase 6.2: ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : colors.reset}${failed} failed`);
    console.log(`----------------------------------------------------------------\n`);

    console.log('[Teardown] Dọn dẹp tài nguyên kiểm thử...');
    if (restaurantId) {
      const db = connection.db!;
      await db.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
      await db.collection('tables').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
      await db.collection('table_zones').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
      await db.collection('menu_items').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
      await db.collection('categories').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
      await db.collection('users').deleteMany({
        email: { $regex: new RegExp(`\\.sm\\.${timestamp}@imenu\\.vn`) },
      });
      await db.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantId) });
    }

    await app?.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
